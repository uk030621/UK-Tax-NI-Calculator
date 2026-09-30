import clientPromise from "@/lib/mongodb";
import { DB_NAME } from "@/lib/db";

/**
 * A document in the `allowed_emails` collection. `addedBy` records how
 * someone ended up on the list — "admin:<email>" for a manual add,
 * "migration:ALLOWED_EMAILS" for the one-time env-var migration, or
 * "stripe:<checkout session id>" for a paid entry, which also carries
 * the `payment` field. Shared here (rather than redefined in each route
 * that touches this collection) so the admin API and the Stripe webhook
 * can't quietly drift into incompatible shapes.
 */
export interface AllowedEmailDoc {
  email: string;
  addedAt: Date;
  addedBy: string;
  payment?: {
    stripeCustomerId: string;
    stripeCheckoutSessionId: string;
    amount: number; // minor units (pence for GBP)
    currency: string;
    paidAt: Date;
  };
}

/**
 * Simple allowlist-based admin check. Set ADMIN_EMAILS in your env to a
 * comma-separated list of Google account emails that should be able to
 * maintain the tax_years rate tables.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/**
 * General access allowlist — who may sign in and use the app at all.
 * Backed by the `allowed_emails` collection, managed from the
 * /admin/access page (manual adds) and /api/webhooks/stripe (paid
 * adds) — not an environment variable, unlike ADMIN_EMAILS above, so it
 * can be changed without a redeploy.
 *
 * Admins are always implicitly allowed (isAdminEmail is checked first,
 * with no database call needed), so an admin's address never needs
 * adding to the allowlist too, and admins can never lock themselves out
 * even if the collection is empty or unreachable.
 *
 * An EMPTY collection means only admins may use the app — there is no
 * "empty = open to everyone" fallback. This is a deliberately safer
 * default than the old ALLOWED_EMAILS env var had: a fresh deployment
 * starts locked down to admins only, who can then add people from
 * /admin/access, or wait for someone to pay, rather than starting open
 * until someone remembers to configure it.
 */
export async function isAllowedEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const doc = await db
    .collection<AllowedEmailDoc>("allowed_emails")
    .findOne({ email: email.toLowerCase() });
  return Boolean(doc);
}
