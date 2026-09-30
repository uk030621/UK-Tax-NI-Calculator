/**
 * The published HMRC/gov.uk rate data for every seeded tax year and
 * region — the single source of truth read by BOTH `scripts/seed.ts`
 * (which writes it to MongoDB) and `scripts/verify.ts` (which checks the
 * calculation engine against it). Keeping it in one file means the
 * numbers being verified are always exactly the numbers being seeded.
 *
 * These figures are manually sourced — there is no official API for
 * them — so this file needs a yearly update when new rates are
 * announced (typically each Spring/Autumn Budget). Typed as
 * `TaxYearRates[]`, so the compiler flags a document that's missing a
 * field the calculation engine needs.
 *
 * Notes on scope/simplifications:
 * - Savings/dividend bands and CGT are UK-wide (not devolved), so they're
 *   identical between the "uk" and "scotland" documents for a given year —
 *   only `incomeTaxBands` (non-savings income) differs by region.
 * - CGT uses the post-Oct-2024 unified 18%/24% rates (same for property
 *   and other chargeable assets). Business Asset Disposal Relief and
 *   carried interest are not modelled.
 */
import type { TaxYearRates } from "../lib/calculateTax";

const nationalInsurance2025 = {
  primaryThreshold: 12570,
  upperEarningsLimit: 50270,
  bands: [
    { threshold: 12570, rate: 0.08 },
    { threshold: 50270, rate: 0.02 },
  ],
};

// Class 4 (self-employment) NI — same £12,570/£50,270 breakpoints as
// Class 1 for both seeded years, but a lower main rate (6% vs 8%).
const class4NI = {
  lowerProfitsLimit: 12570,
  upperProfitsLimit: 50270,
  bands: [
    { threshold: 12570, rate: 0.06 },
    { threshold: 50270, rate: 0.02 },
  ],
};

// Class 2 (self-employment) — informational only since the 2024/25
// abolition; see the schema comment in calculateTax.ts.
const class2_2025 = { smallProfitsThreshold: 6845, voluntaryWeeklyRate: 3.5 };
const class2_2026 = { smallProfitsThreshold: 7105, voluntaryWeeklyRate: 3.65 };

const tradingAllowance = 1000; // same £1,000 pattern as the property allowance

// High Income Child Benefit Charge — thresholds unchanged since the
// April 2024 reform, stable across both seeded years.
const hicbc = { thresholdStart: 60000, thresholdFull: 80000 };

// Student loan repayment thresholds — Plan 1/2/4 rose for 2026/27;
// Plan 5 and Postgraduate stayed frozen. Rates are stable at 9%/6%.
const studentLoan2025 = {
  thresholds: { plan1: 26065, plan2: 28470, plan4: 32745, plan5: 25000, postgraduate: 21000 },
  undergraduateRate: 0.09,
  postgraduateRate: 0.06,
};
const studentLoan2026 = {
  thresholds: { plan1: 26900, plan2: 29385, plan4: 33795, plan5: 25000, postgraduate: 21000 },
  undergraduateRate: 0.09,
  postgraduateRate: 0.06,
};

// Marriage Allowance — 10% of the Personal Allowance, rounded up to the
// nearest £10. Stable at £1,260 for both seeded years since the PA
// itself has been frozen at £12,570.
const marriageAllowanceTransferable = 1260;

const savingsAllowance = {
  basicRate: 1000,
  higherRate: 500,
  startingRateBand: 5000,
};

// Savings interest bands: always rUK 20/40/45 regardless of region.
const savingsBandsUk = [
  { threshold: 0, rate: 0.2 },
  { threshold: 37700, rate: 0.4 },
  { threshold: 125140, rate: 0.45 },
];

const capitalGains = {
  annualExemptAmount: 3000,
  bands: [
    { threshold: 0, rate: 0.18 },
    { threshold: 37700, rate: 0.24 },
  ],
};

// Scottish bands, converted from gov.scot's published GROSS income
// boundaries to taxable-income thresholds (gross − £12,570 personal
// allowance), per band. Source: gov.scot/publications/scottish-income-
// tax-rates-and-bands — Starter/Basic/Intermediate widened for 2026/27;
// Higher/Advanced/Top boundaries unchanged between the two years. Note
// the Advanced→Top boundary is taxable income £112,570 (gross £125,140)
// — NOT £125,140 of taxable income, which is the *rUK* additional-rate
// threshold and easy to confuse with Scotland's Top rate threshold.
const scotlandIncomeTaxBands2025 = [
  { threshold: 0, rate: 0.19 }, // Starter: gross £12,571–£15,397
  { threshold: 2828, rate: 0.2 }, // Basic: gross £15,398–£27,491
  { threshold: 14922, rate: 0.21 }, // Intermediate: gross £27,492–£43,662
  { threshold: 31093, rate: 0.42 }, // Higher: gross £43,663–£75,000
  { threshold: 62431, rate: 0.45 }, // Advanced: gross £75,001–£125,140
  { threshold: 112570, rate: 0.48 }, // Top: gross above £125,140
];

