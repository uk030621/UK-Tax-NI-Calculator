import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getSiteSettings } from "@/lib/siteSettings";
import { Section, P, Ul, Field } from "@/components/LegalProse";

// Same reasoning as app/privacy/page.tsx — settings can change live from
// /admin/access, and the advisory boxes below must only ever render for
// the admin currently signed in, so this can no longer be static.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TermsOfServicePage() {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminEmail(session?.user?.email);
  const settings = await getSiteSettings();

  const missing = [
    !settings.businessName && "business name",
    !settings.address && "address",
    !settings.contactEmail && "contact email",
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <a
        href="/"
        className="mb-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        ← Back to calculator
      </a>

      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {settings.updatedAt
          ? `Last updated: ${new Date(settings.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
          : null}{" "}
        These are the terms you agree to by using the UK Tax &amp; NI
        Calculator.
      </p>

      {isAdmin && (
        <div className="mt-8 space-y-4">
          {missing.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
              <p className="text-sm font-semibold text-slate-800">
                Visible to you as an admin only
              </p>
              <p className="mt-1.5 text-sm text-slate-600">
                Still missing: <strong>{missing.join(", ")}</strong>. Set
                these at{" "}
                <a href="/admin/access" className="font-medium text-brand-600 hover:text-brand-700">
                  /admin/access
                </a>{" "}
                — a regular visitor sees a plain placeholder instead of
                this notice, not this warning.
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
            <p className="text-sm font-semibold text-slate-800">
              Also visible to you as an admin only
            </p>
            <p className="mt-1.5 text-sm text-slate-600">
              Section &ldquo;Your right to cancel&rdquo; below states that
              paying starts the service immediately and waives the usual
              14-day cooling-off period. Under the Consumer Contracts
              Regulations 2013, that waiver generally needs your
              customer&rsquo;s <strong>active, explicit consent at the
              point of purchase</strong> — a checkbox at checkout, not just
              text on a page they may never read. The checkout flow
              doesn&rsquo;t currently capture that. This page states the
              waiver, but may not be sufficient to establish it on its own
              — worth asking a solicitor, and worth adding that checkbox
              to the actual checkout step.
            </p>
          </div>
        </div>
      )}

      <Section title="What this is">
        <P>
          The UK Tax &amp; NI Calculator (&ldquo;the service&rdquo;) is an
          independent tool that estimates UK Income Tax, National
          Insurance, and Capital Gains Tax based on figures you enter.{" "}
          <strong>
            It produces an estimate, not a tax return, and it is not a
            substitute for advice from a qualified accountant or tax
            adviser.
          </strong>{" "}
          You remain solely responsible for your own tax affairs and any
          filing obligations to HMRC.
        </P>
      </Section>

      <Section title="Who operates this service">
        <P>
          The service is operated by{" "}
          <Field value={settings.businessName} label="your name or trading name" isAdmin={isAdmin} />
          , of{" "}
          <Field value={settings.address} label="your address, or registered office" isAdmin={isAdmin} />{" "}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;). You can contact us at{" "}
          <Field value={settings.contactEmail} label="your contact email" isAdmin={isAdmin} />.
        </P>
      </Section>

      <Section title="Eligibility and your account">
        <P>
          You must be at least 18 to use this service. You need a Google
          account to sign in. You&rsquo;re responsible for keeping that
          account secure — we authenticate you based on your Google
          sign-in and have no separate password of our own to protect.
        </P>
      </Section>

      <Section title="Access and payment">
        <P>
          Some or all of the calculator may require payment to access,
          shown clearly before you pay. Payment is a{" "}
          <strong>one-off charge, not a subscription</strong> — paying once
          gives you ongoing access to the calculator for as long as the
          service exists, covering every tax year it supports, not a
          single calculation.
        </P>
        <P>
          Payment is processed by Stripe, our payment provider. We never
          see or store your full card details.
        </P>
      </Section>

      <Section title="Your right to cancel">
        <P>
          Under the Consumer Contracts Regulations 2013, you would
          normally have 14 days to cancel an online purchase and receive a
          full refund. Because this service gives you immediate access to
          digital content, <strong>by completing payment you agree that
          access begins immediately and you lose this 14-day cancellation
          right</strong> once it does.
        </P>
        <P>
          This doesn&rsquo;t affect your separate statutory rights under
          the Consumer Rights Act 2015 if the service is genuinely faulty
          — see &ldquo;If something&rsquo;s wrong&rdquo; below.
        </P>
      </Section>

      <Section title="If something's wrong">
        <P>
          Under the Consumer Rights Act 2015, digital content we supply
          must be as described, fit for purpose, and of satisfactory
          quality. If it isn&rsquo;t — for example, a genuine calculation
          bug, not a difference of opinion about an estimate — contact{" "}
          <Field value={settings.contactEmail} label="your contact email" isAdmin={isAdmin} />{" "}
          and we&rsquo;ll put it right or, where appropriate, refund you.
          Nothing in these terms limits these statutory rights.
        </P>
        <P>
          Outside of that statutory right, payments are generally
          non-refundable, consistent with the immediate-access waiver
          above.
        </P>
      </Section>

      <Section title="Acceptable use">
        <P>Access to this service is for your own personal use. You agree not to:</P>
        <Ul
          items={[
            "Share your sign-in or paid access with anyone else.",
            "Attempt to bypass or circumvent the access controls.",
            "Use the service in any way that disrupts it for other users.",
            "Scrape, copy, or republish the calculation engine or its outputs as your own product.",
          ]}
        />
      </Section>

      <Section title="Accuracy and limitation of liability">
        <P>
          We take reasonable care to check this calculator&rsquo;s figures
          against published HMRC, LITRG, and Scottish Government examples,
          but tax rules are complex and the service is provided{" "}
          <strong>&ldquo;as is&rdquo;</strong>, without a guarantee that
          every result is error-free for every possible situation —
          particularly the situations explicitly listed as out of scope
          within the app itself.
        </P>
        <P>
          To the fullest extent the law allows, our total liability to you
          arising from your use of this service is limited to the amount
          you paid for it, and we&rsquo;re not liable for indirect or
          consequential losses (such as a penalty, interest charge, or
          lost opportunity arising from reliance on a figure). Nothing in
          these terms excludes or limits liability where the law doesn&rsquo;t
          allow us to — including for fraud, or death or personal injury
          caused by our negligence.
        </P>
      </Section>

      <Section title="Suspending or ending access">
        <P>
          We may suspend or remove your access if we reasonably believe
          you&rsquo;ve breached these terms, or if we need to for security
          reasons. If we remove access from an account that paid for it,
          this doesn&rsquo;t automatically entitle you to a refund — see
          &ldquo;If something&rsquo;s wrong&rdquo; above for when a refund
          does apply.
        </P>
        <P>
          You can stop using the service at any time; see our{" "}
          <a href="/privacy" className="font-medium text-brand-600 hover:text-brand-700">
            Privacy Policy
          </a>{" "}
          for how to request your account be deleted.
        </P>
      </Section>

      <Section title="Changes to these terms">
        <P>
          We may update these terms from time to time, for example as the
          service changes. We&rsquo;ll update the date at the top when we
          do, and continued use after a change means you accept the
          updated terms.
        </P>
      </Section>

      <Section title="Governing law">
        <P>
          These terms are governed by the law of England and Wales. If
          you&rsquo;re a consumer living elsewhere in the UK, you may also
          have rights under the law of the part of the UK you live in, and
          this doesn&rsquo;t take those away.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          <Field value={settings.businessName} label="your name or trading name" isAdmin={isAdmin} />
          <br />
          <Field value={settings.contactEmail} label="your contact email" isAdmin={isAdmin} />
        </P>
      </Section>

      <footer className="mt-14 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
        <a href="/privacy" className="font-medium text-brand-600 hover:text-brand-700">
          Privacy Policy
        </a>
      </footer>
    </main>
  );
}
