import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAllowedEmail } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";
import type { TaxYearRates } from "@/lib/calculateTax";
import { DB_NAME } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!(await isAllowedEmail(session?.user?.email))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // Next.js 15+: dynamic route params are async and must be awaited
  const { year } = await params;
  const region = request.nextUrl.searchParams.get("region") ?? "uk";

  if (region !== "uk" && region !== "scotland") {
    return NextResponse.json(
      { error: "region must be 'uk' or 'scotland'" },
      { status: 400 }
    );
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const rates = await db
    .collection<TaxYearRates>("tax_years")
    .findOne({ taxYear: year, region }, { projection: { _id: 0 } });

  if (!rates) {
    return NextResponse.json(
      { error: `No rates found for tax year "${year}" (${region})` },
      { status: 404 }
    );
  }

  return NextResponse.json(rates);
}
