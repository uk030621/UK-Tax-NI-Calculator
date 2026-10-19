import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail, isAllowedEmail } from "@/lib/admin";
import { getPriceInPence } from "@/lib/stripe";
import { TaxCalculatorForm } from "@/components/TaxCalculatorForm";
import { AuthButton } from "@/components/AuthButton";
import { ExclusionsDropdown } from "@/components/ExclusionsDropdown";
import { BuyAccessButton } from "@/components/BuyAccessButton";
import { LandingContent } from "@/components/LandingContent";

// This page's access gate depends on a fresh session read on every
// request. getServerSession() reads a cookie deep inside NextAuth's
// internals, which usually — but not always reliably across Next.js
// versions — is enough for Next to infer the page must be dynamic.
// Saying so explicitly removes that uncertainty: this page is never
// served from a cached copy rendered before the visitor signed in, or
// before they were removed from the allowlist.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Formats the configured price for display, or returns null if Stripe
 * isn't configured yet — STRIPE_PRICE_GBP (and STRIPE_SECRET_KEY, read
 * lazily inside getPriceInPence's caller in lib/stripe.ts) are optional
 * at the app level, even though the checkout route requires them, so a
 * deployment that hasn't set up payments yet still works fine for
 * signed-in and admin-added users — it just doesn't offer a "buy
 * access" option until you configure it.
 */
function getPriceLabel(): string | null {
  try {
    const pence = getPriceInPence();
    return `£${(pence / 100).toFixed(2)}`;
  } catch {
    return null;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; error?: string }>;
}) {
  const { payment, error: authError } = await searchParams;
  const session = await getServerSession(authOptions);
  const signedIn = Boolean(session?.user);
  // Re-checked on every request, not just at sign-in — a database
  // session can outlive being removed from the allowlist, since the
  // signIn callback in lib/auth.ts no longer blocks sign-in itself (see
  // that file's comment on why — paying for access needs someone to be
  // able to sign in before they're allowed).
  const allowed = await isAllowedEmail(session?.user?.email);
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!signedIn || !allowed) {
    const priceLabel = getPriceLabel();
    const ctaSlot = !signedIn ? (
      <AuthButton />
    ) : priceLabel ? (
      <BuyAccessButton priceLabel={priceLabel} />
    ) : undefined;

    return (
      <main className="mx-auto min-h-screen px-4 py-10">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <h1 className="font-serif text-3xl text-slate-900">
            UK Tax &amp; NI Calculator
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Salary, pension, rental income, a let room, self-employment,
            savings, dividends and capital gains, taxed together in the
            order HMRC applies them. Sign in with Google to get started.
          </p>
          <a href="/guide" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100">
            <span aria-hidden="true">📖</span> Read the user guide
          </a>

          {!signedIn && authError && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-700">
              Sign-in didn&apos;t complete{authError !== "undefined" && (<> (error code: <strong>{authError}</strong>)</>)}.{" "}
              {authError === "Configuration"
                ? "The server's sign-in settings look incomplete — the site owner should check the environment variables."
                : authError === "OAuthCallback" || authError === "OAuthSignin"
                  ? "Google and this site couldn't finish the handshake — the site owner should check the web address and redirect settings."
                  : authError === "Callback" || authError === "OAuthCreateAccount" || authError === "AdapterError"
                    ? "Google accepted you, but the account couldn't be saved — the site owner should check the database connection."
                    : authError === "undefined"
                      ? "The sign-in service didn't respond properly — the site owner should check that the web address and secret settings are correct and that the site has been redeployed."
                      : "Please try again, and tell the site owner if it keeps happening."}
            </p>
          )}

          {!signedIn && (
            <div className="mt-6">
              <AuthButton />
            </div>
          )}

          {signedIn && !allowed && (
            <>
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                You're signed in as {session?.user?.email}, but that
                account doesn't have access yet.
              </p>

              {payment === "success" && (
                <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Payment received — this can take a few seconds to
                  unlock. Refresh the page shortly; if it's still showing
                  this message after a minute or two, get in touch.
                </p>
              )}
              {payment === "cancelled" && (
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Checkout cancelled — no charge was made. You can try
                  again whenever you're ready.
                </p>
              )}

              {priceLabel && <BuyAccessButton priceLabel={priceLabel} />}

              <p className="mt-4 text-xs text-slate-400">
                Already paid, or expecting access another way? Ask
                whoever administers this app to add your email at{" "}
                <span className="font-medium">/admin/access</span>.
              </p>

              <div className="mt-6">
                <AuthButton />
              </div>
            </>
          )}
        </div>

        <LandingContent priceLabel={priceLabel} ctaSlot={ctaSlot} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6 sm:py-16">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          UK Tax &amp; NI Calculator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Income tax and National Insurance, by tax year
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <a
            href="/guide"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-100 bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
          >
            <span aria-hidden="true">📖</span>
            <span className="sm:hidden">User guide</span>
            <span className="hidden sm:inline">User guide: how to use each section</span>
          </a>
          <AuthButton />
        </div>
      </header>

      <TaxCalculatorForm />

      <div className="mt-6">
        <ExclusionsDropdown />
      </div>

      <footer className="mt-12 flex flex-col items-center gap-2 text-center text-xs text-slate-400">
        <p>
          Figures are illustrative and based on published HMRC rates. Not a
          substitute for professional tax advice.
        </p>
        <p>
          <a href="/guide" className="font-medium text-brand-600 hover:text-brand-700">
            User guide
          </a>
          {" · "}
          <a href="/terms" className="font-medium text-brand-600 hover:text-brand-700">
            Terms of Service
          </a>
          {" · "}
          <a href="/privacy" className="font-medium text-brand-600 hover:text-brand-700">
            Privacy Policy
          </a>
        </p>
        {isAdmin && (
          <div className="flex gap-4">
            <a href="/admin/tax-years" className="font-medium text-brand-600 hover:text-brand-700">
              Manage tax years →
            </a>
            <a href="/admin/access" className="font-medium text-brand-600 hover:text-brand-700">
              Manage access →
            </a>
          </div>
        )}
        <p className="mt-2">© {new Date().getFullYear()} UK Tax &amp; NI Calculator. All rights reserved.</p>
      </footer>
    </main>
  );
}
