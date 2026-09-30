import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail, type AllowedEmailDoc } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";
import { DB_NAME } from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    return null;
  }
  return session;
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const docs = await db
    .collection<AllowedEmailDoc>("allowed_emails")
    .find({})
    .sort({ addedAt: -1 })
    .toArray();

  const allowedEmails = docs.map(({ _id, ...rest }) => ({
    _id: _id.toString(),
    ...rest,
  }));

  // Admins are always implicitly allowed (see lib/admin.ts), so shown
  // here read-only for a complete picture — this list itself is only
  // ever changed via ADMIN_EMAILS in the environment and a redeploy,
  // never through this page.
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return NextResponse.json({ allowedEmails, adminEmails });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  const email = (body.email as string).trim().toLowerCase();

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // Upsert rather than a plain insert: adding an email that's already
  // on the list is a harmless no-op, not an error — the admin doesn't
  // need to know or care whether it was already there.
  await db.collection<AllowedEmailDoc>("allowed_emails").updateOne(
    { email },
    {
      $set: { email },
      $setOnInsert: { addedAt: new Date(), addedBy: session.user?.email ?? "unknown" },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
