import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAllowedEmail } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";
import { DB_NAME } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!(await isAllowedEmail(session?.user?.email))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const years = await db
    .collection("tax_years")
    .distinct("taxYear");

  // Most recent first
  years.sort().reverse();

  return NextResponse.json({ years });
}
