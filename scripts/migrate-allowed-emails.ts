/**
 * One-time migration: moves the old ALLOWED_EMAILS environment variable
 * into the new `allowed_emails` MongoDB collection, now managed from
 * /admin/access instead of an env var + redeploy.
 *
 * Safe to run more than once — it upserts, so re-running just confirms
 * the same addresses are present rather than duplicating them.
 *
 * After running this, ALLOWED_EMAILS in your environment is no longer
 * read by the app at all (see lib/admin.ts) — you can remove it from
 * .env.local and Vercel's project settings, or just leave it there
 * unused, whichever you prefer. Nothing reads it going forward.
 *
 * Run with: npm run migrate-allowed-emails
 */
import { MongoClient } from "mongodb";
import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";

// Same dotenv loading as scripts/seed.ts — see that file's comment for why.
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else {
  config();
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not set. Add it to .env.local first.");
}

// Mirrors lib/db.ts's fallback — duplicated rather than imported via the
// "@/" path alias, since this script runs under tsx outside Next's own
// module resolution and that alias isn't guaranteed to resolve here.
const dbName = process.env.MONGODB_DB_NAME || "tax_calculator";

async function migrate() {
  const raw = process.env.ALLOWED_EMAILS;
  const emails = (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.log(
      "ALLOWED_EMAILS is not set (or empty) — nothing to migrate. " +
        "Add people directly at /admin/access instead."
    );
    return;
  }

  const client = new MongoClient(uri as string);
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("allowed_emails");

    await collection.createIndex({ email: 1 }, { unique: true });

    for (const email of emails) {
      await collection.updateOne(
        { email },
        {
          $set: { email },
          $setOnInsert: { addedAt: new Date(), addedBy: "migration:ALLOWED_EMAILS" },
        },
        { upsert: true }
      );
      console.log(`Migrated ${email}`);
    }

    console.log(
      `\nDone — ${emails.length} address(es) migrated. Check them at ` +
        "/admin/access, then remove ALLOWED_EMAILS from your environment " +
        "if you like (it's no longer read by the app)."
    );
  } finally {
    await client.close();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
