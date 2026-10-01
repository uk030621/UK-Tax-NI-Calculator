import clientPromise from "@/lib/mongodb";
import { DB_NAME } from "@/lib/db";

/**
 * A single document (not a collection of many) — there's only ever one
 * site, so this is read with findOne({}) rather than a query by id.
 * Used to fill in the business/contact details on /terms and /privacy,
 * which previously had to be edited directly in the page source.
 */
export interface SiteSettings {
  businessName: string;
  address: string;
  contactEmail: string;
  icoReference: string;
  dataRegionNote: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}

// A sensible, accurate-enough default for the one field where leaving it
// blank would look broken rather than just "not yet personalised" — the
// others (name, address, email, ICO reference) have no safe generic
// default, so they stay genuinely empty until an admin sets them.
const DEFAULT_DATA_REGION_NOTE =
  "Where our service providers process data outside the UK, they maintain appropriate safeguards for that transfer.";

const EMPTY_SETTINGS: SiteSettings = {
  businessName: "",
  address: "",
  contactEmail: "",
  icoReference: "",
  dataRegionNote: DEFAULT_DATA_REGION_NOTE,
  updatedAt: null,
  updatedBy: null,
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const doc = await db.collection("site_settings").findOne({});
  if (!doc) return EMPTY_SETTINGS;
  return {
    businessName: doc.businessName || "",
    address: doc.address || "",
    contactEmail: doc.contactEmail || "",
    icoReference: doc.icoReference || "",
    dataRegionNote: doc.dataRegionNote || DEFAULT_DATA_REGION_NOTE,
    updatedAt: doc.updatedAt ?? null,
    updatedBy: doc.updatedBy ?? null,
  };
}
