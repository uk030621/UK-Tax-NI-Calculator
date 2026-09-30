/**
 * Seeds the `tax_years` collection with published HMRC/gov.uk rate data
 * covering employment/rental income tax, savings, dividends, CGT, and NI.
 *
 * The rate figures themselves live in `scripts/rates-data.ts` (also read
 * by `npm run verify`) — edit them there when a Budget changes them, then
 * re-run this script. It upserts, so it's always safe to run again.
 *
 * Run with: npm run seed
 */
import { MongoClient } from "mongodb";
import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { taxYears } from "./rates-data";

// The bare `dotenv/config` import only reads a file literally named
// `.env` — it doesn't know about Next.js's `.env.local` convention.
// Load `.env.local` explicitly (falling back to `.env` if that's what
// you're using instead) so this script sees the same variables the app does.
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else {
  config(); // falls back to .env
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not set. Add it to .env.local first.");
}

// Mirrors lib/db.ts's fallback — duplicated rather than imported via the
// "@/" path alias, since this script runs under tsx outside Next's own
// module resolution and that alias isn't guaranteed to resolve here.
const dbName = process.env.MONGODB_DB_NAME || "tax_calculator";


async function seed() {
  const client = new MongoClient(uri as string);
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("tax_years");

    await collection.createIndex({ taxYear: 1, region: 1 }, { unique: true });

    for (const doc of taxYears) {
      await collection.updateOne(
        { taxYear: doc.taxYear, region: doc.region },
        { $set: doc },
        { upsert: true }
      );
      console.log(`Upserted ${doc.taxYear} (${doc.region})`);
    }

    console.log("Seed complete.");
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