const scotlandIncomeTaxBands2026 = [
  { threshold: 0, rate: 0.19 }, // Starter: gross £12,571–£16,537
  { threshold: 3968, rate: 0.2 }, // Basic: gross £16,538–£29,526
  { threshold: 16957, rate: 0.21 }, // Intermediate: gross £29,527–£43,662
  { threshold: 31093, rate: 0.42 }, // Higher: gross £43,663–£75,000
  { threshold: 62431, rate: 0.45 }, // Advanced: gross £75,001–£125,140
  { threshold: 112570, rate: 0.48 }, // Top: gross above £125,140
];

const ukIncomeTaxBands = [
  { threshold: 0, rate: 0.2 },
  { threshold: 37700, rate: 0.4 },
  { threshold: 125140, rate: 0.45 },
];

export const taxYears: TaxYearRates[] = [
  // 2025/26 — dividend rates 8.75% / 33.75% / 39.35%
  {
    taxYear: "2025-26",
    region: "uk",
    personalAllowance: 12570,
    incomeTaxBands: ukIncomeTaxBands,
    propertyAllowance: 1000,
    tradingAllowance,
    mortgageInterestReliefRate: 0.2,
    savingsAllowance,
    savingsBands: savingsBandsUk,
    dividendAllowance: 500,
    dividendBands: [
      { threshold: 0, rate: 0.0875 },
      { threshold: 37700, rate: 0.3375 },
      { threshold: 125140, rate: 0.3935 },
    ],
    capitalGains,
    nationalInsurance: nationalInsurance2025,
    nationalInsuranceClass4: class4NI,
    selfEmployedClass2: class2_2025,
    hicbc,
    studentLoan: studentLoan2025,
    marriageAllowanceTransferable,
    updatedAt: new Date(),
  },
  {
    taxYear: "2025-26",
    region: "scotland",
    personalAllowance: 12570,
    incomeTaxBands: scotlandIncomeTaxBands2025,
    propertyAllowance: 1000,
    tradingAllowance,
    mortgageInterestReliefRate: 0.2,
    savingsAllowance,
    savingsBands: savingsBandsUk,
    dividendAllowance: 500,
    dividendBands: [
      { threshold: 0, rate: 0.0875 },
      { threshold: 37700, rate: 0.3375 },
      { threshold: 125140, rate: 0.3935 },
    ],
    capitalGains,
    nationalInsurance: nationalInsurance2025,
    nationalInsuranceClass4: class4NI,
    selfEmployedClass2: class2_2025,
    hicbc,
    studentLoan: studentLoan2025,
    marriageAllowanceTransferable,
    updatedAt: new Date(),
  },
  // 2026/27 — dividend rates rose 2pp at the basic/higher bands (Autumn Budget 2025)
  {
    taxYear: "2026-27",
    region: "uk",
    personalAllowance: 12570,
    incomeTaxBands: ukIncomeTaxBands,
    propertyAllowance: 1000,
    tradingAllowance,
    mortgageInterestReliefRate: 0.2,
    savingsAllowance,
    savingsBands: savingsBandsUk,
    dividendAllowance: 500,
    dividendBands: [
      { threshold: 0, rate: 0.1075 },
      { threshold: 37700, rate: 0.3575 },
      { threshold: 125140, rate: 0.3935 },
    ],
    capitalGains,
    nationalInsurance: nationalInsurance2025,
    nationalInsuranceClass4: class4NI,
    selfEmployedClass2: class2_2026,
    hicbc,
    studentLoan: studentLoan2026,
    marriageAllowanceTransferable,
    updatedAt: new Date(),
  },
  {
    taxYear: "2026-27",
    region: "scotland",
    personalAllowance: 12570,
    incomeTaxBands: scotlandIncomeTaxBands2026,
    propertyAllowance: 1000,
    tradingAllowance,
    mortgageInterestReliefRate: 0.2,
    savingsAllowance,
    savingsBands: savingsBandsUk,
    dividendAllowance: 500,
    dividendBands: [
      { threshold: 0, rate: 0.1075 },
      { threshold: 37700, rate: 0.3575 },
      { threshold: 125140, rate: 0.3935 },
    ],
    capitalGains,
    nationalInsurance: nationalInsurance2025,
    nationalInsuranceClass4: class4NI,
    selfEmployedClass2: class2_2026,
    hicbc,
    studentLoan: studentLoan2026,
    marriageAllowanceTransferable,
    updatedAt: new Date(),
  },
];
