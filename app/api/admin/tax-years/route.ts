import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";
import type { TaxYearRates } from "@/lib/calculateTax";
import { DB_NAME } from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const docs = await db
    .collection<TaxYearRates>("tax_years")
    .find({}, { projection: { _id: 0 } })
    .sort({ taxYear: -1 })
    .toArray();

  return NextResponse.json({ taxYears: docs });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: TaxYearRates;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.taxYear || (body.region !== "uk" && body.region !== "scotland")) {
    return NextResponse.json(
      { error: "taxYear and a valid region ('uk' or 'scotland') are required" },
      { status: 400 }
    );
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  await db.collection("tax_years").updateOne(
    { taxYear: body.taxYear, region: body.region },
    { $set: { ...body, updatedAt: new Date() } },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
