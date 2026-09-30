import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAllowedEmail } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";
import type { CalculationResult } from "@/lib/calculateTax";
import { DB_NAME } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  // Re-checked here too, not just at sign-in — a database session can
  // outlive being removed from ALLOWED_EMAILS.
  if (!session?.user?.id || !(await isAllowedEmail(session.user.email))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const history = await db
    .collection("calculations")
    .find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  // ObjectId isn't directly usable as a React key or a PATCH/DELETE URL
  // segment on the client — serialize it to a plain string once, here.
  const serialized = history.map(({ _id, ...rest }) => ({
    _id: _id.toString(),
    ...rest,
  }));

  return NextResponse.json({ history: serialized });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await isAllowedEmail(session.user.email))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let result: CalculationResult;
  try {
    result = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  await db.collection("calculations").insertOne({
    userId: session.user.id,
    ...result,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
