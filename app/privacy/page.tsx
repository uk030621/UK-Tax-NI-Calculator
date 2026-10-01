import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getSiteSettings } from "@/lib/siteSettings";
import { Section, SubHeading, P, Ul, Field } from "@/components/LegalProse";

// Settings can change at any time from /admin/access, and the advisory
// box below must only ever appear for the admin who's currently signed
// in — both depend on a fresh read on every single request, so this
// page can no longer be static the way it started out.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrivacyPolicyPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminEmail(session?.user?.email);
  const settings = await getSiteSettings();

  const missing = [
    !settings.businessName && "business name",
    !settings.address && "address",
    !settings.contactEmail && "contact email",
    !settings.icoReference && "ICO reference",
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
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {settings.updatedAt
          ? `Last updated: ${new Date(settings.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
          : null}{" "}
        This explains what personal data the UK Tax &amp; NI Calculator
        collects, why, and what rights you have over it.
      </p>

      {isAdmin && missing.length > 0 && (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="text-sm font-semibold text-slate-800">
            Visible to you as an admin only
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
            Still missing: <strong>{missing.join(", ")}</strong>. Set these
            at{" "}
            <a href="/admin/access" className="font-medium text-brand-600 hover:text-brand-700">
              /admin/access
            </a>{" "}
            — a regular visitor sees a plain placeholder instead of this
            notice, not this warning.
          </p>
        </div>
      )}

      <Section title="Who this policy covers">
        <P>
          This calculator is operated by{" "}
          <Field value={settings.businessName} label="your name or trading name" isAdmin={isAdmin} />
          , of{" "}
          <Field value={settings.address} label="your address, or registered office" isAdmin={isAdmin} />{" "}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;). For data protection purposes,
          we are the <strong>data controller</strong> for the personal data
          described below.
        </P>
        <P>
          Questions about this policy, or requests about your data, can be
          sent to{" "}
          <Field value={settings.contactEmail} label="your contact email" isAdmin={isAdmin} />.
        </P>
      </Section>

      <Section title="What we collect, and why">
        <SubHeading>When you sign in</SubHeading>
        <P>
          We use Google to sign you in. Google shares your email address and
          name with us when you do. We use this to identify your account,
          decide whether you&rsquo;re allowed to use the calculator, and —
          if you save a calculation — to link it to you.
        </P>

        <SubHeading>When you use the calculator</SubHeading>
        <P>
          The figures you enter (income amounts, tax year, region, and so
          on) are used to produce your result. If you choose to{" "}
          <strong>save</strong> a calculation, those figures — along with
          the result — are stored against your account so you can return to
          them later. If you don&rsquo;t save a calculation, the figures you
          entered are used only to produce that one result and are not
          separately retained by us.
        </P>
        <P>
          We treat saved calculation data as sensitive, because it reflects
          your financial circumstances, and restrict it so that only you
          (and, where relevant, our site administrators acting to maintain
          the service) can access it.
        </P>

        <SubHeading>When you pay for access</SubHeading>
        <P>
          Payment is handled entirely by Stripe, our payment processor —{" "}
          <strong>
            your card details are sent directly to Stripe and never pass
            through or are stored on our own servers
          </strong>
          . Once Stripe confirms your payment, we store a record that your
          email has paid, the amount, the currency, and the date — not your
          card details, which Stripe never shares with us in full.
        </P>

        <SubHeading>Technical data</SubHeading>
        <P>
          Like most web services, our hosting provider (Vercel) and
          database provider (MongoDB Atlas) may automatically log technical
          information needed to operate and secure the service — such as IP
          addresses and request timestamps — as part of their own
          infrastructure. We don&rsquo;t use this for tracking or
          marketing, and we don&rsquo;t run analytics or advertising
          cookies of our own.
        </P>
      </Section>

      <Section title="Our legal basis for using your data">
        <P>
          We process your account and calculation data because it&rsquo;s
          necessary to provide the service you&rsquo;ve signed up for or
          paid for (performance of a contract). Where we keep basic
          technical logs for security purposes, we rely on our legitimate
          interest in keeping the service running safely and reliably.
        </P>
      </Section>

      <Section title="Who we share data with">
        <P>We share limited data with the following providers, each acting as a processor on our behalf, strictly to deliver the service:</P>
        <Ul
          items={[
            "Google — to authenticate your sign-in.",
            "Stripe — to process payment, if you pay for access.",
            "Vercel — our hosting provider, which runs the application.",
            "MongoDB Atlas — our database provider, which stores account and calculation data.",
          ]}
        />
        <P>
          We don&rsquo;t sell your data, and we don&rsquo;t share it with
          anyone for their own marketing purposes.
        </P>
      </Section>

      <Section title="Where your data is processed">
        <P>{settings.dataRegionNote}</P>
      </Section>

      <Section title="How long we keep your data">
        <P>
          We keep your account and any saved calculations for as long as
          your account remains active. If you&rsquo;d like your account and
          all associated data deleted, contact us at{" "}
          <Field value={settings.contactEmail} label="your contact email" isAdmin={isAdmin} />{" "}
          and we&rsquo;ll action this within a reasonable time. You can
          delete individual saved calculations yourself at any time from
          within the app, without needing to contact us.
        </P>
      </Section>

      <Section title="Your rights">
        <P>Under UK data protection law, you have the right to:</P>
        <Ul
          items={[
            "Ask what personal data we hold about you, and get a copy of it.",
            "Ask us to correct inaccurate data.",
            "Ask us to delete your data (subject to any legal reason we may need to keep some of it, such as payment records for tax purposes).",
            "Object to, or ask us to restrict, certain processing.",
            "Ask for your data in a portable format.",
          ]}
        />
        <P>
          To exercise any of these, contact{" "}
          <Field value={settings.contactEmail} label="your contact email" isAdmin={isAdmin} />.
          If you&rsquo;re not satisfied with our response, you can complain
          to the UK Information Commissioner&rsquo;s Office (ico.org.uk).
        </P>
      </Section>

      <Section title="Cookies">
        <P>
          We use one strictly necessary cookie, set by our sign-in system,
          to keep you signed in between visits. It&rsquo;s required for the
          service to work and isn&rsquo;t used for tracking or advertising.
          We don&rsquo;t use analytics or marketing cookies.
        </P>
      </Section>

      <Section title="Children">
        <P>
          This service isn&rsquo;t directed at, or intended for use by,
          anyone under 18.
        </P>
      </Section>

      <Section title="Changes to this policy">
        <P>
          We may update this policy from time to time — for example, if we
          add a new feature that changes what data we collect. We&rsquo;ll
          update the date at the top when we do.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          <Field value={settings.businessName} label="your name or trading name" isAdmin={isAdmin} />
          <br />
          <Field value={settings.contactEmail} label="your contact email" isAdmin={isAdmin} />
          <br />
          ICO registration reference:{" "}
          <Field value={settings.icoReference} label="once registered" isAdmin={isAdmin} />
        </P>
      </Section>

      <footer className="mt-14 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
        <a href="/terms" className="font-medium text-brand-600 hover:text-brand-700">
          Terms of Service
        </a>
      </footer>
    </main>
  );
}
