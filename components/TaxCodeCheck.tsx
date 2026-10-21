"use client";

import { useMemo, useState } from "react";
import type { CalculationResult } from "@/lib/calculateTax";
import { compareTaxCodes, estimateTaxCode, type CodeRegion, type ComparisonStatus } from "@/lib/taxCode";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const STATUS_STYLE: Record<ComparisonStatus, string> = {
  match: "border-emerald-200 bg-emerald-50 text-emerald-900",
  close: "border-emerald-200 bg-emerald-50 text-emerald-900",
  lower: "border-amber-200 bg-amber-50 text-amber-900",
  higher: "border-amber-200 bg-amber-50 text-amber-900",
  different: "border-slate-200 bg-slate-50 text-slate-800",
  unreadable: "border-slate-200 bg-slate-50 text-slate-800",
};

const INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function toNumber(text: string): number {
  const n = Number(text.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Estimates the PAYE tax code that fits the figures just calculated and,
 * optionally, compares it with the code on the user's payslip or HMRC letter.
 * Shown only when there is employment or pension income to carry a code.
 */
export function TaxCodeCheck({ result, welsh = false }: { result: CalculationResult; welsh?: boolean }) {
  const codeRegion: CodeRegion = welsh ? "wales" : result.region;
  const [benefits, setBenefits] = useState("");
  const [untaxed, setUntaxed] = useState("");
  const [statePension, setStatePension] = useState("");
  const [underpaid, setUnderpaid] = useState("");
  const [entered, setEntered] = useState("");

  const hasPayeIncome = result.nonSavings.employmentGross + result.nonSavings.pensionGross > 0;

  // The rate the last pound of non-savings income is taxed at. Underpaid tax
  // is turned back into an allowance reduction at this rate.
  const marginalRate = useMemo(() => {
    const used = result.nonSavings.bands.filter((b) => b.taxable > 0);
    return used.length ? used[used.length - 1].rate : 0.2;
  }, [result]);

  const estimated = useMemo(
    () =>
      estimateTaxCode({
        region: codeRegion,
        allowance: result.personalAllowance,
        receivingMarriageAllowance: result.marriageAllowance.requested,
        givingMarriageAllowance: result.marriageAllowance.giving,
        benefitsInKind: toNumber(benefits),
        untaxedIncome: toNumber(untaxed),
        statePension: toNumber(statePension),
        underpaidTax: toNumber(underpaid),
        marginalRate,
      }),
    [result, codeRegion, benefits, untaxed, statePension, underpaid, marginalRate]
  );

  const comparison = useMemo(
    () => (entered.trim() ? compareTaxCodes(entered, estimated, codeRegion, marginalRate) : null),
    [entered, estimated, codeRegion, marginalRate]
  );

  if (!hasPayeIncome) return null;

  return (
    <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <summary className="cursor-pointer text-base font-bold text-brand-700">
        Check your tax code
      </summary>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg bg-brand-50 p-4 text-center">
          <p className="text-sm font-medium text-slate-600">Estimated tax code</p>
          <p className="mt-1 text-3xl font-bold tracking-wide text-brand-700">{estimated.code}</p>
        </div>

        <dl className="space-y-1 text-sm text-slate-700">
          {estimated.steps.map((s) => (
            <div key={s.label} className="flex justify-between gap-3">
              <dt>{s.label}</dt>
              <dd className="shrink-0 tabular-nums">
                {s.amount < 0 ? "−" : ""}
                {GBP.format(Math.abs(s.amount))}
              </dd>
            </div>
          ))}
        </dl>

        <p className="text-sm text-slate-600">
          Your tax code shows your allowance, not your tax band. Higher earners usually have the same code as
          everyone else (1257L) until income passes £100,000, when the allowance starts to reduce.
        </p>

        {result.marriedCouplesAllowance?.claimed && (
          <p className="text-sm text-slate-600">
            You are claiming Married Couple&apos;s Allowance. HMRC includes it in your code, but this estimate
            doesn&apos;t, so your actual code may be higher.
          </p>
        )}

        {estimated.notes.map((n) => (
          <p key={n} className="text-sm text-slate-600">
            {n}
          </p>
        ))}

        <p className="text-sm text-slate-500">
          HMRC may add things we can&apos;t see. Add any that apply to see how the code changes. Leave blank if none.
        </p>

        {result.nonSavings.pensionGross > 0 && (
          <label className="block text-sm font-medium text-slate-700">
            How much of your pension income is State Pension? (£ a year)
            <input
              inputMode="decimal"
              value={statePension}
              onChange={(e) => setStatePension(e.target.value)}
              placeholder="e.g. 11,973"
              className={INPUT}
            />
            <span className="mt-1 block text-sm font-normal text-slate-500">
              The State Pension is paid without tax taken off. HMRC collects the tax through your workplace or
              private pension (or job), which lowers that code. Leave blank if you have none.
            </span>
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Benefits in kind (£ a year)
            <input
              inputMode="decimal"
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="e.g. company car"
              className={INPUT}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Untaxed income (£ a year)
            <input
              inputMode="decimal"
              value={untaxed}
              onChange={(e) => setUntaxed(e.target.value)}
              placeholder="collected via code"
              className={INPUT}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Underpaid tax (£)
            <input
              inputMode="decimal"
              value={underpaid}
              onChange={(e) => setUnderpaid(e.target.value)}
              placeholder="from earlier years"
              className={INPUT}
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          The tax code on your payslip or HMRC letter
          <input
            value={entered}
            onChange={(e) => setEntered(e.target.value)}
            placeholder="e.g. 1257L"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={INPUT}
          />
        </label>

        {comparison && (
          <div className={`rounded-lg border p-4 text-sm ${STATUS_STYLE[comparison.status]}`} role="status">
            {comparison.messages.map((m, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {m}
              </p>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-400">
          This is an estimate for the common cases, not HMRC&apos;s own calculation. A difference is a reason to
          check, not proof of an error. Second jobs (BR, D0, D1), emergency codes and mid-year changes are not
          modelled. You can check or query your code with HMRC through your personal tax account.
        </p>
      </div>
    </details>
  );
}
