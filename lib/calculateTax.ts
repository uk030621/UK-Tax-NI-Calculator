export interface TaxBand {
  threshold: number;
  rate: number;
}

/**
 * Full rate set for one tax year + region.
 *
 * Non-savings, non-dividend income (employment, rental profit) is taxed
 * using `incomeTaxBands`, which differ between rUK and Scotland.
 *
 * Savings interest and dividends are NOT devolved: Scottish taxpayers pay
 * the same savings/dividend rates and use the same £37,700 / £125,140
 * thresholds as the rest of the UK, regardless of their non-savings bands.
 * Capital Gains Tax is the same story — reserved to Westminster.
 * That's why `savingsBands`, `dividendBands` and `capitalGains` are
 * identical across the "uk" and "scotland" documents for a given year.
 */
export interface TaxYearRates {
  taxYear: string;
  region: "uk" | "scotland";
  personalAllowance: number;
  incomeTaxBands: TaxBand[];

  propertyAllowance: number;
  tradingAllowance: number; // same £1,000 pattern, for self-employment profit

  /**
   * Section 24: landlords don't deduct mortgage interest from rental
   * profit at all — instead they get a flat-rate tax credit against
   * their final income tax bill, at this rate regardless of their
   * marginal tax band. 20% since 2020/21; due to become 22% alongside
   * new separate property-income tax rates from April 2027.
   */
  mortgageInterestReliefRate: number;

  savingsAllowance: {
    basicRate: number; // PSA for basic-rate taxpayers
    higherRate: number; // PSA for higher-rate taxpayers (0 for additional-rate)
    startingRateBand: number; // 0% starting-rate-for-savings band (£5,000)
  };
  savingsBands: TaxBand[]; // always rUK thresholds/rates, both regions

  dividendAllowance: number;
  dividendBands: TaxBand[]; // always rUK thresholds, region-invariant rates

  capitalGains: {
    annualExemptAmount: number;
    bands: TaxBand[]; // basic/higher rate CGT, same for property & other assets since Oct 2024
  };

  nationalInsurance: {
    primaryThreshold: number;
    upperEarningsLimit: number;
    bands: TaxBand[];
  };

  /**
   * Class 4 NI (self-employment profit). Kept as its own object rather
   * than reusing `nationalInsurance` above: the Lower/Upper Profits
   * Limits currently equal Class 1's thresholds by coincidence, not by
   * rule, so a future Budget could move them independently.
   */
  nationalInsuranceClass4: {
    lowerProfitsLimit: number;
    upperProfitsLimit: number;
    bands: TaxBand[]; // 6%/2% — roughly a quarter lower than Class 1's rate
  };

  /**
   * Class 2 NI has no calculation to speak of since the 2024/25
   * abolition — above the Small Profits Threshold it's £0 and simply
   * "treated as paid" for state pension purposes; below it, it's an
   * optional flat weekly amount. Kept here purely for the informational
   * note shown in results, not as a deduction.
   */
  selfEmployedClass2: {
    smallProfitsThreshold: number;
    voluntaryWeeklyRate: number;
  };

  /**
   * High Income Child Benefit Charge (ITEPA 2003 s681B onwards).
   * Thresholds unchanged since the April 2024 reform. Charged on
   * whichever partner has the higher adjusted net income — this app
   * only ever models one taxpayer, so it simply asks how much Child
   * Benefit *this* taxpayer's household received and assumes they're
   * the higher earner if they choose to enter anything here.
   */
  hicbc: {
    thresholdStart: number; // charge begins here
    thresholdFull: number; // 100% of Child Benefit clawed back here
  };

  /**
   * Student loan repayment thresholds, per plan. Rates are stable
   * (9% undergraduate, 6% postgraduate) but kept configurable here
   * too, since nothing about this app should assume a rate never
   * changes. Plan 3 is commonly branded "Postgraduate Loan".
   */
  studentLoan: {
    thresholds: {
      plan1: number;
      plan2: number;
      plan4: number; // Scotland
      plan5: number;
      postgraduate: number;
    };
    undergraduateRate: number; // 0.09 — applies to plans 1/2/4/5
    postgraduateRate: number; // 0.06
  };

  /** Flat amount transferable between spouses/civil partners — 10% of the Personal Allowance, rounded up to the nearest £10. */
  marriageAllowanceTransferable: number;

  updatedAt?: Date;
}

export interface RentalExpenseItem {
  category: string;
  amount: number;
}

export interface MultiIncomeInput {
  employmentIncome?: number;
  pensionIncome?: number;
  rentalIncome?: number;
  rentalExpenses?: RentalExpenseItem[];
  rentalLossBroughtForward?: number; // per PIM4210: relieved against this year's rental profit first
  mortgageInterest?: number;
  financeCostsBroughtForward?: number; // per PIM4460: added to this year's interest before the 3-way cap
  selfEmploymentProfit?: number;
  selfEmploymentExpenses?: RentalExpenseItem[];
  selfEmploymentLossBroughtForward?: number; // per ITA07/s83: relieved against this year's trading profit first
  savingsInterest?: number;
  dividendIncome?: number;
  foreignTaxWithheldOnDividends?: number;
  capitalGains?: number;
  capitalLossesThisYear?: number; // must be set against this year's gains in full — no choice
  capitalLossesBroughtForward?: number; // only used down to the level of the AEA — see CG21520

