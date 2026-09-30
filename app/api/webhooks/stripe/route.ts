import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import clientPromise from "@/lib/mongodb";
import { DB_NAME } from "@/lib/db";
import type { AllowedEmailDoc } from "@/lib/admin";

/**
 * This is the ONLY place a payment actually grants access. The
 * `/?payment=success` redirect the customer sees after paying is pure
 * UX — it is never trusted to grant anything, because a redirect URL is
 * trivially guessable and would let anyone type it in and claim free
 * access. This endpoint is trustworthy instead, because every request
 * is verified against a signing secret only Stripe and this server
 * know (STRIPE_WEBHOOK_SECRET) — see the signature check below.
 *
 * Configure this in the Stripe dashboard (Developers → Webhooks) once
 * you have a public URL: point it at
 * https://your-domain/api/webhooks/stripe, listening for
 * checkout.session.completed. For local testing before you have a
 * public URL, see the README's "Setting up Stripe" section for the
 * Stripe CLI (`stripe listen`), which forwards real webhook events to
 * your machine.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Signature verification needs the EXACT raw request bytes — parsing
  // as JSON first (even just to re-stringify it) would change whitespace
  // and break the signature check. request.text() gives the raw body
  // untouched.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // A failed signature means this request did NOT genuinely come from
    // Stripe — reject it outright, don't attempt to process it.
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // The email typed into Stripe's payment form (customer_email) is
    // NOT what we trust here — metadata.grantEmail is the
    // Google-verified email we set ourselves when creating the session
    // in /api/checkout, before Stripe or the customer ever saw it.
    const email = session.metadata?.grantEmail;

    if (email && session.payment_status === "paid") {
      const client = await clientPromise;
      const db = client.db(DB_NAME);

      await db.collection<AllowedEmailDoc>("allowed_emails").updateOne(
        { email: email.toLowerCase() },
        {
          $set: {
            email: email.toLowerCase(),
            payment: {
              stripeCustomerId:
                typeof session.customer === "string" ? session.customer : session.customer?.id ?? "",
              stripeCheckoutSessionId: session.id,
              amount: session.amount_total ?? 0,
              currency: session.currency ?? "gbp",
              paidAt: new Date(),
            },
          },
          // Only set on first insert, matching the pattern already used
          // for admin-added entries — a repeat webhook delivery (Stripe
          // retries on anything but a clean 200) just re-confirms the
          // same state rather than clobbering the original addedAt.
          $setOnInsert: { addedAt: new Date(), addedBy: `stripe:${session.id}` },
        },
        { upsert: true }
      );
    }
  }

  // Any other event type is simply ignored — acknowledging it with 200
  // tells Stripe not to retry, which is correct for events we don't
  // need to act on.
  return NextResponse.json({ received: true });
}
