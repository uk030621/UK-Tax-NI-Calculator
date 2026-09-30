"use client";

import { useState } from "react";

interface Exclusion {
  topic: string;
  whyExcluded: string;
  advice: string;
}

const EXCLUSIONS: Exclusion[] = [
  {
    topic: "Business Asset Disposal Relief & Investors' Relief",
    whyExcluded:
      "These give a reduced 10% Capital Gains Tax rate on qualifying business disposals, but eligibility depends on tracking ownership history, shareholding percentages, and lifetime limits across multiple tax years — not something a single-year calculator can safely determine.",
    advice:
      "Speak to a Chartered Accountant (search the ICAEW's public directory) or a Chartered Tax Adviser (Chartered Institute of Taxation) before relying on either relief — the eligibility rules are detailed and the lifetime limit is easy to miscalculate without your full disposal history.",
  },
  {
    topic: "Partial Private Residence Relief",
    whyExcluded:
      "This calculator only handles the clean case: a home that was your only or main residence for the entire time you owned it. If any part of the ownership period doesn't qualify — a period it was let out, business use of part of the property, or a period you lived elsewhere — HMRC apportions the gain across qualifying and non-qualifying periods, which needs day-by-day period tracking this app doesn't attempt.",
    advice:
      "A Chartered Accountant or Tax Adviser can work through the apportionment properly. If it's a straightforward let period, HMRC's own guidance (search \"HS283\" on GOV.UK) is a reasonable starting point before you engage someone.",
  },
  {
    topic: "Combined employment + self-employment National Insurance cap",
    whyExcluded:
      "If you have both a salary and self-employment profit in the same year, HMRC caps your combined Class 1 + Class 4 National Insurance so overlapping income isn't effectively taxed twice — via an apportionment calculation submitted through Self Assessment. Even the professional guidance we could find doesn't publish a simple worked formula for it, which is itself a sign it's not calculator-appropriate.",
    advice:
      "This is one to flag to a Chartered Accountant directly if you have significant income from both sources in the same year — the saving can be worth pursuing, but the calculation isn't one to attempt by hand.",
  },
  {
    topic: "Foreign tax credit relief on capital gains",
    whyExcluded:
      "This app credits foreign tax withheld on dividends, but has no equivalent for a foreign capital gain (e.g. selling shares or property in a country that taxes UK residents on the gain at source). Each foreign gain needs its own relief calculation under the relevant tax treaty.",
    advice:
      "A Chartered Tax Adviser with international experience can confirm what the relevant double-taxation treaty allows — the mechanism varies significantly by country.",
  },
  {
    topic: "Non-UK residence, domicile, and the Statutory Residence Test",
    whyExcluded:
      "Every calculation in this app assumes you're a straightforward UK tax resident. Whether that's actually true — for anyone who splits time between countries, has moved to or from the UK recently, or has non-domiciled status — is itself a genuinely complex legal determination (the Statutory Residence Test), not something any calculator at this scale should attempt.",
    advice:
      "If your residence status isn't straightforward, this is worth resolving with a Chartered Tax Adviser before using this calculator at all — it changes which UK taxes apply to you in the first place, not just the numbers within them.",
  },
  {
    topic: "Rent-a-Room Relief",
    whyExcluded:
      "Letting a furnished room in your own home has its own £7,500 tax-free allowance (£3,750 if you share the income with someone else), separate from and not combinable with the £1,000 property allowance this app already models for ordinary rental income.",
    advice:
      "If this applies to you, GOV.UK's own guidance (search \"rent a room scheme\") is usually enough to self-assess correctly — it's one of the simpler reliefs on this list.",
  },
  {
    topic: "Capital allowances for self-employed equipment & vehicles",
    whyExcluded:
      "For most small traders, the £1,000,000 Annual Investment Allowance means equipment purchases already get 100% relief in the year of purchase — which behaves almost identically to the itemized business expenses this app already supports. The genuine gap is business vehicles (particularly cars), which use entirely different CO2-based rates rather than a simple deduction.",
    advice:
      "If you've bought a business vehicle, a Chartered Accountant can confirm the correct capital allowance rate — this one is easy to get wrong by assuming it works like an ordinary expense.",
  },
  {
    topic: "Pension Annual Allowance tapering (different from the Personal Allowance taper)",
    whyExcluded:
      "This app models the Personal Allowance taper above £100,000 of income. It does not model the separate Pension Annual Allowance taper, which can reduce how much you're allowed to contribute to a pension tax-efficiently once your income exceeds a much higher threshold — a different mechanism with a different purpose that this app doesn't touch at all.",
    advice:
      "If your income is high enough that this might apply to you, a financial adviser or Chartered Accountant can check whether you've inadvertently exceeded your tapered allowance — the tax charge for doing so is separate from anything this calculator shows.",
  },
  {
    topic: "Marriage Allowance — transferring spouse's eligibility",
    whyExcluded:
      "This app lets you model receiving a Marriage Allowance transfer, and warns you if your own income looks too high to qualify as the recipient. It has no way to check the other half of the rule — that your spouse or civil partner genuinely has unused Personal Allowance to give away in the first place, since this app only ever calculates one person's tax at a time.",
    advice:
      "Run your partner's income through this calculator separately (or GOV.UK's own Marriage Allowance checker) to confirm they're actually eligible to transfer before relying on the saving shown here.",
  },
  {
    topic: "VAT, Inheritance Tax, and Stamp Duty / LBTT",
    whyExcluded:
      "These are entirely different tax regimes from income tax, National Insurance, and Capital Gains Tax — not a gap in this calculator so much as genuinely outside what it was built to do.",
    advice:
      "For VAT or Inheritance Tax planning, a Chartered Accountant is the right first call. For Stamp Duty Land Tax (or LBTT in Scotland) on a property purchase, your conveyancing solicitor will normally calculate this as a standard part of the transaction.",
  },
  {
    topic: "Automatic loss & relief carry-forward between saved calculations",
    whyExcluded:
      "Rental losses, self-employment losses, and unused mortgage interest relief all carry forward correctly — but only when you manually enter last year's figure into this year's calculation. The app deliberately never does this automatically, even between two of your own saved calculations, because it has no reliable way to confirm which saved entry is genuinely the immediately preceding tax year.",
    advice:
      "This one doesn't need a professional — just note the \"carry forward to next year\" figures shown in your results, and enter them yourself the next time you calculate.",
  },
];

export function ExclusionsDropdown() {
  const [selectedTopic, setSelectedTopic] = useState(EXCLUSIONS[0].topic);
  const current = EXCLUSIONS.find((e) => e.topic === selectedTopic) ?? EXCLUSIONS[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">
        What this calculator doesn&apos;t cover
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Every deliberate gap in one place, with where to get proper help for each.
      </p>

      <select
        value={selectedTopic}
        onChange={(e) => setSelectedTopic(e.target.value)}
        className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium text-slate-900 outline-none focus:border-brand-500 focus:bg-white"
      >
        {EXCLUSIONS.map((e) => (
          <option key={e.topic} value={e.topic}>
            {e.topic}
          </option>
        ))}
      </select>

      <div className="mt-4 space-y-3">
        <p className="text-sm text-slate-600">{current.whyExcluded}</p>
        <div className="rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
          <span className="font-medium">Where to get help: </span>
          {current.advice}
        </div>
      </div>
    </div>
  );
}
