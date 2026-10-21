/**
 * Vehicle costs for the self-employed: simplified expenses (flat mileage
 * rates) and capital allowances for ONE car, van or motorcycle.
 *
 * Deliberately limited. It models a single vehicle in a single tax year of
 * twelve months. It doesn't handle several vehicles in one pool, leased or
 * hire-purchase vehicles, short accounting periods, or the annual
 * investment allowance limit being shared with other equipment. The app
 * lists those on its "what this calculator doesn't cover" panel.
 */

export interface VehicleRates {
  /** Writing-down allowance for the main pool (cars up to the CO2 threshold, vans, motorcycles). 18% before 6 April 2026, 14% after. */
  mainPoolRate: number;
  /** Writing-down allowance for the special rate pool (cars above the CO2 threshold). */
  specialRatePoolRate: number;
  /** CO2 emissions (g/km) above which a car goes into the special rate pool. */
  co2Threshold: number;
  /** A pool at or below this balance can be written off in full. */
  smallPoolLimit: number;
  /** Annual Investment Allowance: 100% relief up to this limit (not available for cars). */
  annualInvestmentAllowance: number;
  /** True while the 100% first-year allowance for new zero-emission cars is available. */
  zeroEmissionFirstYearAllowance: boolean;
  mileage: {
    carVanFirstMilesLimit: number;
    carVanFirstRate: number;
    carVanRate: number;
    motorcycleRate: number;
  };
}

export type VehicleType = "car" | "van" | "motorcycle";
export type VehicleCondition = "new" | "secondhand";
export type VehicleCo2Band = "zero" | "upto50" | "over50";
export type VehiclePool = "main" | "special";

export interface VehicleInput {
  type: VehicleType;
  /** Share of use that is for business, 0 to 100. */
  businessUsePercent: number;
  /** Cost of the vehicle if bought in this tax year. */
  costThisYear?: number;
  condition?: VehicleCondition;
  /** Cars only. */
  co2Band?: VehicleCo2Band;
  /** Value left to claim on a vehicle bought in an earlier year (before this year's allowance). */
  poolBroughtForward?: number;
  /** Which pool that balance sits in. Defaults to the main pool. */
  poolType?: VehiclePool;
  /** Sale proceeds if the vehicle was sold this year. */
  saleProceeds?: number;
}

