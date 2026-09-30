import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import { isAllowedEmail } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";
import type { CalculationResult } from "@/lib/calculateTax";
import { DB_NAME } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15+: dynamic route params are async and must be awaited
  const { id } = await params;

  const session = await getServerSession(authOptions);
  // Re-checked here too, not just at sign-in — a database session can
  // outlive being removed from ALLOWED_EMAILS.
  if (!session?.user?.id || !(await isAllowedEmail(session.user.email))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid calculation id" }, { status: 400 });
  }

  let result: CalculationResult;
  try {
    result = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // Filtering on userId as well as _id means a user can only ever update
  // their own saved calculations — a mismatched id (not found, or owned
  // by someone else) both produce the same 404, never leaking which case it was.
  const updateResult = await db.collection("calculations").updateOne(
    { _id: new ObjectId(id), userId: session.user.id },
    { $set: { ...result, updatedAt: new Date() } }
  );

  if (updateResult.matchedCount === 0) {
    return NextResponse.json({ error: "Calculation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await isAllowedEmail(session.user.email))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid calculation id" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const deleteResult = await db
    .collection("calculations")
    .deleteOne({ _id: new ObjectId(id), userId: session.user.id });

  if (deleteResult.deletedCount === 0) {
    return NextResponse.json({ error: "Calculation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
