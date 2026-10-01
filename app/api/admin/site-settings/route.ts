import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";
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
  const doc = await db.collection("site_settings").findOne({});

  return NextResponse.json({
    businessName: doc?.businessName || "",
    address: doc?.address || "",
    contactEmail: doc?.contactEmail || "",
    icoReference: doc?.icoReference || "",
    dataRegionNote: doc?.dataRegionNote || "",
    updatedAt: doc?.updatedAt ?? null,
    updatedBy: doc?.updatedBy ?? null,
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Each field is optional in the request — a field left out of the
  // body is left untouched rather than wiped, so the admin form can
  // save one section at a time if it ever grows to need that.
  const allowedFields = [
    "businessName",
    "address",
    "contactEmail",
    "icoReference",
    "dataRegionNote",
  ] as const;

  const update: Record<string, string> = {};
  for (const field of allowedFields) {
    if (typeof body[field] === "string") {
      update[field] = (body[field] as string).trim();
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields in request" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  await db.collection("site_settings").updateOne(
    {},
    {
      $set: {
        ...update,
        updatedAt: new Date(),
        updatedBy: session.user?.email ?? "unknown",
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
