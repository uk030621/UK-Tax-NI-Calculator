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
  ] as const) {
    if (value !== undefined && typeof value !== "boolean") {
      return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 });
    }
  }

  const validPlans = ["none", "plan1", "plan2", "plan4", "plan5", undefined];
  if (!validPlans.includes(studentLoanPlan)) {
    return NextResponse.json(
      { error: "studentLoanPlan must be one of none, plan1, plan2, plan4, plan5" },
      { status: 400 }
    );
  }

  const amounts = {
    employmentIncome,
    pensionIncome,
    rentalIncome,
    rentalLossBroughtForward,
    mortgageInterest,
    financeCostsBroughtForward,
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
      mainResidenceFullyExempt,
      studentLoanPlan,
      hasPostgraduateLoan,
      receivingMarriageAllowance,
    },
    rates
  );

  return NextResponse.json(result);
}
