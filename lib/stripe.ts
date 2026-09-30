import Stripe from "stripe";

// Deliberately lazy, not a top-level `export const stripe = new Stripe(...)`.
// A top-level throw for a missing key would fail the moment ANYTHING
// imports this module — including app/page.tsx, which every single
// visitor's request loads, whether or not they ever touch Stripe. That
// would crash the whole app the instant STRIPE_SECRET_KEY is unset,
// defeating the entire point of Stripe being optional. Constructing the
// client lazily, inside a function, means the failure only happens if
// and when something genuinely tries to use Stripe (the checkout and
// webhook routes) — never just from being imported.
let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing environment variable: "STRIPE_SECRET_KEY"');
  }
  if (!cachedClient) {
    // Deliberately NOT pinning a specific apiVersion here. Stripe's dated
    // API versions change often, and guessing one that doesn't match what's
    // actually installed risks a hard failure on every request (or a
    // TypeScript build error, if a newer SDK types this field strictly).
    // Omitting it means the SDK uses its own bundled default — always valid
    // for whatever version `npm install stripe` actually fetches. If you
    // want to pin a version later for stability, check the exact string
    // Stripe's dashboard shows for your account (Developers → API keys)
    // rather than copying one from documentation, which goes stale fast.
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cachedClient;
}

/**
 * The one-time price, read from the environment rather than hardcoded or
 * pre-created as a Stripe Product/Price in the dashboard — the simplest
 * option for a first build. Stripe wants the amount in the currency's
 * smallest unit (pence for GBP), so STRIPE_PRICE_GBP is a pounds figure
 * like "9.99" and this converts it.
 */
export function getPriceInPence(): number {
  const raw = process.env.STRIPE_PRICE_GBP;
  if (!raw) {
    throw new Error('Missing environment variable: "STRIPE_PRICE_GBP"');
  }
  const pounds = Number(raw);
  if (!Number.isFinite(pounds) || pounds <= 0) {
    throw new Error(`STRIPE_PRICE_GBP must be a positive number, got "${raw}"`);
  }
  return Math.round(pounds * 100);
}

export const PRODUCT_NAME =
  process.env.STRIPE_PRODUCT_NAME || "UK Tax & NI Calculator — lifetime access";