  /**
   * The NET amount actually paid into a "relief at source" pension
   * (most personal pensions/SIPPs, some workplace schemes) — NOT
   * "net pay arrangement" contributions, which are deducted from pay
   * before tax and are therefore already reflected in employmentIncome.
   * Grossed up by /0.8 internally (basic-rate relief is added
   * automatically) and used to extend the basic/higher-rate bands.
   */
  personalPensionContributions?: number;
  /** The NET amount actually donated under Gift Aid — same /0.8 gross-up and band-extension mechanism as pension contributions above. */
  giftAidDonations?: number;

  /**
   * Private Residence Relief (TCGA 1992 s222-226): a gain from selling
   * a property that was the owner's only or main home for the ENTIRE
   * period of ownership is fully exempt from CGT — no annual exempt
   * amount needed, it simply isn't a chargeable gain at all. Only that
   * clean, full-relief case is modelled; partial relief (a let period,
   * a period of non-qualifying absence, business use of part of the
   * home) is a materially harder calculation and isn't attempted —
   * mainResidenceFullyExempt must be explicitly true for any relief
   * to apply, and mainResidenceGain is otherwise folded into ordinary
   * capitalGains as a ordinary, fully taxable gain.
   */
  mainResidenceGain?: number;
  mainResidenceFullyExempt?: boolean;

  /** Total Child Benefit received this tax year — entered directly rather than derived from a number of children, since per-child weekly rates change yearly. */
  childBenefitReceived?: number;

  studentLoanPlan?: "none" | "plan1" | "plan2" | "plan4" | "plan5";
  hasPostgraduateLoan?: boolean;

  /** True if this taxpayer is the RECIPIENT of a Marriage Allowance transfer from a spouse/civil partner — the app has no way to verify the transferring partner's own eligibility. */
  receivingMarriageAllowance?: boolean;
}

export interface BandBreakdown {
  from: number;
  to: number | null;
  rate: number;
  taxable: number;
  tax: number;
}

export interface IncomeStreamResult {
  gross: number;
  allowanceUsed: number;
  zeroRateAmount: number; // covered by starting rate / PSA / dividend allowance
  taxableAmount: number;
  tax: number;
  bands: BandBreakdown[];
}

export interface CalculationResult {
  taxYear: string;
  region: "uk" | "scotland";
  personalAllowance: number;

  nonSavings: IncomeStreamResult & {
    employmentGross: number;
    pensionGross: number;
    rentalGross: number;
    propertyAllowanceApplied: number;
    rentalExpensesTotal: number;
    rentalDeductionMethod: "allowance" | "expenses" | "none";
    rentalDeductionApplied: number;
    rentalLossBroughtForward: number;
    rentalLossReliefApplied: number; // brought-forward loss actually used against this year's profit
    rentalLossCarriedForward: number; // unused loss (brought-forward + any new loss) to enter next year
    selfEmploymentGross: number;
    tradingAllowanceApplied: number;
    selfEmploymentExpensesTotal: number;
    selfEmploymentDeductionMethod: "allowance" | "expenses" | "none";
    selfEmploymentDeductionApplied: number;
    selfEmploymentLossBroughtForward: number;
    selfEmploymentLossReliefApplied: number;
    selfEmploymentLossCarriedForward: number;
  };
  savings: IncomeStreamResult & { startingRateAmount: number; psaAmount: number };
  dividends: IncomeStreamResult & {
    foreignTaxWithheld: number;
    foreignTaxCredit: number; // lesser of withheld tax and UK tax due on the dividend slice
  };
  capitalGainsTax: {
    gross: number;
    otherCapitalGains: number;
    mainResidenceGain: number;
    mainResidenceExempt: boolean;
    mainResidenceExemptAmount: number; // 0 unless mainResidenceExempt is true
    lossesThisYear: number;
    netGainsAfterCurrentYearLosses: number;
    annualExemptAmount: number;
    broughtForwardLossAvailable: number;
    broughtForwardLossUsed: number;
    lossesCarriedForward: number;
    taxableGain: number;
    tax: number;
    bands: BandBreakdown[];
  };

  nationalInsurance: { total: number; bands: BandBreakdown[] }; // Class 1, employment only

  nationalInsuranceClass4: { total: number; bands: BandBreakdown[] };
  class2: {
    profit: number;
    smallProfitsThreshold: number;
    treatedAsPaid: boolean; // true once profit clears the Small Profits Threshold
    voluntaryWeeklyRate: number;
    voluntaryAnnualAmount: number; // informational only — not included in totals
  };

  mortgageInterestRelief: {
    interestPaid: number;
    financeCostsBroughtForward: number;
    reliefRate: number;
    reducerBase: number; // lowest of (interest + brought forward) / property profit / income above PA
    credit: number; // reducerBase * reliefRate, subtracted from the tax bill
    financeCostsCarriedForward: number; // unused finance costs to enter next year
  };

  totalGrossIncome: number; // employment + rental + savings + dividends (excludes CGT)
  totalIncomeTax: number;
  totalDeductions: number; // income tax + NI + CGT
  netIncome: number; // total gross income + gains, minus all deductions
  effectiveTaxRate: number;

  reliefAtSource: {
    personalPensionContributionsNet: number;
    personalPensionContributionsGross: number;
    giftAidDonationsNet: number;
    giftAidDonationsGross: number;
    bandExtension: number; // total amount every band above the first was widened by
    // Higher/additional-rate relief this pension contribution unlocks,
    // on top of the 20% the provider already added automatically —
    // see the comment above its calculation for exactly what it
    // compares. £0 for a basic-rate taxpayer: correct, not a bug —
    // there's nothing further for them to claim.
    additionalPensionRelief: number;
  };

