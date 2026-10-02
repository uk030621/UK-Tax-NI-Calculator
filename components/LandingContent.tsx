import type { ReactNode } from "react";

interface LandingContentProps {
  priceLabel: string | null;
  /** The already-rendered sign-in or buy-access action from the block
   * above, repeated here as the closing call to action — avoids this
   * component needing its own copy of that state logic. */
  ctaSlot?: ReactNode;
}

const STACK_STEPS = [
  {
    title: "Employment, pension, rental & self-employment",
    body: "Taxed first, using your Personal Allowance and the correct bands for your region — including Scotland's own rates where they genuinely apply.",
  },
  {
    title: "Savings interest",
    body: "Your starting rate band and Personal Savings Allowance, worked out from your total income — not just your savings in isolation.",
  },
  {
    title: "Dividends",
    body: "Taxed on top of everything else, at the UK-wide dividend rates — the same whether you're in Scotland or not.",
  },
  {
    title: "Capital gains",
    body: "Calculated last, with losses and brought-forward relief applied the way HMRC's own Capital Gains Manual sets out.",
  },
];

const CHECKED_ITEMS = [
  <>
    <strong>Mortgage interest relief</strong> calculated as the 20% credit
    it became in 2020 — not the old-style deduction most tools still
    assume.
  </>,
  <>
    <strong>Scotland&rsquo;s income tax bands</strong>, applied only where
    they genuinely apply — never to savings, dividends or gains.
  </>,
  <>
    <strong>Self-employment National Insurance</strong> at the correct
    6%/2% rate, not the employee rate.
  </>,
  <>
    <strong>The High Income Child Benefit Charge</strong> and the Personal
    Allowance taper — the two cliff-edges people are most often
    blindsided by.
  </>,
  <>
    <strong>Losses carried forward</strong> — rental, self-employment and
    capital losses, relieved the way HMRC&rsquo;s own manuals set out.
  </>,
  <>
    <strong>Marriage Allowance and student loan repayments</strong>,
    calculated alongside everything else, not as an afterthought.
  </>,
];

const FAQS = [
  {
    q: "Is this official HMRC software?",
    a: "No — it's an independent calculator built to produce an accurate estimate, not a Self Assessment submission tool. That's stated clearly throughout, including on every page of results.",
  },
  {
    q: "What happens to my data?",
    a: "Your figures calculate your result and, if you choose to save it, are stored against your account so you can come back to it later. Nothing is sold or shared.",
  },
  {
    q: "What if my situation isn't covered?",
    a: "The app lists every known gap honestly, with where to get real advice for each one — a Chartered Accountant, a Chartered Tax Adviser, or specific HMRC guidance, depending on what's missing.",
  },
  {
    q: "Can I use it for more than one tax year?",
    a: "Yes — your one-off payment covers every tax year the calculator supports, for as long as it exists, not a single calculation. New tax years are added once HMRC and the Scottish Government publish that year's actual rates, usually after the Autumn Budget. This is maintained by one person, not a team, so there's no fixed release date — but keeping it genuinely current each year is the whole point of the product.",
  },
];

