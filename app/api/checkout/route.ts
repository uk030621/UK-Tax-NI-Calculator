import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripeClient, getPriceInPence, PRODUCT_NAME } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  // Deliberately NOT an isAllowedEmail() check — someone who ISN'T
  // allowed yet is exactly who this route is for. Just needs to be
  // signed in, so we have a Google-verified email to grant access to
  // once they've paid.
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  const checkoutSession = await getStripeClient().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "gbp",
          unit_amount: getPriceInPence(),
          product_data: { name: PRODUCT_NAME },
        },
        quantity: 1,
      },
    ],
    // Pre-fills the email on Stripe's page for convenience, but this is
    // NOT what grants access — see the metadata field below and the
    // webhook handler's comment on why.
    customer_email: email,
    // The authoritative record of which email to unlock. Set here, on
    // our own server, so it can't be edited by whoever's paying — unlike
    // customer_email, which is just a form field on Stripe's page.
    metadata: { grantEmail: email },
    success_url: `${origin}/?payment=success`,
    cancel_url: `${origin}/?payment=cancelled`,
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }

  return NextResponse.json({ url: checkoutSession.url });
}
