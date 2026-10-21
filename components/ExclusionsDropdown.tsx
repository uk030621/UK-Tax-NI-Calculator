"use client";

import { useState } from "react";

interface Exclusion {
  topic: string;
  whyExcluded: string;
  advice: string;
}

const EXCLUSIONS: Exclusion[] = [
  {
    topic: "Business Asset Disposal Relief and Investors' Relief",
    whyExcluded:
      "Business Asset Disposal Relief gives a reduced Capital Gains Tax rate on qualifying business disposals (14% for disposals in 2025/26, 18% from 6 April 2026), and Investors' Relief is a similar relief for outside investors in unlisted companies. Eligibility depends on tracking ownership history, shareholding percentages, and lifetime limits across multiple tax years — not something a single-year calculator can safely determine.",
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
    topic: "Foreign tax credit relief on capital gains",
    whyExcluded:
      "This app credits foreign tax withheld on dividends, but has no equivalent for a foreign capital gain (e.g. selling shares or property in a country that taxes UK residents on the gain at source). Each foreign gain needs its own relief calculation under the relevant tax treaty.",
    advice:
      "A Chartered Tax Adviser with international experience can confirm what the relevant double-taxation treaty allows — the mechanism varies significantly by country.",
  },
  {
    topic: "Capital allowances for business vehicles",
    whyExcluded:
      "For most small traders, the £1,000,000 Annual Investment Allowance means equipment purchases already get 100% relief in the year of purchase — which behaves almost identically to the itemised business expenses this app already supports. The genuine gap is business vehicles (particularly cars), which use entirely different CO2-based rates rather than a simple deduction.",
    advice:
      "If you've bought a business vehicle, a Chartered Accountant can confirm the correct capital allowance rate — this one is easy to get wrong by assuming it works like an ordinary expense.",
  },
  {
    topic: "The combined employment and self-employment National Insurance cap",
    whyExcluded:
      "If you have both a salary and self-employment profit in the same year, there is an annual maximum on your combined Class 1 and Class 4 National Insurance, so you can end up paying more than you need to. HMRC publishes the method in its National Insurance Manual, but it depends on the contributions you have actually paid across both sources, which this app doesn't track.",
    advice:
      "If you have significant income from both sources, check with HMRC or a Chartered Accountant whether you are due a refund, or can defer part of your Class 4 payment.",
  },
  {
    topic: "Pension Annual Allowance tapering (different from the Personal Allowance taper)",
    whyExcluded:
      "This app models the Personal Allowance taper above £100,000 of income. It does not model the separate Pension Annual Allowance taper, which can reduce how much you're allowed to contribute to a pension tax-efficiently once your income exceeds a much higher threshold — a different mechanism with a different purpose that this app doesn't touch at all.",
    advice:
      "If your income is high enough that this might apply to you, a financial adviser or Chartered Accountant can check whether you've inadvertently exceeded your tapered allowance — the tax charge for doing so is separate from anything this calculator shows.",
  },
  {
    topic: "Benefits in kind (P11D)",
    whyExcluded:
      "Benefits from your employer, such as a company car or private medical cover, are reported to HMRC on a P11D form and taxed through your tax code or Self Assessment. This app asks for your taxable pay as a single figure and doesn't value benefits. A company car's taxable value, for example, depends on its list price and CO2 emissions.",
    advice:
      "The value of each benefit is shown on the P11D your employer gives you. Adding it to your salary here would overstate your National Insurance, because employees don't pay National Insurance on most benefits, so ask your employer or a Chartered Accountant how to treat it.",
  },
  {
    topic: "Marriage Allowance: checking your partner's side of the transfer",
    whyExcluded:
      "This app lets you model either side of a Marriage Allowance transfer. If you receive it, it warns you when your own income looks too high to qualify. If you give it, it warns you when your income is above your Personal Allowance. It only ever calculates one person's tax at a time, so it cannot check your partner's side of the same transfer, or how the two figures combine for the couple.",
    advice:
      "Run your partner's income through this calculator separately, with the opposite box ticked, or use GOV.UK's own Marriage Allowance checker, to confirm you both qualify before relying on the saving shown here.",
  },
  {
    topic: "Blind Person's Allowance and Married Couple's Allowance",
    whyExcluded:
      "Blind Person's Allowance adds to the Personal Allowance of someone registered as blind or severely sight impaired. Married Couple's Allowance is only available where at least one partner was born before 6 April 1935. Neither is modelled. They are different from Marriage Allowance, which this app does handle.",
    advice:
      "Check the rules and current amounts on GOV.UK, or ask HMRC to confirm what you are entitled to before relying on the figures shown here.",
  },
  {
    topic: "Non-UK residence, the Statutory Residence Test, and the foreign income and gains regime",
    whyExcluded:
      "Every calculation in this app assumes you're a straightforward UK tax resident. Whether that's actually true — for anyone who splits time between countries, has moved to or from the UK recently, or has used the old remittance basis (abolished from 6 April 2025 and replaced by a residence-based, four-year foreign income and gains regime) — is itself a genuinely complex legal determination (the Statutory Residence Test), not something any calculator at this scale should attempt.",
    advice:
      "If your residence status isn't straightforward, this is worth resolving with a Chartered Tax Adviser before using this calculator at all — it changes which UK taxes apply to you in the first place, not just the numbers within them.",
  },
  {
    topic: "Self Assessment payments on account",
    whyExcluded:
      "This app shows your estimated tax for the year. If you complete a Self Assessment return, HMRC may also ask for payments on account, which are two advance instalments towards next year's bill (due 31 January and 31 July), plus a balancing payment. Their timing and amounts depend on last year's bill and on tax already collected through PAYE, which this app can't see.",
    advice:
      "Your HMRC online account shows what is due and when. A Chartered Accountant can help you plan for the cash-flow effect, especially in the first year you file.",
  },
  {
    topic: "VAT, Inheritance Tax, and property purchase taxes",
    whyExcluded:
      "These are entirely different tax regimes from income tax, National Insurance, and Capital Gains Tax. They are not a gap in this calculator so much as outside what it was built to do. Property purchase taxes are Stamp Duty Land Tax (England and Northern Ireland), Land and Buildings Transaction Tax (Scotland) and Land Transaction Tax (Wales).",
    advice:
      "For VAT or Inheritance Tax planning, a Chartered Accountant is the right first call. For the tax on a property purchase, your conveyancing solicitor will normally calculate it as a standard part of the transaction.",
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
        className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-base font-medium text-slate-900 outline-none focus:border-brand-500 focus:bg-white"
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
