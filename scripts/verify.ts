/**
 * Checks the calculation engine against published worked examples
 * (HMRC, GOV.UK, gov.scot, LITRG — the validation guide that accompanies
 * this project lists the source for each one).
 *
 *   npm run verify            checks the rate data in scripts/rates-data.ts
 *   npm run verify -- --db    runs the same checks against the LIVE
 *                             tax_years collection in MongoDB, and first
 *                             confirms every document has every field the
 *                             engine needs (the classic "I updated the code
 *                             but forgot to re-run npm run seed" problem)
 *
 * Exits with a non-zero status if anything fails, so it can also gate a
 * deploy. Worth running after every change to the rates — a Budget update,
 * an edit on /admin/tax-years, or a code change to lib/calculateTax.ts.
 *
 * What a pass means: the engine still reproduces every published example
 * for 2026/27 to the penny. What it does NOT mean: that rates you've
 * entered for a *new* tax year are right — those still need checking
 * against that year's gov.uk figures. See the README's "Verifying the
 * calculations" section.
 */
import {
  calculateMultiIncomeTax,
  type CalculationResult,
  type MultiIncomeInput,
  type TaxYearRates,
} from "../lib/calculateTax";
import { compareTaxCodes, estimateTaxCode, parseTaxCode, type TaxCodeInput } from "../lib/taxCode";
import { taxYears as fileRates } from "./rates-data";

type Region = "uk" | "scotland";

interface Outcome {
  ok: boolean;
  label: string;
  detail: string;
}

const outcomes: { section: string; results: Outcome[] }[] = [];
let currentSection: { section: string; results: Outcome[] } | null = null;

function section(title: string) {
  currentSection = { section: title, results: [] };
  outcomes.push(currentSection);
}

const gbp = (n: number) =>
  "£" +
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Pence-level comparison; 1p tolerance absorbs rounding in the published sources. */
function expectNumber(label: string, got: number, want: number, tolerance = 0.011) {
  const ok = Math.abs(got - want) <= tolerance;
  currentSection!.results.push({
    ok,
    label,
    detail: ok ? gbp(got) : `got ${gbp(got)}, expected ${gbp(want)}`,
  });
}

function expectFlag(label: string, got: boolean, want: boolean) {
  const ok = got === want;
  currentSection!.results.push({
    ok,
    label,
    detail: ok ? "as expected" : `got ${got}, expected ${want}`,
  });
}

function fail(label: string, detail: string) {
  currentSection!.results.push({ ok: false, label, detail });
}

function pass(label: string, detail = "") {
  currentSection!.results.push({ ok: true, label, detail });
}

// ---------------------------------------------------------------------------
// Rate data source
// ---------------------------------------------------------------------------

/** Every dotted path to a plain-object field (arrays are treated as leaves). */
function fieldPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value) || value instanceof Date) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    fieldPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

async function loadFromDatabase(): Promise<TaxYearRates[]> {
  const mongo = await import("mongodb");
  const dotenv = await import("dotenv");
  const path = await import("node:path");
  const fs = await import("node:fs");

  // Same env loading as scripts/seed.ts: prefer .env.local, fall back to .env
  const envLocal = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
  else dotenv.config();

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local first.");
  const dbName = process.env.MONGODB_DB_NAME || "tax_calculator";

  const client = new mongo.MongoClient(uri);
  try {
    await client.connect();
    const docs = await client
      .db(dbName)
      .collection("tax_years")
      .find({}, { projection: { _id: 0 } })
      .toArray();
    return docs as unknown as TaxYearRates[];
  } finally {
    await client.close();
  }
}