export interface VehicleAllowanceResult {
  mode: "first-year" | "annual-investment" | "writing-down" | "balancing" | "none";
  pool: VehiclePool | null;
  rate: number;
  /** Allowance before the business-use share is applied. */
  allowanceBeforeBusinessUse: number;
  businessUsePercent: number;
  /** What is deducted as a business expense (writing-down or first-year allowance, plus any balancing allowance). */
  allowanceClaimed: number;
  /** Taxable amount to add to business income when a sale produces more than the pool balance. */
  balancingCharge: number;
  /** Balance to carry into next tax year (before any private-use restriction). */
  poolCarriedForward: number;
  notes: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const money = (n: number) => Math.round(n * 100) / 100;

export interface MileageResult {
  carVanMiles: number;
  motorcycleMiles: number;
  expense: number;
}

/** Simplified expenses: flat rates per business mile. Cannot be used on a vehicle that has had capital allowances. */
export function simplifiedMileageExpense(
  carVanMiles: number,
  motorcycleMiles: number,
  rates: VehicleRates
): MileageResult {
  const cv = Math.max(0, carVanMiles || 0);
  const mc = Math.max(0, motorcycleMiles || 0);
  const first = Math.min(cv, rates.mileage.carVanFirstMilesLimit);
  const rest = Math.max(0, cv - rates.mileage.carVanFirstMilesLimit);
  const expense =
    first * rates.mileage.carVanFirstRate + rest * rates.mileage.carVanRate + mc * rates.mileage.motorcycleRate;
  return { carVanMiles: cv, motorcycleMiles: mc, expense: money(expense) };
}

export function calculateVehicleAllowance(input: VehicleInput, rates: VehicleRates): VehicleAllowanceResult {
  const pct = clamp(input.businessUsePercent ?? 100, 0, 100);
  const share = pct / 100;
  const cost = Math.max(0, input.costThisYear ?? 0);
  const bf = Math.max(0, input.poolBroughtForward ?? 0);
  const sale = Math.max(0, input.saleProceeds ?? 0);
  const notes: string[] = [];

  const none: VehicleAllowanceResult = {
    mode: "none",
    pool: null,
    rate: 0,
    allowanceBeforeBusinessUse: 0,
    businessUsePercent: pct,
    allowanceClaimed: 0,
    balancingCharge: 0,
    poolCarriedForward: 0,
    notes,
  };
  if (cost === 0 && bf === 0) return none;

  if (pct < 100) notes.push(`Only the ${pct}% business use is allowed. The rest is private use.`);

  // --- Bought this year ---------------------------------------------------
  let costInPool = 0;
  let pool: VehiclePool = input.poolType ?? "main";

  if (cost > 0) {
    if (input.type === "car") {
      const co2 = input.co2Band ?? "over50";
      if (co2 === "zero" && input.condition === "new" && rates.zeroEmissionFirstYearAllowance && bf === 0 && sale === 0) {
        notes.push("A new zero-emission car qualifies for a 100% first-year allowance.");
        return {
          ...none,
          mode: "first-year",
          rate: 1,
          allowanceBeforeBusinessUse: cost,
          allowanceClaimed: money(cost * share),
          poolCarriedForward: 0,
        };
      }
      if (co2 === "zero" && input.condition === "secondhand") {
        notes.push("A second-hand zero-emission car doesn't get the 100% first-year allowance, so it goes into the main pool.");
      }
      pool = co2 === "over50" ? "special" : "main";
      costInPool = cost;
      notes.push("Cars don't qualify for the Annual Investment Allowance. They are written off gradually.");
    } else if (bf === 0 && sale === 0) {
      notes.push(
        "Vans and motorcycles qualify for the Annual Investment Allowance (100% in the year of purchase). The limit is shared with any other equipment you buy, which this app doesn't track."
      );
      return {
        ...none,
        mode: "annual-investment",
        rate: 1,
        allowanceBeforeBusinessUse: cost,
        allowanceClaimed: money(cost * share),
        poolCarriedForward: 0,
      };
    } else {
      costInPool = cost;
      pool = "main";
    }
  }

  const rate = pool === "special" ? rates.specialRatePoolRate : rates.mainPoolRate;
  const balance = bf + costInPool;
  const afterSale = balance - sale;

  // --- Sold this year -----------------------------------------------------
  if (sale > 0) {
    if (afterSale < 0) {
      const charge = money(-afterSale * share);
      notes.push("You sold it for more than its remaining value, so the difference is taxable (a balancing charge).");
      return {
        ...none,
        mode: "balancing",
        pool,
        rate,
        businessUsePercent: pct,
        balancingCharge: charge,
        poolCarriedForward: 0,
      };
    }
    if (pct < 100) {
      const allowance = money(afterSale * share);
      notes.push("You sold it for less than its remaining value. A vehicle with private use is in its own pool, so the shortfall is allowed in full (a balancing allowance).");
      return {
        ...none,
        mode: "balancing",
        pool,
        rate,
        allowanceBeforeBusinessUse: afterSale,
        allowanceClaimed: allowance,
        poolCarriedForward: 0,
      };
    }
    notes.push("Sale proceeds are taken off the pool. This assumes the pool still holds other equipment, so writing-down allowances carry on.");
  }

  // --- Writing-down allowance ---------------------------------------------
  const base = Math.max(0, afterSale);
  const smallPool = base <= rates.smallPoolLimit;
  const wda = money(smallPool ? base : base * rate);
  if (smallPool && base > 0) notes.push(`The balance is within the small pool limit, so the whole remaining value is allowed.`);
  return {
    ...none,
    mode: "writing-down",
    pool,
    rate,
    allowanceBeforeBusinessUse: wda,
    allowanceClaimed: money(wda * share),
    poolCarriedForward: money(base - wda),
  };
}