  hicbc: {
    childBenefitReceived: number;
    adjustedNetIncome: number;
    charge: number;
    percentageClawedBack: number; // 0-100, informational
  };

  studentLoan: {
    plan: "none" | "plan1" | "plan2" | "plan4" | "plan5";
    threshold: number; // 0 if plan is "none"
    undergraduateRepayment: number;
    hasPostgraduateLoan: boolean;
    postgraduateThreshold: number;
    postgraduateRepayment: number;
    totalRepayment: number;
  };

  marriageAllowance: {
    requested: boolean;
    amountTransferred: number; // 0 unless requested
    recipientAppearsEligible: boolean; // false if this taxpayer's own income looks too high to actually qualify
  };
}

/** £1 of personal allowance lost per £2 of income over £100,000. */
function taperedPersonalAllowance(totalIncome: number, basePA: number): number {
  const TAPER_START = 100_000;
  if (totalIncome <= TAPER_START) return basePA;
  const reduction = Math.floor((totalIncome - TAPER_START) / 2);
  return Math.max(0, basePA - reduction);
}

/**
 * Taxes a slice of income that sits between [positionStart, positionStart + sliceAmount)
 * on an absolute income scale, against a set of absolute-threshold bands.
 * Used to stack non-savings -> savings -> dividends against shared £37,700 /
 * £125,140 boundaries, each continuing where the previous stream left off.
 */
function walkBands(
  sliceAmount: number,
  positionStart: number,
  bands: TaxBand[]
): { tax: number; breakdown: BandBreakdown[] } {
  if (sliceAmount <= 0) return { tax: 0, breakdown: [] };

  const sorted = [...bands].sort((a, b) => a.threshold - b.threshold);
  const positionEnd = positionStart + sliceAmount;
  let tax = 0;
  const breakdown: BandBreakdown[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const bandStart = sorted[i].threshold;
    const bandEnd = i + 1 < sorted.length ? sorted[i + 1].threshold : Infinity;
    const overlapStart = Math.max(bandStart, positionStart);
    const overlapEnd = Math.min(bandEnd, positionEnd);
    const taxable = Math.max(0, overlapEnd - overlapStart);
    if (taxable <= 0) continue;

    const bandTax = taxable * sorted[i].rate;
    tax += bandTax;
    breakdown.push({
      from: overlapStart,
      to: bandEnd === Infinity ? null : bandEnd,
      rate: sorted[i].rate,
      taxable,
      tax: bandTax,
    });
  }

  return { tax, breakdown };
}

/**
 * Relief-at-source pension contributions and Gift Aid donations extend
 * the basic-rate band (and, correspondingly, every band above it) by
 * their GROSS amount — this is how higher/additional-rate taxpayers get
 * relief beyond the 20% already added automatically at source. Applies
 * uniformly to income tax, savings, dividend AND capital gains bands
 * (all of them ultimately measure position against the same basic/
 * higher-rate boundary), but never to the first band — its floor is
 * always 0, extension only pushes every threshold ABOVE that upward.
 */
function extendBands(bands: TaxBand[], extension: number): TaxBand[] {
  if (extension <= 0) return bands;
  return bands.map((band, i) =>
    i === 0 ? band : { ...band, threshold: band.threshold + extension }
  );
}

/**
 * HMRC bases the size of the Personal Savings Allowance on the
 * taxpayer's overall marginal rate for the year — determined by TOTAL
 * gross income across all sources (non-savings + savings + dividends),
 * not just where the running band-walk position happens to sit at the
 * moment savings income is being processed. A taxpayer whose salary and
 * savings alone would stay basic-rate can still be pushed into the
 * £500 (or £0) PSA band purely by dividend income stacking on top —
 * confirmed against LITRG's published worked examples.
 */
function personalSavingsAllowanceForTotalIncome(
  totalGrossIncome: number,
  personalAllowance: number,
  savingsBands: TaxBand[],
  savingsAllowance: TaxYearRates["savingsAllowance"]
): number {
  const higherThreshold = personalAllowance + (savingsBands[1]?.threshold ?? 37_700);
  const additionalThreshold = personalAllowance + (savingsBands[2]?.threshold ?? 125_140);
  if (totalGrossIncome > additionalThreshold) return 0;
  if (totalGrossIncome > higherThreshold) return savingsAllowance.higherRate;
  return savingsAllowance.basicRate;
}