/** Reports any document missing a field that the seed data (and so the engine) expects. */
function checkSchema(rows: TaxYearRates[]): boolean {
  const expected = new Set(fileRates.flatMap((d) => fieldPaths(d)));
  expected.delete("updatedAt");
  let allGood = true;
  for (const doc of rows) {
    const have = new Set(fieldPaths(doc));
    const missing = [...expected].filter((p) => !have.has(p));
    const label = `${doc.taxYear} (${doc.region})`;
    if (missing.length) {
      allGood = false;
      // A handful of missing fields: name them exactly. Many (the usual
      // "seeded before an update" case): group by top-level section.
      const named =
        missing.length <= 4 ? missing : [...new Set(missing.map((m) => m.split(".")[0]))];
      fail(label, `missing ${named.join(", ")} — run npm run seed (or re-save this year on /admin/tax-years)`);
    } else {
      pass(label, "all required fields present");
    }
  }
  return allGood;
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

function runChecks(rows: TaxYearRates[]) {
  const find = (year: string, region: Region): TaxYearRates => {
    const doc = rows.find((d) => d.taxYear === year && d.region === region);
    if (!doc) throw new Error(`No ${year} (${region}) document in the rate data.`);
    return doc;
  };
  const uk = find("2026-27", "uk");
  const sc = find("2026-27", "scotland");
  const run = (input: MultiIncomeInput, rates: TaxYearRates = uk) =>
    calculateMultiIncomeTax(input, rates);
  const incomeTaxBeforeReliefs = (r: CalculationResult) =>
    r.nonSavings.tax + r.savings.tax + r.dividends.tax;

  section("Income tax, savings & dividends stacking — LITRG worked examples");
  expectNumber("Eric (basic)", incomeTaxBeforeReliefs(run({ employmentIncome: 15000, savingsInterest: 4000, dividendIncome: 500 })), 572.0);
  expectNumber("Eric (higher, via dividends)", incomeTaxBeforeReliefs(run({ employmentIncome: 15000, savingsInterest: 4000, dividendIncome: 32000 })), 4240.74);
  expectNumber("Finlay", incomeTaxBeforeReliefs(run({ employmentIncome: 49150, savingsInterest: 800, dividendIncome: 6000 })), 9342.25);
  expectNumber("Adam", incomeTaxBeforeReliefs(run({ employmentIncome: 16500, savingsInterest: 1400, dividendIncome: 500 })), 786.0);
  expectNumber("Rupa", incomeTaxBeforeReliefs(run({ employmentIncome: 21500, savingsInterest: 1400, dividendIncome: 6000 })), 2457.25);
  expectNumber("Sam", incomeTaxBeforeReliefs(run({ employmentIncome: 44500, savingsInterest: 1400, dividendIncome: 6000 })), 7564.74);

  section("Capital Gains Tax — GOV.UK worked examples");
  expectNumber("Example 1 (gain within basic-rate band)", run({ employmentIncome: 32570, capitalGains: 12600 }).capitalGainsTax.tax, 1728);
  expectNumber("Example 2 (gain spans both bands)", run({ employmentIncome: 32570, capitalGains: 52600 }).capitalGainsTax.tax, 10842);

  section("Rental expenses + mortgage interest relief — LITRG 'Carrie'");
  expectNumber("Total income tax", run({ employmentIncome: 15000, rentalIncome: 12000, rentalExpenses: [{ category: "Other", amount: 1500 }], mortgageInterest: 4000 }).totalIncomeTax, 1786);

  section("Scottish bands — gov.scot tables, cross-checked against a third-party calculator");
  const s35 = run({ employmentIncome: 35000 }, sc);
  expectNumber("£35,000 salary: Scottish income tax", s35.nonSavings.tax, 4501.05);
  expectNumber("£35,000 salary: National Insurance", s35.nationalInsurance.total, 1794.4);
  const mixed: MultiIncomeInput = { employmentIncome: 45000, savingsInterest: 2000, dividendIncome: 3000, capitalGains: 10000 };
  const mixedUk = run(mixed, uk);
  const mixedSc = run(mixed, sc);
  expectNumber("Savings tax identical in Scotland and rest of UK", mixedSc.savings.tax, mixedUk.savings.tax);
  expectNumber("Dividend tax identical in Scotland and rest of UK", mixedSc.dividends.tax, mixedUk.dividends.tax);
  expectNumber("CGT identical in Scotland and rest of UK", mixedSc.capitalGainsTax.tax, mixedUk.capitalGainsTax.tax);

  section("Rent-a-Room Scheme — HS223 (frozen £7,500 / £3,750 threshold since 2016)");
  const belowThreshold = run({ employmentIncome: 20000, rentARoomReceipts: 7000 });
  expectNumber("Under the £7,500 threshold: fully exempt, taxable amount", belowThreshold.nonSavings.rentARoomTaxableAmount, 0);
  expectNumber("Under the £7,500 threshold: income tax (salary only)", belowThreshold.totalIncomeTax, 1486);
  const smallExpenses = run({ employmentIncome: 20000, rentARoomReceipts: 9000, rentARoomExpenses: [{ category: "Cleaning", amount: 500 }] }).nonSavings;
  expectNumber("Over threshold, small expenses: threshold method wins — deduction applied", smallExpenses.rentARoomDeductionApplied, 7500);
  expectNumber("Over threshold, small expenses: taxable amount", smallExpenses.rentARoomTaxableAmount, 1500);
  const largeExpenses = run({ rentARoomReceipts: 12000, rentARoomExpenses: [{ category: "Bills", amount: 9000 }] }).nonSavings;
  expectNumber("Over threshold, large expenses: expenses method wins — deduction applied", largeExpenses.rentARoomDeductionApplied, 9000);
  expectNumber("Over threshold, large expenses: taxable amount", largeExpenses.rentARoomTaxableAmount, 3000);
  const shared = run({ rentARoomReceipts: 5000, rentARoomShared: true }).nonSavings;
  expectNumber("Shared: threshold halved to £3,750", shared.rentARoomThresholdApplied, 3750);
  expectNumber("Shared: £5,000 receipts now exceeds the halved threshold — taxable amount", shared.rentARoomTaxableAmount, 1250);
  const notShared = run({ rentARoomReceipts: 5000 }).nonSavings;
  expectNumber("Not shared: same £5,000 stays under the full £7,500 threshold — exempt", notShared.rentARoomTaxableAmount, 0);
  const noLoss = run({ rentARoomReceipts: 9000, rentARoomExpenses: [{ category: "Bills", amount: 11000 }] }).nonSavings;
  expectNumber("Expenses exceeding receipts: floored at £0, no loss carried", noLoss.rentARoomTaxableAmount, 0);

  section("Self-employment Class 4 NI — LITRG (income entered = profit + £1,000 trading allowance)");
  expectNumber("Frank (£13,000 profit)", run({ selfEmploymentProfit: 14000 }).nationalInsuranceClass4.total, 25.8);
  expectNumber("Henriette (£55,000 profit)", run({ selfEmploymentProfit: 56000 }).nationalInsuranceClass4.total, 2356.6);

  section("Foreign tax credit relief (HS263 rule) and pension income");
  const ftcr = run({ employmentIncome: 40000, dividendIncome: 2000, foreignTaxWithheldOnDividends: 300 });
  expectNumber("Credit capped at UK tax due, not the £300 withheld", ftcr.dividends.foreignTaxCredit, 161.25);
  expectNumber("Total income tax after the credit", ftcr.totalIncomeTax, 5486);
  const pension = run({ pensionIncome: 20000 });
  expectNumber("Pension income attracts no National Insurance", pension.nationalInsurance.total, 0);
  expectNumber("Pension income tax", pension.totalIncomeTax, 1486);

  section("Losses and unused relief carried forward — PIM4210, ITA 2007 s83, PIM4460");
  const kasper = run({ selfEmploymentProfit: 23000, selfEmploymentLossBroughtForward: 7000 }).nonSavings;
  expectNumber("Kasper (LITRG): loss relieved", kasper.selfEmploymentLossReliefApplied, 7000);
  expectNumber("Kasper (LITRG): loss carried forward", kasper.selfEmploymentLossCarriedForward, 0);
  expectNumber("Rental loss, year 1: carried forward", run({ rentalIncome: 5000, rentalExpenses: [{ category: "Repairs", amount: 8000 }] }).nonSavings.rentalLossCarriedForward, 3000);
  const rentalY2 = run({ rentalIncome: 6000, rentalLossBroughtForward: 3000 }).nonSavings;
  expectNumber("Rental loss, year 2: relieved", rentalY2.rentalLossReliefApplied, 3000);
  expectNumber("Rental loss, year 2: taxable rental profit", rentalY2.gross, 2000);
  const mortgage = run({ employmentIncome: 30000, rentalIncome: 10500, mortgageInterest: 10500 }).mortgageInterestRelief;
  expectNumber("Mortgage relief capped by profit", mortgage.credit, 1900);
  expectNumber("Unused finance costs carried forward", mortgage.financeCostsCarriedForward, 1000);
  const mortgageNoSalary = run({ rentalIncome: 10500, mortgageInterest: 10500 }).mortgageInterestRelief;
  expectNumber("No income above the Personal Allowance: credit is £0", mortgageNoSalary.credit, 0);
  expectNumber("...and the whole £10,500 carries forward", mortgageNoSalary.financeCostsCarriedForward, 10500);
  const yearBase: MultiIncomeInput = { employmentIncome: 30000, rentalIncome: 12000, mortgageInterest: 4000 };
  expectNumber("Second year, without brought-forward costs", run(yearBase).mortgageInterestRelief.credit, 800);
  expectNumber("Second year, with £1,000 brought forward", run({ ...yearBase, financeCostsBroughtForward: 1000 }).mortgageInterestRelief.credit, 1000);

  section("Capital losses — HMRC Capital Gains Manual CG21520");
  const losses = run({ capitalGains: 16300, capitalLossesThisYear: 3500, capitalLossesBroughtForward: 10500 }).capitalGainsTax;
  expectNumber("Brought-forward loss used", losses.broughtForwardLossUsed, 9800);
  expectNumber("Taxable gain", losses.taxableGain, 0);
  expectNumber("Loss carried forward", losses.lossesCarriedForward, 700);
  const preserve = run({ capitalGains: 4000, capitalLossesBroughtForward: 10000 }).capitalGainsTax;
  expectNumber("Only the loss actually needed is used", preserve.broughtForwardLossUsed, 1000);
  expectNumber("The rest is preserved for later years", preserve.lossesCarriedForward, 9000);

  section("Pension contributions (relief at source) — extending the basic-rate band");
  const jane = run({ employmentIncome: 60270, personalPensionContributions: 8000 });
  expectNumber("Jane: income tax", jane.totalIncomeTax, 9540);
  expectNumber("Jane: bands widened by the grossed-up amount", jane.reliefAtSource.bandExtension, 10000);

  section("Private Residence Relief (full-relief case)");
  const prr = run({ mainResidenceGain: 150000, mainResidenceFullyExempt: true }).capitalGainsTax;
  expectNumber("Exempt home sale: CGT", prr.tax, 0);
  expectNumber("Exempt home sale: Annual Exempt Amount not used", prr.annualExemptAmount, 0);
  expectNumber("Exempt home sale + unrelated £10,000 gain: CGT on the other gain only", run({ mainResidenceGain: 150000, mainResidenceFullyExempt: true, capitalGains: 10000 }).capitalGainsTax.tax, 1260);
  expectNumber("Unticked: whole gain taxed as ordinary (conservative)", run({ mainResidenceGain: 150000, mainResidenceFullyExempt: false }).capitalGainsTax.tax, 33018);

  section("High Income Child Benefit Charge, student loans, Marriage Allowance");
  expectNumber("HICBC at £76,000 (80% of £2,212.60)", run({ employmentIncome: 76000, childBenefitReceived: 2212.6 }).hicbc.charge, 1770.08);
  expectNumber("HICBC at £60,000 (taper not yet started)", run({ employmentIncome: 60000, childBenefitReceived: 2212.6 }).hicbc.charge, 0);
  expectNumber("HICBC at £80,000 (fully clawed back)", run({ employmentIncome: 80000, childBenefitReceived: 2212.6 }).hicbc.charge, 2212.6);
  expectNumber("Student loan, Plan 2, £35,000", run({ employmentIncome: 35000, studentLoanPlan: "plan2" }).studentLoan.totalRepayment, 505.35);
  expectNumber("Plan 2 + Postgraduate Loan stack", run({ employmentIncome: 35000, studentLoanPlan: "plan2", hasPostgraduateLoan: true }).studentLoan.totalRepayment, 1345.35);
  const ma = run({ employmentIncome: 30000, receivingMarriageAllowance: true });
  const noMa = run({ employmentIncome: 30000 });
  expectNumber("Marriage Allowance: Personal Allowance", ma.personalAllowance, 13830);
  expectNumber("Marriage Allowance: income tax", ma.totalIncomeTax, 3234);
  expectNumber("Marriage Allowance: saving (House of Commons Library: £252)", noMa.totalIncomeTax - ma.totalIncomeTax, 252);
  // HMRC: the recipient's income must be £50,270 or less before the transfer.
  expectFlag("Recipient appears eligible at £50,270 (HMRC's stated limit)", run({ employmentIncome: 50270, receivingMarriageAllowance: true }).marriageAllowance.recipientAppearsEligible, true);
  expectFlag("Recipient flagged as ineligible (warning shown) at £50,271", run({ employmentIncome: 50271, receivingMarriageAllowance: true }).marriageAllowance.recipientAppearsEligible, false);
  expectFlag("Scottish recipient appears eligible at £43,662 (gov.scot intermediate-rate limit)", run({ employmentIncome: 43662, receivingMarriageAllowance: true }, sc).marriageAllowance.recipientAppearsEligible, true);
  expectFlag("Scottish recipient flagged as ineligible at £43,700", run({ employmentIncome: 43700, receivingMarriageAllowance: true }, sc).marriageAllowance.recipientAppearsEligible, false);

  // Giving side — GOV.UK "Marriage Allowance": the giver's income must be
  // below their Personal Allowance, and giving £1,260 away can leave a giver
  // paying a little tax. These cases are built from that rule (the
  // arithmetic is hand-checkable); GOV.UK's own page works one example in
  // prose but not with these figures, so they are self-constructed.
  const giverLow = run({ employmentIncome: 8000, givingMarriageAllowance: true });
  expectNumber("Giver at £8,000: Personal Allowance after giving £1,260", giverLow.personalAllowance, 11310);
  expectNumber("Giver at £8,000: income tax", giverLow.totalIncomeTax, 0);
  expectNumber("Giver at £8,000: income above reduced allowance", giverLow.marriageAllowance.giverIncomeAboveReducedAllowance, 0);
  const giverMid = run({ employmentIncome: 12000, givingMarriageAllowance: true });
  expectNumber("Giver at £12,000: income tax ((£12,000 − £11,310) × 20%)", giverMid.totalIncomeTax, 138);
  expectNumber("Giver at £12,000: income above reduced allowance", giverMid.marriageAllowance.giverIncomeAboveReducedAllowance, 690);
  expectFlag("Giver at £12,000 appears eligible", giverMid.marriageAllowance.giverAppearsEligible, true);
  const recipientAt30k = run({ employmentIncome: 30000, receivingMarriageAllowance: true });
  const recipientNoMa = run({ employmentIncome: 30000 });
  expectNumber(
    "Couple: recipient saves £252, giver at £12,000 pays £138, net saving",
    (recipientNoMa.totalIncomeTax - recipientAt30k.totalIncomeTax) - giverMid.totalIncomeTax,
    114
  );
  const giverAtPA = run({ employmentIncome: 12570, givingMarriageAllowance: true });
  expectNumber("Giver at exactly £12,570: tax cancels the whole £252 saving", giverAtPA.totalIncomeTax, 252);
  expectFlag("Giver at exactly £12,570 flagged: GOV.UK says income must be below the allowance", giverAtPA.marriageAllowance.giverAppearsEligible, false);
  expectFlag("Giver at £12,569 appears eligible", run({ employmentIncome: 12569, givingMarriageAllowance: true }).marriageAllowance.giverAppearsEligible, true);
  expectFlag("Giver at £12,571 flagged as ineligible", run({ employmentIncome: 12571, givingMarriageAllowance: true }).marriageAllowance.giverAppearsEligible, false);
  expectFlag("Not giving: no giving flag", run({ employmentIncome: 8000 }).marriageAllowance.giving, false);

  section("Smoke test — every tax year and region, all features switched on at once");
  const kitchenSink: MultiIncomeInput = {
    employmentIncome: 55000, pensionIncome: 8000,
    rentalIncome: 14000, rentalExpenses: [{ category: "Repairs", amount: 2500 }], rentalLossBroughtForward: 500,
    mortgageInterest: 5000, financeCostsBroughtForward: 700,
    rentARoomReceipts: 9000, rentARoomExpenses: [{ category: "Cleaning", amount: 1200 }], rentARoomShared: false,
    selfEmploymentProfit: 12000, selfEmploymentExpenses: [{ category: "Travel", amount: 1800 }], selfEmploymentLossBroughtForward: 400,
    savingsInterest: 1200, dividendIncome: 4000, foreignTaxWithheldOnDividends: 600,
    capitalGains: 20000, capitalLossesThisYear: 1000, capitalLossesBroughtForward: 3000,
    personalPensionContributions: 4000, giftAidDonations: 500,
    mainResidenceGain: 90000, mainResidenceFullyExempt: true,
    childBenefitReceived: 2000, studentLoanPlan: "plan2", hasPostgraduateLoan: true,
    receivingMarriageAllowance: true,
  };
  for (const doc of rows) {
    const label = `${doc.taxYear} (${doc.region})`;
    try {
      const result = calculateMultiIncomeTax(kitchenSink, doc);
      const bad = firstNonFinite(result);
      if (bad) fail(label, `produced a non-numeric value at "${bad}"`);
      else pass(label, "every figure is a finite number");
      // The coloured bar on the results card is drawn from these figures, so
      // net income plus every deduction must add up to income plus gains
      // exactly — otherwise the bar would stop short of full width.
      const accountedFor =
        result.netIncome + result.totalIncomeTax + result.nationalInsurance.total +
        result.nationalInsuranceClass4.total + result.capitalGainsTax.tax +
        result.hicbc.charge + result.studentLoan.totalRepayment;
      const base = result.totalGrossIncome + result.capitalGainsTax.netGainsAfterCurrentYearLosses;
      expectNumber(`${label}: net income + every deduction = income + gains`, accountedFor - base, 0);
    } catch (err) {
      fail(label, `threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const empty = run({});
  expectNumber("Empty input produces a zero result", Math.abs(empty.netIncome) + Math.abs(empty.totalDeductions), 0);
  section("Blind Person's Allowance and Married Couple's Allowance (2026/27: £3,250; £11,700 max, £4,530 min, £39,200 limit)");
  const bpa = run({ employmentIncome: 20000, blindPersonsAllowance: true });
  expectNumber("BPA: adds £3,250 to the Personal Allowance", bpa.personalAllowance, 15820);
  expectNumber("BPA: tax = (£20,000 − £15,820) × 20%", bpa.totalIncomeTax, 836);
  expectNumber("BPA saves £650 (20% of £3,250)", run({ employmentIncome: 20000 }).totalIncomeTax - bpa.totalIncomeTax, 650);
  expectNumber("BPA is not tapered above £100,000: £110,000 income = £7,570 + £3,250", run({ employmentIncome: 110000, blindPersonsAllowance: true }).personalAllowance, 10820);
  expectNumber("BPA transferred in £1,000 adds £1,000", run({ employmentIncome: 20000, blindPersonsAllowanceTransferredIn: 1000 }).personalAllowance, 13570);
  expectNumber("BPA transferred in is capped at one full allowance", run({ employmentIncome: 20000, blindPersonsAllowanceTransferredIn: 9999 }).personalAllowance, 15820);
  expectNumber("BPA unused at £10,000 income: all £3,250 can be transferred", run({ employmentIncome: 10000, blindPersonsAllowance: true }).blindPersonsAllowance.unusedAmount, 3250);
  expectNumber("BPA unused at £14,000 income: only £1,820 left", run({ employmentIncome: 14000, blindPersonsAllowance: true }).blindPersonsAllowance.unusedAmount, 1820);
  expectNumber("BPA unused at £20,000 income: nothing left", bpa.blindPersonsAllowance.unusedAmount, 0);
  expectNumber("BPA applies in Scotland too (PA + £3,250)", run({ employmentIncome: 20000, blindPersonsAllowance: true }, sc).personalAllowance, 15820);
  const mca30 = run({ employmentIncome: 30000, claimingMarriedCouplesAllowance: true });
  expectNumber("MCA at £30,000 (under the limit): maximum £11,700", mca30.marriedCouplesAllowance.amount, 11700);
  expectNumber("MCA: tax reduction £1,170 (10%)", mca30.marriedCouplesAllowance.taxReductionApplied, 1170);
  expectNumber("MCA: tax £3,486 − £1,170 = £2,316", mca30.totalIncomeTax, 2316);
  expectNumber("MCA at £45,000: £5,800 over the limit reduces the amount by £2,900", run({ employmentIncome: 45000, claimingMarriedCouplesAllowance: true }).marriedCouplesAllowance.amount, 8800);
  expectNumber("MCA at £60,000: floors at the minimum £4,530", run({ employmentIncome: 60000, claimingMarriedCouplesAllowance: true }).marriedCouplesAllowance.amount, 4530);
  const mcaLow = run({ employmentIncome: 13000, claimingMarriedCouplesAllowance: true });
  expectNumber("MCA capped by tax due: £86 applied", mcaLow.marriedCouplesAllowance.taxReductionApplied, 86);
  expectNumber("MCA capped by tax due: £1,084 unused, transferable", mcaLow.marriedCouplesAllowance.unusedReduction, 1084);
  expectNumber("MCA tax cannot go below zero", mcaLow.totalIncomeTax, 0);
  expectNumber("Without a claim, MCA changes nothing", run({ employmentIncome: 30000 }).totalIncomeTax, 3486);
  const noBpaRates: TaxYearRates = { ...uk, blindPersonsAllowance: undefined, marriedCouplesAllowance: undefined };
  expectNumber("Tax year documents without BPA/MCA figures still calculate (allowance unchanged)", calculateMultiIncomeTax({ employmentIncome: 20000, blindPersonsAllowance: true, claimingMarriedCouplesAllowance: true }, noBpaRates).personalAllowance, 12570);
  expectFlag("…and report that BPA is not available for that year", calculateMultiIncomeTax({ employmentIncome: 20000, blindPersonsAllowance: true }, noBpaRates).blindPersonsAllowance.available, false);

  section("Vehicle costs: simplified mileage and capital allowances for one vehicle");
  const uk25 = find("2025-26", "uk");
  const vehicleCalc = (vehicleAllowance: NonNullable<MultiIncomeInput["vehicleAllowance"]>, rates: TaxYearRates = uk) =>
    run({ selfEmploymentProfit: 30000, vehicleAllowance }, rates).vehicles.allowance!;
  expectNumber("Mileage 2026-27: 12,000 car miles = 10,000 × 55p + 2,000 × 25p", run({ selfEmploymentProfit: 30000, businessMilesCarVan: 12000 }).vehicles.mileage.expense, 6000);
  expectNumber("Mileage 2025-26: 12,000 car miles = 10,000 × 45p + 2,000 × 25p", run({ selfEmploymentProfit: 30000, businessMilesCarVan: 12000 }, uk25).vehicles.mileage.expense, 5000);
  expectNumber("Mileage: 1,000 motorcycle miles at 24p", run({ selfEmploymentProfit: 30000, businessMilesMotorcycle: 1000 }).vehicles.mileage.expense, 240);
  expectNumber("Mileage becomes a business expense (£30,000 − £6,000 = £24,000 profit)", 30000 - run({ selfEmploymentProfit: 30000, businessMilesCarVan: 12000 }).nonSavings.selfEmploymentDeductionApplied, 24000);
  const petrol = vehicleCalc({ type: "car", businessUsePercent: 100, costThisYear: 20000, condition: "new", co2Band: "over50" });
  expectNumber("New car over 50 g/km, £20,000: special pool 6% = £1,200", petrol.allowanceClaimed, 1200);
  expectNumber("…and £18,800 carries forward", petrol.poolCarriedForward, 18800);
  const hybrid = vehicleCalc({ type: "car", businessUsePercent: 80, costThisYear: 30000, condition: "new", co2Band: "upto50" });
  expectNumber("New car up to 50 g/km, £30,000, 80% business, 2026-27: 14% = £4,200 × 80% = £3,360", hybrid.allowanceClaimed, 3360);
  expectNumber("…£25,800 carries forward (before the private-use share)", hybrid.poolCarriedForward, 25800);
  expectNumber("Same car in 2025-26 (18%): £5,400 × 80% = £4,320", vehicleCalc({ type: "car", businessUsePercent: 80, costThisYear: 30000, condition: "new", co2Band: "upto50" }, uk25).allowanceClaimed, 4320);
  expectNumber("New zero-emission car £40,000: 100% first-year allowance", vehicleCalc({ type: "car", businessUsePercent: 100, costThisYear: 40000, condition: "new", co2Band: "zero" }).allowanceClaimed, 40000);
  expectNumber("…at 70% business use: £28,000", vehicleCalc({ type: "car", businessUsePercent: 70, costThisYear: 40000, condition: "new", co2Band: "zero" }).allowanceClaimed, 28000);
  expectNumber("Second-hand zero-emission car £10,000: no first-year allowance, main pool 14% = £1,400", vehicleCalc({ type: "car", businessUsePercent: 100, costThisYear: 10000, condition: "secondhand", co2Band: "zero" }).allowanceClaimed, 1400);
  expectNumber("Van £25,000 at 90% business: Annual Investment Allowance £22,500", vehicleCalc({ type: "van", businessUsePercent: 90, costThisYear: 25000 }).allowanceClaimed, 22500);
  expectNumber("Motorcycle £6,000: Annual Investment Allowance in full", vehicleCalc({ type: "motorcycle", businessUsePercent: 100, costThisYear: 6000 }).allowanceClaimed, 6000);
  expectNumber("Earlier-year vehicle, main pool £10,000 b/f: 14% = £1,400", vehicleCalc({ type: "car", businessUsePercent: 100, poolBroughtForward: 10000, poolType: "main" }).allowanceClaimed, 1400);
  expectNumber("…2025-26 would be 18% = £1,800", vehicleCalc({ type: "car", businessUsePercent: 100, poolBroughtForward: 10000, poolType: "main" }, uk25).allowanceClaimed, 1800);
  expectNumber("Special pool £10,000 b/f: 6% = £600", vehicleCalc({ type: "car", businessUsePercent: 100, poolBroughtForward: 10000, poolType: "special" }).allowanceClaimed, 600);
  const small = vehicleCalc({ type: "car", businessUsePercent: 100, poolBroughtForward: 800, poolType: "main" });
  expectNumber("Small pool £800 b/f: written off in full", small.allowanceClaimed, 800);
  expectNumber("…nothing left to carry forward", small.poolCarriedForward, 0);
  const soldHigh = vehicleCalc({ type: "car", businessUsePercent: 100, poolBroughtForward: 8000, poolType: "main", saleProceeds: 9000 });
  expectNumber("Sold for £9,000 against £8,000 left: balancing charge £1,000", soldHigh.balancingCharge, 1000);
  expectNumber("Balancing charge at 80% business use: £800", vehicleCalc({ type: "car", businessUsePercent: 80, poolBroughtForward: 8000, poolType: "main", saleProceeds: 9000 }).balancingCharge, 800);
  expectNumber("Sold for £5,000 against £8,000 left, 80% business: balancing allowance £3,000 × 80% = £2,400", vehicleCalc({ type: "car", businessUsePercent: 80, poolBroughtForward: 8000, poolType: "main", saleProceeds: 5000 }).allowanceClaimed, 2400);
  expectNumber("Sold for £5,000, 100% business: pool continues, 14% of £3,000 = £420", vehicleCalc({ type: "car", businessUsePercent: 100, poolBroughtForward: 8000, poolType: "main", saleProceeds: 5000 }).allowanceClaimed, 420);
  const withCharge = run({ selfEmploymentProfit: 30000, vehicleAllowance: { type: "car", businessUsePercent: 100, poolBroughtForward: 8000, poolType: "main", saleProceeds: 9000 } });
  expectNumber("A balancing charge is added to business income (£30,000 + £1,000)", withCharge.nonSavings.selfEmploymentGross, 31000);
  const car = run({ selfEmploymentProfit: 30000, vehicleAllowance: { type: "car", businessUsePercent: 100, costThisYear: 20000, condition: "new", co2Band: "over50" } });
  expectNumber("Allowance flows into the self-employment expenses (£1,200 beats the £1,000 trading allowance)", car.nonSavings.selfEmploymentExpensesTotal, 1200);
  expectFlag("…so itemised expenses are used", car.nonSavings.selfEmploymentDeductionMethod === "expenses", true);
  const noVehicleRates: TaxYearRates = { ...uk, vehicles: undefined };
  const noV = calculateMultiIncomeTax({ selfEmploymentProfit: 30000, businessMilesCarVan: 12000, vehicleAllowance: { type: "car", businessUsePercent: 100, costThisYear: 20000, condition: "new", co2Band: "over50" } }, noVehicleRates);
  expectNumber("Tax years without vehicle figures: nothing is applied", noV.nonSavings.selfEmploymentExpensesTotal, 0);
  expectFlag("…and the result says vehicles aren't available", noV.vehicles.available, false);

  section("Tax code estimate (PAYE codes: allowance ÷ 10, plus a letter)");
  const codeFor = (r: CalculationResult, extra: Partial<TaxCodeInput> = {}) =>
    estimateTaxCode({
      region: r.region,
      allowance: r.personalAllowance,
      receivingMarriageAllowance: r.marriageAllowance.requested,
      givingMarriageAllowance: r.marriageAllowance.giving,
      benefitsInKind: 0,
      untaxedIncome: 0,
      underpaidTax: 0,
      marginalRate: 0.2,
      ...extra,
    }).code;
  const expectText = (label: string, got: string, want: string) => {
    const ok = got === want;
    currentSection!.results.push({ ok, label, detail: ok ? got : `got ${got}, expected ${want}` });
  };
  expectText("Standard code, rest of UK", codeFor(run({ employmentIncome: 30000 })), "1257L");
  expectText("Standard code, Scotland (S prefix)", codeFor(run({ employmentIncome: 30000 }, sc)), "S1257L");
  expectText("Marriage Allowance recipient: £13,830 allowance", codeFor(run({ employmentIncome: 30000, receivingMarriageAllowance: true })), "1383M");
  expectText("Marriage Allowance giver: £11,310 allowance", codeFor(run({ employmentIncome: 11000, givingMarriageAllowance: true })), "1131N");
  expectText("£3,000 benefit in kind reduces the code", codeFor(run({ employmentIncome: 30000 }), { benefitsInKind: 3000 }), "957L");
  expectText("£300 underpaid tax at 20% = £1,500 allowance", codeFor(run({ employmentIncome: 30000 }), { underpaidTax: 300 }), "1107L");
  expectText("Deductions above the allowance give a K code", codeFor(run({ employmentIncome: 30000 }), { benefitsInKind: 13000 }), "K43");
  expectText("Income £125,140+ (no allowance) gives 0T", codeFor(run({ employmentIncome: 150000 })), "0T");
  expectText("State Pension £11,973 collected through another pension's code: £597 left = 59L", codeFor(run({ pensionIncome: 20000 }), { statePension: 11973 }), "59L");
  const std = estimateTaxCode({ region: "uk", allowance: 12570, receivingMarriageAllowance: false, givingMarriageAllowance: false, benefitsInKind: 0, untaxedIncome: 0, underpaidTax: 0, marginalRate: 0.2 });
  expectText("Parses S1257L with spaces and case", String(parseTaxCode(" s1257 l ")?.number), "1257");
  expectText("Parses an emergency suffix (1257L W1)", String(parseTaxCode("1257L W1")?.letter), "L");
  const welshStd = estimateTaxCode({ region: "wales", allowance: 12570, receivingMarriageAllowance: false, givingMarriageAllowance: false, benefitsInKind: 0, untaxedIncome: 0, underpaidTax: 0, marginalRate: 0.2 });
  expectText("Wales: standard code carries a C prefix", welshStd.code, "C1257L");
  expectText("Wales: C1257L matches", compareTaxCodes("C1257L", welshStd, "wales", 0.2).status, "match");
  expectText("Wales: an unprefixed code is flagged", compareTaxCodes("1257L", welshStd, "wales", 0.2).status, "different");
  expectText("England: a C-prefix code is flagged", compareTaxCodes("C1257L", std, "uk", 0.2).status, "different");
  expectText("Rejects a nonsense code", String(parseTaxCode("hello")), "null");
  expectText("Matching code reports a match", compareTaxCodes("1257L", std, "uk", 0.2).status, "match");
  expectText("1190L is flagged as lower, £134 a year", compareTaxCodes("1190L", std, "uk", 0.2).status + ":" + compareTaxCodes("1190L", std, "uk", 0.2).yearlyTaxEffect, "lower:134");
  expectText("Missing S prefix is not reported as a match", compareTaxCodes("1257L", estimateTaxCode({ region: "scotland", allowance: 12570, receivingMarriageAllowance: false, givingMarriageAllowance: false, benefitsInKind: 0, untaxedIncome: 0, underpaidTax: 0, marginalRate: 0.2 }), "scotland", 0.2).status, "different");
}

/** Returns the path of the first NaN/Infinity/undefined number found, or null. */
function firstNonFinite(value: unknown, path = "result"): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? null : path;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const bad = firstNonFinite(value[i], `${path}[${i}]`);
      if (bad) return bad;
    }
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const bad = firstNonFinite(v, `${path}.${k}`);
      if (bad) return bad;
    }
  }
  return null;

}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const useDb = process.argv.includes("--db");
  console.log("UK Personal Tax Calculator — verification");
  console.log(`Rate data: ${useDb ? "live MongoDB collection (tax_years)" : "scripts/rates-data.ts"}\n`);

  let rows: TaxYearRates[] = fileRates;
  let schemaOk = true;

  if (useDb) {
    rows = await loadFromDatabase();
    section("Rate documents in the database — required fields");
    if (rows.length === 0) {
      fail("tax_years", "the collection is empty — run npm run seed");
      schemaOk = false;
    } else {
      schemaOk = checkSchema(rows);
    }
  }

  // If documents are structurally incomplete the numeric checks would only
  // produce confusing crashes, so stop with the clear message instead.
  if (schemaOk) {
    try {
      runChecks(rows);
    } catch (err) {
      section("Could not run the checks");
      fail("error", err instanceof Error ? err.message : String(err));
    }
  }

  let passed = 0;
  let failed = 0;
  for (const s of outcomes) {
    console.log(s.section);
    for (const r of s.results) {
      r.ok ? passed++ : failed++;
      console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.label}${r.detail ? " — " + r.detail : ""}`);
    }
    console.log("");
  }

  console.log(`${passed} passed, ${failed} failed.`);
  if (failed === 0) {
    console.log(
      "Passing means the engine still reproduces the published examples above — it does not check rates you've entered for a new tax year against gov.uk."
    );
  } else {
    console.log("Do not deploy until the failures above are understood.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
