import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAllowedEmail } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";
import { DB_NAME } from "@/lib/db";
import {
  calculateMultiIncomeTax,
  type TaxYearRates,
  type MultiIncomeInput,
} from "@/lib/calculateTax";

interface CalculateBody extends MultiIncomeInput {
  taxYear: string;
  region: "uk" | "scotland";
}

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value) && value >= 0;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!(await isAllowedEmail(session?.user?.email))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: CalculateBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    taxYear,
    region,
    employmentIncome,
    pensionIncome,
    rentalIncome,
    rentalExpenses,
    rentalLossBroughtForward,
    mortgageInterest,
    financeCostsBroughtForward,
    rentARoomReceipts,
    rentARoomExpenses,
    rentARoomShared,
    selfEmploymentProfit,
    selfEmploymentExpenses,
    selfEmploymentLossBroughtForward,
    savingsInterest,
    dividendIncome,
    foreignTaxWithheldOnDividends,
    capitalGains,
    capitalLossesThisYear,
    capitalLossesBroughtForward,
    personalPensionContributions,
    giftAidDonations,
    mainResidenceGain,
    mainResidenceFullyExempt,
    childBenefitReceived,
    studentLoanPlan,
    hasPostgraduateLoan,
    receivingMarriageAllowance,
    givingMarriageAllowance,
    blindPersonsAllowance,
    blindPersonsAllowanceTransferredIn,
    claimingMarriedCouplesAllowance,
    businessMilesCarVan,
    businessMilesMotorcycle,
    vehicleAllowance,
  } = body;

  if (!taxYear || (region !== "uk" && region !== "scotland")) {
    return NextResponse.json(
      { error: "taxYear and a valid region ('uk' or 'scotland') are required" },
      { status: 400 }
    );
  }

  for (const [key, value] of [
    ["mainResidenceFullyExempt", mainResidenceFullyExempt],
    ["hasPostgraduateLoan", hasPostgraduateLoan],
    ["receivingMarriageAllowance", receivingMarriageAllowance],
    ["givingMarriageAllowance", givingMarriageAllowance],
    ["blindPersonsAllowance", blindPersonsAllowance],
    ["claimingMarriedCouplesAllowance", claimingMarriedCouplesAllowance],
    ["rentARoomShared", rentARoomShared],
  ] as const) {
    if (value !== undefined && typeof value !== "boolean") {
      return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 });
    }
  }

  // One person can't both receive and give in the same calculation.
  if (receivingMarriageAllowance && givingMarriageAllowance) {
    return NextResponse.json(
      { error: "Choose either receiving or giving Marriage Allowance, not both" },
      { status: 400 }
    );
  }

  const validPlans = ["none", "plan1", "plan2", "plan4", "plan5", undefined];
  if (!validPlans.includes(studentLoanPlan)) {
    return NextResponse.json(
      { error: "studentLoanPlan must be one of none, plan1, plan2, plan4, plan5" },
      { status: 400 }
    );
  }

  // Vehicle capital allowances: one vehicle, validated field by field.
  if (vehicleAllowance !== undefined && vehicleAllowance !== null) {
    const v = vehicleAllowance as unknown as Record<string, unknown>;
    const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });
    if (typeof v !== "object") return bad("vehicleAllowance must be an object");
    if (!["car", "van", "motorcycle"].includes(v.type as string)) return bad("vehicleAllowance.type must be car, van or motorcycle");
    if (
      typeof v.businessUsePercent !== "number" ||
      Number.isNaN(v.businessUsePercent) ||
      v.businessUsePercent < 0 ||
      v.businessUsePercent > 100
    ) {
      return bad("vehicleAllowance.businessUsePercent must be a number from 0 to 100");
    }
    for (const key of ["costThisYear", "poolBroughtForward", "saleProceeds"] as const) {
      if (v[key] !== undefined && !isValidAmount(v[key])) return bad(`vehicleAllowance.${key} must be a non-negative number`);
    }
    if (v.condition !== undefined && !["new", "secondhand"].includes(v.condition as string)) return bad("vehicleAllowance.condition must be new or secondhand");
    if (v.co2Band !== undefined && !["zero", "upto50", "over50"].includes(v.co2Band as string)) return bad("vehicleAllowance.co2Band must be zero, upto50 or over50");
    if (v.poolType !== undefined && !["main", "special"].includes(v.poolType as string)) return bad("vehicleAllowance.poolType must be main or special");
    if (((v.costThisYear as number) ?? 0) > 0 && ((v.poolBroughtForward as number) ?? 0) > 0) {
      return bad("Enter either the cost of a vehicle bought this year or a value brought forward, not both");
    }
  }

  const amounts = {
    employmentIncome,
    pensionIncome,
    rentalIncome,
    rentalLossBroughtForward,
    mortgageInterest,
    financeCostsBroughtForward,
    rentARoomReceipts,
    selfEmploymentProfit,
    selfEmploymentLossBroughtForward,
    savingsInterest,
    dividendIncome,
    foreignTaxWithheldOnDividends,
    capitalGains,
    capitalLossesThisYear,
    capitalLossesBroughtForward,
    personalPensionContributions,
    giftAidDonations,
    mainResidenceGain,
    childBenefitReceived,
    blindPersonsAllowanceTransferredIn,
    businessMilesCarVan,
    businessMilesMotorcycle,
  };
  for (const [key, value] of Object.entries(amounts)) {
    if (value !== undefined && !isValidAmount(value)) {
      return NextResponse.json(
        { error: `${key} must be a non-negative number` },
        { status: 400 }
      );
    }
  }

  function validateExpenseArray(
    items: unknown,
    fieldName: string
  ): NextResponse | null {
    if (items === undefined) return null;
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: `${fieldName} must be an array` },
        { status: 400 }
      );
    }
    for (const item of items as Array<{ category?: unknown; amount?: unknown }>) {
      if (typeof item?.category !== "string" || !isValidAmount(item?.amount)) {
        return NextResponse.json(
          { error: `Each ${fieldName} item needs a category and a non-negative amount` },
          { status: 400 }
        );
      }
    }
    return null;
  }

  const rentalExpensesError = validateExpenseArray(rentalExpenses, "rentalExpenses");
  if (rentalExpensesError) return rentalExpensesError;

  const selfEmploymentExpensesError = validateExpenseArray(
    selfEmploymentExpenses,
    "selfEmploymentExpenses"
  );
  if (selfEmploymentExpensesError) return selfEmploymentExpensesError;

  const rentARoomExpensesError = validateExpenseArray(rentARoomExpenses, "rentARoomExpenses");
  if (rentARoomExpensesError) return rentARoomExpensesError;

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const rates = await db
    .collection<TaxYearRates>("tax_years")
    .findOne({ taxYear, region }, { projection: { _id: 0 } });

  if (!rates) {
    return NextResponse.json(
      { error: `No rates found for tax year "${taxYear}" (${region})` },
      { status: 404 }
    );
  }

  const result = calculateMultiIncomeTax(
    {
      ...amounts,
      rentalExpenses,
      selfEmploymentExpenses,
      rentARoomExpenses,
      rentARoomShared,
      mainResidenceFullyExempt,
      studentLoanPlan,
      hasPostgraduateLoan,
      receivingMarriageAllowance,
      givingMarriageAllowance,
      blindPersonsAllowance,
      claimingMarriedCouplesAllowance,
      vehicleAllowance: vehicleAllowance ?? undefined,
    },
    rates
  );

  return NextResponse.json(result);
}