export function LandingContent({ priceLabel, ctaSlot }: LandingContentProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      {/* Worked example */}
      {/* Why free calculators fall short */}
      <section className="mt-14">
        <h2 className="font-serif text-2xl text-slate-900">
          Most are built for one income type, then stretched
        </h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <p className="text-sm leading-relaxed text-slate-500">
            A free calculator usually gets your <strong className="text-slate-700">salary</strong> right.
            Add rental income and it often assumes your mortgage interest
            is still a straight deduction — it hasn&rsquo;t worked that way
            since 2020. Add Scottish tax bands and they&rsquo;re sometimes
            applied to your savings and dividends too, which is simply
            wrong.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            This calculator was built the other way round: for someone
            whose tax year genuinely involves more than one thing, with
            each income type calculated in the order HMRC&rsquo;s own rules
            require — so the figure you get back reflects how your whole
            year actually works, not one slice of it.
          </p>
        </div>
      </section>

      {/* Stacking order */}
      <section className="mt-14">
        <h2 className="font-serif text-2xl text-slate-900">
          The order HMRC requires — followed exactly
        </h2>
        <div className="mt-5 divide-y divide-slate-100">
          {STACK_STEPS.map((step, i) => (
            <div key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-500 font-serif text-base text-brand-600">
                {i + 1}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-800">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Checked, not just coded */}
      <section className="mt-14">
        <h2 className="font-serif text-2xl text-slate-900">
          Verified against official worked examples
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
          Every calculation here has been checked against a published
          example from HM Revenue &amp; Customs, the Low Incomes Tax Reform
          Group (a respected UK tax charity), or the Scottish
          Government&rsquo;s own rate tables.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Rates and figures below are for the <strong>2025&ndash;26 and
          2026&ndash;27</strong> tax years — the two years this calculator
          currently covers. Rates change at each Budget, and the app is
          updated to match.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold text-slate-400">
            One worked example — the High Income Child Benefit Charge
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-slate-600">
            <span>A household earning</span>
            <span className="font-medium text-slate-900">£76,000</span>
            <span>receiving</span>
            <span className="font-medium text-slate-900">£2,212.60</span>
            <span>of Child Benefit over the year owes an extra</span>
          </div>
          <p className="mt-1 font-serif text-3xl text-slate-900">
            £1,770.08
          </p>
          <p className="mt-1 text-sm text-slate-500">
            — 80% of the £2,212.60 received, clawed back because £76,000
            is 80% of the way through the £60,000&ndash;£80,000 taper.
          </p>

          <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3">
            <p className="text-xs font-semibold text-brand-700">
              Try it yourself — enter exactly these two fields
            </p>
            <dl className="mt-2 space-y-1 text-sm text-slate-700">
              <div className="flex justify-between gap-3">
                <dt>&ldquo;Employment income (salary)&rdquo;</dt>
                <dd className="font-medium">£76,000</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>&ldquo;Child Benefit received this year&rdquo;</dt>
                <dd className="font-medium">£2,212.60</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              That second field is under &ldquo;+ Add…&rdquo; → Child
              Benefit.
            </p>
          </div>

          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
            Matches HMRC&rsquo;s own published figures for this exact
            scenario — not a rounded approximation.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold text-slate-400">
            A second worked example — higher-rate pension relief (including AVCs)
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-slate-600">
            <span>A higher-rate taxpayer earning</span>
            <span className="font-medium text-slate-900">£80,000</span>
            <span>who pays</span>
            <span className="font-medium text-slate-900">£8,000</span>
            <span>
              into a relief-at-source pension or AVC scheme (£10,000 once
              the 20% their provider already added is included) is owed a
              further
            </span>
          </div>
          <p className="mt-1 font-serif text-3xl text-slate-900">£2,000</p>
          <p className="mt-1 text-sm text-slate-500">
            — the difference between the 40% relief they&rsquo;re entitled
            to and the 20% their provider already applied automatically.
            Our calculator works this out for you — look for{" "}
            <strong className="text-slate-700">
              &ldquo;Additional pension relief&rdquo;
            </strong>{" "}
            in your results, with no manual grossing-up required.
          </p>

          <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3">
            <p className="text-xs font-semibold text-brand-700">
              Try it yourself — enter exactly these two fields
            </p>
            <dl className="mt-2 space-y-1 text-sm text-slate-700">
              <div className="flex justify-between gap-3">
                <dt>&ldquo;Employment income (salary)&rdquo;</dt>
                <dd className="font-medium">£80,000</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>&ldquo;Personal pension contributions (relief at source)&rdquo;</dt>
                <dd className="font-medium">£8,000</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              That second field is under &ldquo;+ Add…&rdquo; → Reliefs. A
              toggle above it lets you enter either figure — £8,000 if
              that&rsquo;s what you know you paid, or £10,000 if that&rsquo;s
              the total your pension statement shows. The calculator
              converts between them either way, so there&rsquo;s nothing to
              work out by hand.
            </p>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500">
              How to actually get this money back
            </p>
            <ol className="mt-2 space-y-2 text-sm text-slate-600">
              <li>
                <strong className="text-slate-800">1. Check your scheme type.</strong>{" "}
                This only applies to relief-at-source contributions. Net
                pay or salary sacrifice contributions already give you
                full relief automatically — nothing further to claim.
              </li>
              <li>
                <strong className="text-slate-800">2. Use the figure our calculator gives you</strong>{" "}
                — no need to work out the grossing-up by hand.
              </li>
              <li>
                <strong className="text-slate-800">3. Submit it to HMRC</strong>{" "}
                — through your Self Assessment return, or via your online
                HMRC Personal Tax Account if you don&rsquo;t normally file
                one.
              </li>
              <li>
                <strong className="text-slate-800">4. Check previous years too.</strong>{" "}
                If you&rsquo;ve never claimed before, you can usually
                backdate unclaimed relief up to 4 previous tax years.
              </li>
            </ol>
            <p className="mt-3 text-xs text-slate-400">
              General information on how the process typically works, not
              personalised advice — HMRC&rsquo;s own guidance, or an
              accountant, can confirm the right route for your situation.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {CHECKED_ITEMS.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-50 text-xs text-emerald-600">
                ✓
              </span>
              <p className="text-sm text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honest about limits */}
      <section className="mt-14">
        <p className="text-sm font-semibold text-brand-600">Just as important</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">
          What this doesn&rsquo;t do
        </h2>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
          <h3 className="text-[15px] font-semibold text-slate-800">
            This won&rsquo;t replace a Self Assessment return, and it
            isn&rsquo;t trying to
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            A small number of genuinely complex situations are listed
            openly in the app itself, each with where to get real advice —
            rather than left for the calculator to guess at quietly:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Business Asset Disposal Relief and Investors&rsquo; Relief</li>
            <li>Partial Private Residence Relief</li>
            <li>Combined employment and self-employment NI caps</li>
            <li>Non-UK residence and domicile status</li>
          </ul>
        </div>
      </section>

      {/* Pricing */}
      {priceLabel && (
        <section className="mt-14">
          <h2 className="font-serif text-2xl text-slate-900">
            One price. No subscription.
          </h2>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-7">
            <div>
              <p className="font-serif text-4xl text-slate-900">
                {priceLabel}
                <span className="ml-2 font-sans text-sm font-medium text-slate-400">
                  one-off
                </span>
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-slate-500">
                Not a subscription, because there&rsquo;s no ongoing
                service to subscribe to — you&rsquo;re paying for a correct
                answer now, not renting access to one.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mt-14">
        <h2 className="font-serif text-2xl text-slate-900">
          Before you pay
        </h2>
        <div className="mt-5 divide-y divide-slate-100">
          {FAQS.map((item) => (
            <div key={item.q} className="py-4">
              <h3 className="text-[15px] font-semibold text-slate-800">
                {item.q}
              </h3>
              <p className="mt-1.5 max-w-xl text-sm text-slate-500">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      {ctaSlot && (
        <section className="mt-14 border-t border-slate-100 pt-10 text-center">
          <h2 className="font-serif text-2xl text-slate-900">
            See what your actual tax year looks like, properly calculated.
          </h2>
          <div className="mt-5 flex justify-center">{ctaSlot}</div>
        </section>
      )}

      <p className="mt-16 text-center text-xs text-slate-400">
        Figures are illustrative and based on published HMRC rates. Not a
        substitute for professional tax advice.
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">
        <a href="/terms" className="font-medium text-brand-600 hover:text-brand-700">
          Terms of Service
        </a>
        {" · "}
        <a href="/privacy" className="font-medium text-brand-600 hover:text-brand-700">
          Privacy Policy
        </a>
      </p>
    </div>
  );
}