export function calculateMultiIncomeTax(
  input: MultiIncomeInput,
  rates: TaxYearRates,
  // Internal use only — true on the recursive "what if this pension
  // contribution hadn't been made" comparison run below, so that run
  // doesn't try to compute a comparison of its own and recurse forever.
  _skipPensionReliefComparison = false
): CalculationResult {
  const employmentIncome = Math.max(0, input.employmentIncome ?? 0);
  const pensionIncome = Math.max(0, input.pensionIncome ?? 0);
  const rentalIncomeGross = Math.max(0, input.rentalIncome ?? 0);
  const selfEmploymentProfitGross = Math.max(0, input.selfEmploymentProfit ?? 0);
  const savingsInterest = Math.max(0, input.savingsInterest ?? 0);
  const dividendIncome = Math.max(0, input.dividendIncome ?? 0);
  const foreignTaxWithheldOnDividends = Math.max(0, input.foreignTaxWithheldOnDividends ?? 0);
  const otherCapitalGains = Math.max(0, input.capitalGains ?? 0);

  // --- Private Residence Relief (TCGA 1992 s222-226): a gain that
  // qualifies for full relief isn't a chargeable gain at all — it never
  // enters the CGT calculation, no annual exempt amount is "spent" on
  // it. If it DOESN'T fully qualify, this app makes no attempt at a
  // partial-relief calculation (a materially harder computation
  // involving qualifying/non-qualifying periods of ownership) and
  // instead treats the whole gain as an ordinary chargeable gain — a
  // deliberately conservative (likely-to-overstate-tax) fallback rather
  // than a silent underestimate.
  const mainResidenceGain = Math.max(0, input.mainResidenceGain ?? 0);
  const mainResidenceExempt = Boolean(input.mainResidenceFullyExempt) && mainResidenceGain > 0;
  const mainResidenceExemptAmount = mainResidenceExempt ? mainResidenceGain : 0;
  const mainResidenceChargeable = mainResidenceExempt ? 0 : mainResidenceGain;

  const capitalGainsGross = otherCapitalGains + mainResidenceChargeable;

  // --- Relief-at-source pension contributions & Gift Aid: gross up the
  // net amount actually paid (basic-rate relief is added automatically,
  // by the pension provider or the charity respectively) and use the
  // combined gross figure to extend every band above the basic rate —
  // this is how higher/additional-rate taxpayers get the rest of their
  // relief. See the MultiIncomeInput comments for the net-pay-arrangement
  // distinction that determines whether a pension contribution belongs
  // here at all.
  const personalPensionContributionsNet = Math.max(
    0,
    input.personalPensionContributions ?? 0
  );
  const personalPensionContributionsGross = personalPensionContributionsNet / 0.8;
  const giftAidDonationsNet = Math.max(0, input.giftAidDonations ?? 0);
  const giftAidDonationsGross = giftAidDonationsNet / 0.8;
  const bandExtension = personalPensionContributionsGross + giftAidDonationsGross;

  const incomeTaxBands = extendBands(rates.incomeTaxBands, bandExtension);
  const savingsBands = extendBands(rates.savingsBands, bandExtension);
  const dividendBands = extendBands(rates.dividendBands, bandExtension);
  const capitalGainsBands = extendBands(rates.capitalGains.bands, bandExtension);

  // --- Rental: use whichever is worth more, the flat £1,000 property
  // allowance or the sum of itemized allowable expenses (HMRC lets
  // landlords choose either, never both). Mortgage interest is
  // deliberately excluded from itemized expenses — since 2020/21 it's
  // relieved as a 20% tax credit against the final bill, not a
  // deduction from rental profit (see the finance-cost section below).
  const rentalExpensesTotal = (input.rentalExpenses ?? []).reduce(
    (sum, item) => sum + Math.max(0, item.amount || 0),
    0
  );
  const useItemizedExpenses = rentalExpensesTotal > rates.propertyAllowance;
  // The £1,000 allowance can never exceed income or create a loss, but
  // itemized expenses genuinely can — that's precisely what generates a
  // rental loss under PIM4210, so only the allowance route is capped here.
  const rentalDeductionApplied = useItemizedExpenses
    ? rentalExpensesTotal
    : Math.min(rentalIncomeGross, rates.propertyAllowance);
  const rentalDeductionMethod: "allowance" | "expenses" | "none" =
    rentalIncomeGross === 0
      ? "none"
      : useItemizedExpenses
      ? "expenses"
      : "allowance";

  // Per PIM4210: any loss brought forward is deducted first, before this
  // year's profit becomes chargeable. If this year is itself a loss (or
  // the brought-forward loss exceeds this year's profit), the shortfall
  // simply carries forward again — indefinitely, with no special claim
  // needed and no expiry.
  const rentalLossBroughtForward = Math.max(0, input.rentalLossBroughtForward ?? 0);
  const rentalNetBeforeLossRelief = rentalIncomeGross - rentalDeductionApplied;

  let taxableRental: number;
  let rentalLossReliefApplied: number;
  let rentalLossCarriedForward: number;

  if (rentalNetBeforeLossRelief >= 0) {
    rentalLossReliefApplied = Math.min(rentalNetBeforeLossRelief, rentalLossBroughtForward);
    taxableRental = rentalNetBeforeLossRelief - rentalLossReliefApplied;
    rentalLossCarriedForward = rentalLossBroughtForward - rentalLossReliefApplied;
  } else {
    // This year is itself a loss — nothing to relieve against, so the
    // new loss simply adds to whatever was already brought forward.
    rentalLossReliefApplied = 0;
    taxableRental = 0;
    rentalLossCarriedForward = rentalLossBroughtForward + Math.abs(rentalNetBeforeLossRelief);
  }

  // --- Self-employment: same allowance-vs-itemized-expenses pattern as
  // rental, but with the £1,000 trading allowance instead of the
  // property allowance, and no mortgage-interest-style special case.
  const selfEmploymentExpensesTotal = (input.selfEmploymentExpenses ?? []).reduce(
    (sum, item) => sum + Math.max(0, item.amount || 0),
    0
  );
  const useItemizedSelfEmploymentExpenses =
    selfEmploymentExpensesTotal > rates.tradingAllowance;
  // Same fix as rental: the £1,000 trading allowance can't exceed income
  // or create a loss, but itemized expenses genuinely can — that's what
  // generates a trading loss under ITA 2007 s83.
  const selfEmploymentDeductionApplied = useItemizedSelfEmploymentExpenses
    ? selfEmploymentExpensesTotal
    : Math.min(selfEmploymentProfitGross, rates.tradingAllowance);
  const selfEmploymentDeductionMethod: "allowance" | "expenses" | "none" =
    selfEmploymentProfitGross === 0
      ? "none"
      : useItemizedSelfEmploymentExpenses
      ? "expenses"
      : "allowance";

  // Per ITA 2007 s83 / BIM85060: a trading loss brought forward is set
  // off against the first available profit of the same trade, exactly
  // like the rental loss mechanism above — deducted first, any leftover
  // (this year's or the whole thing, if this year is also a loss) carries
  // forward again indefinitely.
  const selfEmploymentLossBroughtForward = Math.max(
    0,
    input.selfEmploymentLossBroughtForward ?? 0
  );
  const selfEmploymentNetBeforeLossRelief =
    selfEmploymentProfitGross - selfEmploymentDeductionApplied;

  let taxableSelfEmployment: number;
  let selfEmploymentLossReliefApplied: number;
  let selfEmploymentLossCarriedForward: number;

  if (selfEmploymentNetBeforeLossRelief >= 0) {
    selfEmploymentLossReliefApplied = Math.min(
      selfEmploymentNetBeforeLossRelief,
      selfEmploymentLossBroughtForward
    );
    taxableSelfEmployment = selfEmploymentNetBeforeLossRelief - selfEmploymentLossReliefApplied;
    selfEmploymentLossCarriedForward =
      selfEmploymentLossBroughtForward - selfEmploymentLossReliefApplied;
  } else {
    selfEmploymentLossReliefApplied = 0;
    taxableSelfEmployment = 0;
    selfEmploymentLossCarriedForward =
      selfEmploymentLossBroughtForward + Math.abs(selfEmploymentNetBeforeLossRelief);
  }

  const nonSavingsIncome =
    employmentIncome + pensionIncome + taxableRental + taxableSelfEmployment;

  // --- Marriage Allowance: a flat amount added to the RECIPIENT's own
  // Personal Allowance. This app only ever models one taxpayer, so it
  // can't verify the transferring spouse's own eligibility (broadly,
  // that they have unused allowance themselves) — that's flagged in the
  // UI, not checked here. What this function DOES check afterwards is
  // whether the recipient's own income looks too high to actually
  // qualify as a basic-rate taxpayer; see recipientAppearsEligible below.
  const marriageAllowanceRequested = Boolean(input.receivingMarriageAllowance);
  const marriageAllowanceAmount = marriageAllowanceRequested
    ? rates.marriageAllowanceTransferable
    : 0;

  // --- Personal allowance (tapered on adjusted net income: total income
  // across all streams except gains, less grossed-up pension
  // contributions and Gift Aid — same "adjusted net income" measure also
  // used below for the Personal Savings Allowance tier test AND for the
  // High Income Child Benefit Charge further down) ---
  const totalIncomeForTaper = Math.max(
    0,
    nonSavingsIncome + savingsInterest + dividendIncome - bandExtension
  );
  const personalAllowance = taperedPersonalAllowance(
    totalIncomeForTaper,
    rates.personalAllowance + marriageAllowanceAmount
  );

  let allowanceLeft = personalAllowance;

  // --- 1. Non-savings, non-dividend income (uses region-specific bands) ---
  const paForNonSavings = Math.min(allowanceLeft, nonSavingsIncome);
  allowanceLeft -= paForNonSavings;
  const taxableNonSavings = nonSavingsIncome - paForNonSavings;

  const nonSavingsResult = walkBands(taxableNonSavings, 0, incomeTaxBands);
  let position = taxableNonSavings; // position on the (possibly extended) £37,700/£125,140 scale

  // --- 2. Savings interest (always rUK bands, regardless of region) ---
  const paForSavings = Math.min(allowanceLeft, savingsInterest);
  allowanceLeft -= paForSavings;
  const savingsAfterPA = savingsInterest - paForSavings;

  const startingRateAvailable = Math.max(
    0,
    rates.savingsAllowance.startingRateBand - taxableNonSavings
  );
  const savingsAtStartingRate = Math.min(savingsAfterPA, startingRateAvailable);
  let savingsRemaining = savingsAfterPA - savingsAtStartingRate;

  const psaLimit = personalSavingsAllowanceForTotalIncome(
    totalIncomeForTaper,
    personalAllowance,
    savingsBands,
    rates.savingsAllowance
  );
  const savingsAtPSA = Math.min(savingsRemaining, psaLimit);
  savingsRemaining -= savingsAtPSA;

  const savingsZeroAmount = savingsAtStartingRate + savingsAtPSA;
  const savingsTaxed = walkBands(
    savingsRemaining,
    position + savingsZeroAmount,
    savingsBands
  );
  position += savingsAfterPA;

  // --- 3. Dividends (always rUK bands, regardless of region) ---
  const paForDividends = Math.min(allowanceLeft, dividendIncome);
  allowanceLeft -= paForDividends;
  const dividendsAfterPA = dividendIncome - paForDividends;

  const dividendsAtAllowance = Math.min(dividendsAfterPA, rates.dividendAllowance);
  const dividendsRemaining = dividendsAfterPA - dividendsAtAllowance;

  const dividendsTaxed = walkBands(
    dividendsRemaining,
    position + dividendsAtAllowance,
    dividendBands
  );
  position += dividendsAfterPA;

  // Foreign Tax Credit Relief (HS263): the credit is always the SMALLER of
  // the foreign tax paid and the UK tax actually due on that same income —
  // it can reduce the dividend tax to zero but never create a refund, and
  // any excess (e.g. 30% withheld instead of the 15% US treaty rate because
  // no W-8BEN was filed) simply isn't creditable and is lost.
  const dividendForeignTaxCredit = Math.min(
    foreignTaxWithheldOnDividends,
    dividendsTaxed.tax
  );

  // --- 4. Capital Gains Tax: separate from income tax, uses remaining basic-rate band ---
  //
  // Per HMRC's Capital Gains Manual (CG21520, confirmed against the
  // official "Mr D" worked example):
  //   1. Current-year losses MUST be set against current-year gains in
  //      full — no choice about it.
  //   2. The Annual Exempt Amount is then deducted from what's left.
  //   3. ONLY if a chargeable amount still remains after the AEA are
  //      brought-forward losses used — and only down to the level of
  //      the AEA, never below it. This deliberately preserves as much
  //      of a brought-forward loss as possible for future years, since
  //      (unlike the AEA itself) losses never expire.
  const capitalLossesThisYear = Math.max(0, input.capitalLossesThisYear ?? 0);
  const capitalLossesBroughtForward = Math.max(
    0,
    input.capitalLossesBroughtForward ?? 0
  );

  const netGainsAfterCurrentYearLosses = Math.max(
    0,
    capitalGainsGross - capitalLossesThisYear
  );
  // If this year's losses exceed this year's gains, the excess becomes a
  // brand new loss to carry forward — same shape as every other
  // carry-forward mechanism already in this file.
  const excessCurrentYearLoss = Math.max(
    0,
    capitalLossesThisYear - capitalGainsGross
  );

  let taxableGainBeforeBands: number;
  let broughtForwardLossUsed: number;

  if (netGainsAfterCurrentYearLosses <= rates.capitalGains.annualExemptAmount) {
    // The AEA alone already covers everything — brought-forward losses
    // aren't touched at all, exactly as CG21520 Example 1 illustrates.
    taxableGainBeforeBands = 0;
    broughtForwardLossUsed = 0;
  } else {
    const amountAboveAEA =
      netGainsAfterCurrentYearLosses - rates.capitalGains.annualExemptAmount;
    broughtForwardLossUsed = Math.min(capitalLossesBroughtForward, amountAboveAEA);
    taxableGainBeforeBands = amountAboveAEA - broughtForwardLossUsed;
  }

  const lossesCarriedForward =
    capitalLossesBroughtForward - broughtForwardLossUsed + excessCurrentYearLoss;

  const cgtResult = walkBands(taxableGainBeforeBands, position, capitalGainsBands);

  // --- 5. Mortgage interest relief (Section 24): a flat-rate tax credit,
  // never a deduction from rental profit — same rate for every tax band.
  // Per PIM4460, any unused finance costs from earlier years are simply
  // added to this year's interest before applying the same 3-way cap:
  // the lowest of (interest paid + brought forward), the rental profit
  // itself, and total taxable income above the personal allowance.
  // Whatever's still unused after that carries forward again.
  const interestPaid = Math.max(0, input.mortgageInterest ?? 0);
  const financeCostsBroughtForward = Math.max(0, input.financeCostsBroughtForward ?? 0);
  const totalFinanceCosts = interestPaid + financeCostsBroughtForward;
  const mortgageReducerBase = Math.min(totalFinanceCosts, taxableRental, position);
  const mortgageInterestCredit = mortgageReducerBase * rates.mortgageInterestReliefRate;
  const financeCostsCarriedForward = totalFinanceCosts - mortgageReducerBase;

  // --- 6. National Insurance: employment income only ---
  const niBands: TaxBand[] = [
    {
      threshold: rates.nationalInsurance.primaryThreshold,
      rate: rates.nationalInsurance.bands[0]?.rate ?? 0,
    },
    {
      threshold: rates.nationalInsurance.upperEarningsLimit,
      rate: rates.nationalInsurance.bands[1]?.rate ?? 0,
    },
  ];
  const niTaxable = Math.max(0, employmentIncome - rates.nationalInsurance.primaryThreshold);
  const niResult = walkBands(
    niTaxable,
    rates.nationalInsurance.primaryThreshold,
    niBands
  );

  // --- 7. Class 4 NI: self-employment profit only, separate from Class 1.
  // Note: HMRC caps combined Class 1 + Class 4 liability via an "annual
  // maximum" for anyone with both employment and self-employment income
  // in the same year — that interaction isn't modelled here, so someone
  // with significant employment income too may see a slightly higher
  // Class 4 figure than their actual Self Assessment bill.
  const class4Bands: TaxBand[] = [
    {
      threshold: rates.nationalInsuranceClass4.lowerProfitsLimit,
      rate: rates.nationalInsuranceClass4.bands[0]?.rate ?? 0,
    },
    {
      threshold: rates.nationalInsuranceClass4.upperProfitsLimit,
      rate: rates.nationalInsuranceClass4.bands[1]?.rate ?? 0,
    },
  ];
  const class4Taxable = Math.max(
    0,
    taxableSelfEmployment - rates.nationalInsuranceClass4.lowerProfitsLimit
  );
  const class4Result = walkBands(
    class4Taxable,
    rates.nationalInsuranceClass4.lowerProfitsLimit,
    class4Bands
  );

  // --- 8. Class 2 NI: no calculation — just an informational note (see schema comment) ---
  const class2TreatedAsPaid =
    taxableSelfEmployment >= rates.selfEmployedClass2.smallProfitsThreshold;
  const class2VoluntaryAnnualAmount = rates.selfEmployedClass2.voluntaryWeeklyRate * 52;

  // --- 9. High Income Child Benefit Charge: uses the same "adjusted net
  // income" measure as the Personal Allowance taper above — total income
  // across all streams except gains, less grossed-up pension/Gift Aid.
  // Tapers linearly from £60,000 to £80,000, 1% of Child Benefit
  // received per £200 of income above the threshold.
  const childBenefitReceived = Math.max(0, input.childBenefitReceived ?? 0);
  const hicbcAdjustedNetIncome = totalIncomeForTaper;
  let hicbcCharge = 0;
  if (childBenefitReceived > 0 && hicbcAdjustedNetIncome > rates.hicbc.thresholdStart) {
    const taperWidth = rates.hicbc.thresholdFull - rates.hicbc.thresholdStart;
    const amountIntoTaper = Math.min(
      hicbcAdjustedNetIncome - rates.hicbc.thresholdStart,
      taperWidth
    );
    const percentageClawedBack = amountIntoTaper / taperWidth; // 0 to 1
    hicbcCharge = childBenefitReceived * percentageClawedBack;
  }
  const hicbcPercentageClawedBack =
    childBenefitReceived > 0 ? Math.min(100, (hicbcCharge / childBenefitReceived) * 100) : 0;

  // --- 10. Student loan repayments: modelled on the same adjusted-net-
  // income measure as HICBC/the PA taper above — a reasonable, but not
  // HMRC-verified, choice given genuine ambiguity in how this app's
  // "total income" concept maps onto the SA302 student loan calculation.
  // Only one undergraduate plan can be selected at a time, avoiding the
  // "lowest threshold of several plans" edge case entirely. A
  // Postgraduate Loan can run alongside any undergraduate plan.
  const studentLoanPlan = input.studentLoanPlan ?? "none";
  const studentLoanThreshold =
    studentLoanPlan === "none" ? 0 : rates.studentLoan.thresholds[studentLoanPlan];
  const undergraduateRepayment =
    studentLoanPlan === "none"
      ? 0
      : Math.max(0, totalIncomeForTaper - studentLoanThreshold) *
        rates.studentLoan.undergraduateRate;
  const hasPostgraduateLoan = Boolean(input.hasPostgraduateLoan);
  const postgraduateRepayment = hasPostgraduateLoan
    ? Math.max(0, totalIncomeForTaper - rates.studentLoan.thresholds.postgraduate) *
      rates.studentLoan.postgraduateRate
    : 0;
  const totalStudentLoanRepayment = undergraduateRepayment + postgraduateRepayment;

  // --- 11. Marriage Allowance eligibility check: the recipient must not
  // be a higher/additional-rate taxpayer. `position` here is this
  // taxpayer's own taxable income after all income-tax stacking — if it
  // reaches the higher-rate threshold of their own (possibly
  // pension/Gift-Aid-extended) bands, they wouldn't actually qualify to
  // RECEIVE a transfer in real life, regardless of what this app just
  // calculated using it. Flagged as a warning, not auto-corrected.
  const higherRateBandIndex = incomeTaxBands.length >= 6 ? 3 : 1; // Scotland: 42% is band index 3; rUK: 40% is band index 1
  const higherRateThreshold = incomeTaxBands[higherRateBandIndex]?.threshold ?? Infinity;
  // HMRC's test is the recipient's income BEFORE the transfer (£50,270 or
  // less in rUK) — `position` above already includes the extra allowance,
  // so add the transferred amount back to test on the same footing.
  const marriageAllowanceRecipientAppearsEligible =
    !marriageAllowanceRequested ||
    position + marriageAllowanceAmount <= higherRateThreshold;

  const incomeTaxBeforeRelief =
    nonSavingsResult.tax + savingsTaxed.tax + dividendsTaxed.tax;
  const totalIncomeTax = Math.max(
    0,
    incomeTaxBeforeRelief - mortgageInterestCredit - dividendForeignTaxCredit
  );
  const totalGrossIncome =
    employmentIncome +
    pensionIncome +
    rentalIncomeGross +
    selfEmploymentProfitGross +
    savingsInterest +
    dividendIncome;
  const totalDeductions =
    totalIncomeTax +
    niResult.tax +
    class4Result.tax +
    cgtResult.tax +
    hicbcCharge +
    totalStudentLoanRepayment;
  const netIncome =
    totalGrossIncome + netGainsAfterCurrentYearLosses - totalDeductions;
  const effectiveTaxRate =
    totalGrossIncome + netGainsAfterCurrentYearLosses > 0
      ? totalDeductions / (totalGrossIncome + netGainsAfterCurrentYearLosses)
      : 0;

  const result: CalculationResult = {
    taxYear: rates.taxYear,
    region: rates.region,
    personalAllowance,

    nonSavings: {
      gross: nonSavingsIncome,
      employmentGross: employmentIncome,
      pensionGross: pensionIncome,
      rentalGross: rentalIncomeGross,
      propertyAllowanceApplied: rentalDeductionMethod === "allowance" ? rentalDeductionApplied : 0,
      rentalExpensesTotal,
      rentalDeductionMethod,
      rentalDeductionApplied,
      rentalLossBroughtForward,
      rentalLossReliefApplied,
      rentalLossCarriedForward,
      selfEmploymentGross: selfEmploymentProfitGross,
      tradingAllowanceApplied:
        selfEmploymentDeductionMethod === "allowance" ? selfEmploymentDeductionApplied : 0,
      selfEmploymentExpensesTotal,
      selfEmploymentDeductionMethod,
      selfEmploymentDeductionApplied,
      selfEmploymentLossBroughtForward,
      selfEmploymentLossReliefApplied,
      selfEmploymentLossCarriedForward,
      allowanceUsed: paForNonSavings,
      zeroRateAmount: rentalDeductionApplied + selfEmploymentDeductionApplied,
      taxableAmount: taxableNonSavings,
      tax: nonSavingsResult.tax,
      bands: nonSavingsResult.breakdown,
    },
    savings: {
      gross: savingsInterest,
      allowanceUsed: paForSavings,
      zeroRateAmount: savingsZeroAmount,
      startingRateAmount: savingsAtStartingRate,
      psaAmount: savingsAtPSA,
      taxableAmount: savingsRemaining,
      tax: savingsTaxed.tax,
      bands: savingsTaxed.breakdown,
    },
    dividends: {
      gross: dividendIncome,
      allowanceUsed: paForDividends,
      zeroRateAmount: dividendsAtAllowance,
      taxableAmount: dividendsRemaining,
      tax: dividendsTaxed.tax,
      bands: dividendsTaxed.breakdown,
      foreignTaxWithheld: foreignTaxWithheldOnDividends,
      foreignTaxCredit: dividendForeignTaxCredit,
    },
    capitalGainsTax: {
      gross: capitalGainsGross,
      otherCapitalGains,
      mainResidenceGain,
      mainResidenceExempt,
      mainResidenceExemptAmount,
      lossesThisYear: capitalLossesThisYear,
      netGainsAfterCurrentYearLosses,
      annualExemptAmount: Math.min(
        netGainsAfterCurrentYearLosses,
        rates.capitalGains.annualExemptAmount
      ),
      broughtForwardLossAvailable: capitalLossesBroughtForward,
      broughtForwardLossUsed,
      lossesCarriedForward,
      taxableGain: taxableGainBeforeBands,
      tax: cgtResult.tax,
      bands: cgtResult.breakdown,
    },

    nationalInsurance: { total: niResult.tax, bands: niResult.breakdown },

    nationalInsuranceClass4: { total: class4Result.tax, bands: class4Result.breakdown },
    class2: {
      profit: taxableSelfEmployment,
      smallProfitsThreshold: rates.selfEmployedClass2.smallProfitsThreshold,
      treatedAsPaid: class2TreatedAsPaid,
      voluntaryWeeklyRate: rates.selfEmployedClass2.voluntaryWeeklyRate,
      voluntaryAnnualAmount: class2VoluntaryAnnualAmount,
    },

    mortgageInterestRelief: {
      interestPaid,
      financeCostsBroughtForward,
      reliefRate: rates.mortgageInterestReliefRate,
      reducerBase: mortgageReducerBase,
      credit: mortgageInterestCredit,
      financeCostsCarriedForward,
    },

    totalGrossIncome,
    totalIncomeTax,
    totalDeductions,
    netIncome,
    effectiveTaxRate,

    reliefAtSource: {
      personalPensionContributionsNet,
      personalPensionContributionsGross,
      giftAidDonationsNet,
      giftAidDonationsGross,
      bandExtension,
      additionalPensionRelief: 0, // placeholder — set for real just below, once `result` exists to compare against
    },

    hicbc: {
      childBenefitReceived,
      adjustedNetIncome: hicbcAdjustedNetIncome,
      charge: hicbcCharge,
      percentageClawedBack: hicbcPercentageClawedBack,
    },

    studentLoan: {
      plan: studentLoanPlan,
      threshold: studentLoanThreshold,
      undergraduateRepayment,
      hasPostgraduateLoan,
      postgraduateThreshold: rates.studentLoan.thresholds.postgraduate,
      postgraduateRepayment,
      totalRepayment: totalStudentLoanRepayment,
    },

    marriageAllowance: {
      requested: marriageAllowanceRequested,
      amountTransferred: marriageAllowanceAmount,
      recipientAppearsEligible: marriageAllowanceRecipientAppearsEligible,
    },
  };

  // Additional (higher/additional-rate) pension relief: how much extra
  // comes back beyond the 20% the provider already added automatically.
  // The 20% top-up happens inside the pension wrapper and never appears
  // in this income tax calculation at all — so it's NOT something to
  // subtract out here. The full benefit of the band-widening (income
  // tax, savings, dividends, CGT) plus its knock-on effect on the High
  // Income Child Benefit Charge and student loan repayments (both use
  // the same post-band-extension income figure — see
  // totalIncomeForTaper above) IS the number a higher-rate taxpayer is
  // entitled to claim back, in full.
  //
  // Computed by re-running this same, already-validated calculation
  // with the pension contribution's band-widening removed — comparing
  // tax on identical income with and without it — rather than a
  // second, separately-maintained formula that could drift out of sync
  // with the real one above.
  let additionalPensionRelief = 0;
  if (personalPensionContributionsNet > 0 && !_skipPensionReliefComparison) {
    const withoutPension = calculateMultiIncomeTax(
      { ...input, personalPensionContributions: 0 },
      rates,
      true
    );
    const totalWith =
      result.totalIncomeTax +
      result.capitalGainsTax.tax +
      result.hicbc.charge +
      result.studentLoan.totalRepayment;
    const totalWithout =
      withoutPension.totalIncomeTax +
      withoutPension.capitalGainsTax.tax +
      withoutPension.hicbc.charge +
      withoutPension.studentLoan.totalRepayment;
    additionalPensionRelief = Math.max(0, totalWithout - totalWith);
  }
  result.reliefAtSource.additionalPensionRelief = additionalPensionRelief;

  return result;
}
