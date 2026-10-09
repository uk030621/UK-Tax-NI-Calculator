"use client";

import { useEffect, useState } from "react";
import { BandListEditor } from "@/components/BandListEditor";
import type { TaxYearRates } from "@/lib/calculateTax";

interface Band {
  threshold: number;
  rate: number;
}

interface Draft {
  taxYear: string;
  personalAllowance: number;
  ukBands: Band[];
  scotlandBands: Band[];
  propertyAllowance: number;
  tradingAllowance: number;
  rentARoomThreshold: number;
  mortgageInterestReliefRate: number;
  psaBasic: number;
  psaHigher: number;
  startingRateBand: number;
  savingsBands: Band[];
  dividendAllowance: number;
  dividendBands: Band[];
  cgtAEA: number;
  cgtBands: Band[];
  niPrimaryThreshold: number;
  niUEL: number;
  niBands: Band[];
  class4LowerProfitsLimit: number;
  class4UpperProfitsLimit: number;
  class4Bands: Band[];
  class2SmallProfitsThreshold: number;
  class2VoluntaryWeeklyRate: number;
  hicbcThresholdStart: number;
  hicbcThresholdFull: number;
  studentLoanPlan1: number;
  studentLoanPlan2: number;
  studentLoanPlan4: number;
  studentLoanPlan5: number;
  studentLoanPostgraduate: number;
  studentLoanUndergraduateRate: number;
  studentLoanPostgraduateRate: number;
  marriageAllowanceTransferable: number;
}

const blankDraft: Draft = {
  taxYear: "",
  personalAllowance: 12570,
  ukBands: [
    { threshold: 0, rate: 0.2 },
    { threshold: 37700, rate: 0.4 },
    { threshold: 125140, rate: 0.45 },
  ],
  scotlandBands: [
    { threshold: 0, rate: 0.19 },
    { threshold: 3968, rate: 0.2 },
    { threshold: 16957, rate: 0.21 },
    { threshold: 31093, rate: 0.42 },
    { threshold: 62431, rate: 0.45 },
    { threshold: 112570, rate: 0.48 },
  ],
  propertyAllowance: 1000,
  mortgageInterestReliefRate: 0.2,
  psaBasic: 1000,
  psaHigher: 500,
  startingRateBand: 5000,
  savingsBands: [
    { threshold: 0, rate: 0.2 },
    { threshold: 37700, rate: 0.4 },
    { threshold: 125140, rate: 0.45 },
  ],
  dividendAllowance: 500,
  dividendBands: [
    { threshold: 0, rate: 0.0875 },
    { threshold: 37700, rate: 0.3375 },
    { threshold: 125140, rate: 0.3935 },
  ],
  cgtAEA: 3000,
  cgtBands: [
    { threshold: 0, rate: 0.18 },
    { threshold: 37700, rate: 0.24 },
  ],
  niPrimaryThreshold: 12570,
  niUEL: 50270,
  niBands: [
    { threshold: 12570, rate: 0.08 },
    { threshold: 50270, rate: 0.02 },
  ],
  tradingAllowance: 1000,
  rentARoomThreshold: 7500,
  class4LowerProfitsLimit: 12570,
  class4UpperProfitsLimit: 50270,
  class4Bands: [
    { threshold: 12570, rate: 0.06 },
    { threshold: 50270, rate: 0.02 },
  ],
  class2SmallProfitsThreshold: 7105,
  class2VoluntaryWeeklyRate: 3.65,
  hicbcThresholdStart: 60000,
  hicbcThresholdFull: 80000,
  studentLoanPlan1: 26900,
  studentLoanPlan2: 29385,
  studentLoanPlan4: 33795,
  studentLoanPlan5: 25000,
  studentLoanPostgraduate: 21000,
  studentLoanUndergraduateRate: 0.09,
  studentLoanPostgraduateRate: 0.06,
  marriageAllowanceTransferable: 1260,
};

function draftFromDocs(taxYear: string, uk: TaxYearRates, scotland: TaxYearRates): Draft {
  return {
    taxYear,
    personalAllowance: uk.personalAllowance,
    ukBands: uk.incomeTaxBands,
    scotlandBands: scotland.incomeTaxBands,
    propertyAllowance: uk.propertyAllowance,
    tradingAllowance: uk.tradingAllowance,
    rentARoomThreshold: uk.rentARoomThreshold ?? 7500,
    mortgageInterestReliefRate: uk.mortgageInterestReliefRate,
    psaBasic: uk.savingsAllowance.basicRate,
    psaHigher: uk.savingsAllowance.higherRate,
    startingRateBand: uk.savingsAllowance.startingRateBand,
    savingsBands: uk.savingsBands,
    dividendAllowance: uk.dividendAllowance,
    dividendBands: uk.dividendBands,
    cgtAEA: uk.capitalGains.annualExemptAmount,
    cgtBands: uk.capitalGains.bands,
    niPrimaryThreshold: uk.nationalInsurance.primaryThreshold,
    niUEL: uk.nationalInsurance.upperEarningsLimit,
    niBands: uk.nationalInsurance.bands,
    class4LowerProfitsLimit: uk.nationalInsuranceClass4.lowerProfitsLimit,
    class4UpperProfitsLimit: uk.nationalInsuranceClass4.upperProfitsLimit,
    class4Bands: uk.nationalInsuranceClass4.bands,
    class2SmallProfitsThreshold: uk.selfEmployedClass2.smallProfitsThreshold,
    class2VoluntaryWeeklyRate: uk.selfEmployedClass2.voluntaryWeeklyRate,
    hicbcThresholdStart: uk.hicbc.thresholdStart,
    hicbcThresholdFull: uk.hicbc.thresholdFull,
    studentLoanPlan1: uk.studentLoan.thresholds.plan1,
    studentLoanPlan2: uk.studentLoan.thresholds.plan2,
    studentLoanPlan4: uk.studentLoan.thresholds.plan4,
    studentLoanPlan5: uk.studentLoan.thresholds.plan5,
    studentLoanPostgraduate: uk.studentLoan.thresholds.postgraduate,
    studentLoanUndergraduateRate: uk.studentLoan.undergraduateRate,
    studentLoanPostgraduateRate: uk.studentLoan.postgraduateRate,
    marriageAllowanceTransferable: uk.marriageAllowanceTransferable,
  };
}

function draftToDocs(draft: Draft): { uk: TaxYearRates; scotland: TaxYearRates } {
  const shared = {
    taxYear: draft.taxYear,
    personalAllowance: draft.personalAllowance,
    propertyAllowance: draft.propertyAllowance,
    tradingAllowance: draft.tradingAllowance,
    rentARoomThreshold: draft.rentARoomThreshold,
    mortgageInterestReliefRate: draft.mortgageInterestReliefRate,
    savingsAllowance: {
      basicRate: draft.psaBasic,
      higherRate: draft.psaHigher,
      startingRateBand: draft.startingRateBand,
    },
    savingsBands: draft.savingsBands,
    dividendAllowance: draft.dividendAllowance,
    dividendBands: draft.dividendBands,
    capitalGains: { annualExemptAmount: draft.cgtAEA, bands: draft.cgtBands },
    nationalInsurance: {
      primaryThreshold: draft.niPrimaryThreshold,
      upperEarningsLimit: draft.niUEL,
      bands: draft.niBands,
    },
    nationalInsuranceClass4: {
      lowerProfitsLimit: draft.class4LowerProfitsLimit,
      upperProfitsLimit: draft.class4UpperProfitsLimit,
      bands: draft.class4Bands,
    },
    selfEmployedClass2: {
      smallProfitsThreshold: draft.class2SmallProfitsThreshold,
      voluntaryWeeklyRate: draft.class2VoluntaryWeeklyRate,
    },
    hicbc: {
      thresholdStart: draft.hicbcThresholdStart,
      thresholdFull: draft.hicbcThresholdFull,
    },
    studentLoan: {
      thresholds: {
        plan1: draft.studentLoanPlan1,
        plan2: draft.studentLoanPlan2,
        plan4: draft.studentLoanPlan4,
        plan5: draft.studentLoanPlan5,
        postgraduate: draft.studentLoanPostgraduate,
      },
      undergraduateRate: draft.studentLoanUndergraduateRate,
      postgraduateRate: draft.studentLoanPostgraduateRate,
    },
    marriageAllowanceTransferable: draft.marriageAllowanceTransferable,
  };
  return {
    uk: { ...shared, region: "uk", incomeTaxBands: draft.ukBands },
    scotland: { ...shared, region: "scotland", incomeTaxBands: draft.scotlandBands },
  };
}

export function AdminTaxYearForm() {
  const [existingDocs, setExistingDocs] = useState<TaxYearRates[]>([]);
  const [copyFromYear, setCopyFromYear] = useState("");
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/tax-years")
      .then((res) => res.json())
      .then((data: { taxYears: TaxYearRates[] }) => setExistingDocs(data.taxYears ?? []))
      .catch(() => setErrorMsg("Could not load existing tax years."));
  }, []);

  const distinctYears = Array.from(new Set(existingDocs.map((d) => d.taxYear))).sort().reverse();

  function applyCopyFrom(year: string) {
    setCopyFromYear(year);
    if (!year) return;
    const uk = existingDocs.find((d) => d.taxYear === year && d.region === "uk");
    const scotland = existingDocs.find((d) => d.taxYear === year && d.region === "scotland");
    if (uk && scotland) {
      setDraft((prev) => ({ ...draftFromDocs(prev.taxYear, uk, scotland) }));
    }
  }

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    if (!draft.taxYear) {
      setStatus("error");
      setErrorMsg("Enter a tax year, e.g. 2027-28.");
      return;
    }

    const { uk, scotland } = draftToDocs(draft);

    try {
      for (const doc of [uk, scotland]) {
        const res = await fetch("/api/admin/tax-years", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(doc),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Save failed");
        }
      }
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="New tax year"
            type="text"
            value={draft.taxYear}
            onChange={(v) => update("taxYear", v)}
            placeholder="e.g. 2027-28"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Copy figures from
            </label>
            <select
              value={copyFromYear}
              onChange={(e) => applyCopyFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium text-slate-900 outline-none focus:border-brand-500 focus:bg-white"
            >
              <option value="">Start from scratch</option>
              {distinctYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        {copyFromYear && (
          <p className="mt-3 text-xs text-slate-400">
            Every field below is prefilled from {copyFromYear} — HMRC freezes most
            thresholds most years, so usually only a handful of numbers need to
            change. Review each section against this year&apos;s Budget and edit
            only what moved.
          </p>
        )}
      </div>

      <Section title="Personal allowance">
        <NumberField
          label="Personal allowance"
          value={draft.personalAllowance}
          onChange={(v) => update("personalAllowance", Number(v))}
          prefix="£"
        />
      </Section>

      <Section
        title="Non-savings income tax — rest of UK"
        subtitle="Salary and rental profit, rUK taxpayers"
      >
        <BandListEditor bands={draft.ukBands} onChange={(b) => update("ukBands", b)} />
      </Section>

      <Section
        title="Non-savings income tax — Scotland"
        subtitle="Salary and rental profit, Scottish taxpayers"
      >
        <BandListEditor bands={draft.scotlandBands} onChange={(b) => update("scotlandBands", b)} />
      </Section>

      <Section title="Rental property allowance">
        <NumberField
          label="Flat property allowance"
          value={draft.propertyAllowance}
          onChange={(v) => update("propertyAllowance", Number(v))}
          prefix="£"
        />
      </Section>

      <Section
        title="Rent-a-Room Scheme"
        subtitle="Letting a furnished room in the taxpayer's own home — halved to this amount each when shared, handled automatically"
      >
        <NumberField
          label="Tax-free threshold (full amount, not the shared figure)"
          value={draft.rentARoomThreshold}
          onChange={(v) => update("rentARoomThreshold", Number(v))}
          prefix="£"
        />
      </Section>

      <Section
        title="Mortgage interest relief (Section 24)"
        subtitle="Flat-rate credit, not a deduction — same rate for every tax band"
      >
        <NumberField
          label="Relief rate"
          value={(draft.mortgageInterestReliefRate * 100).toFixed(2).replace(/\.?0+$/, "") || "0"}
          onChange={(v) => update("mortgageInterestReliefRate", (Number(v) || 0) / 100)}
          suffix="%"
        />
        <p className="mt-2 text-xs text-slate-400">
          20% since 2020/21. Due to rise to 22% alongside new separate
          property-income tax rates from April 2027 — check the latest
          Budget documents before rolling that year forward.
        </p>
      </Section>

      <Section title="Savings interest" subtitle="Always rUK rates, both regions">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Personal savings allowance (basic rate)"
            value={draft.psaBasic}
            onChange={(v) => update("psaBasic", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Personal savings allowance (higher rate)"
            value={draft.psaHigher}
            onChange={(v) => update("psaHigher", Number(v))}
            prefix="£"
          />
        </div>
        <div className="mt-4">
          <NumberField
            label="Starting rate for savings band"
            value={draft.startingRateBand}
            onChange={(v) => update("startingRateBand", Number(v))}
            prefix="£"
          />
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-slate-700">Savings tax bands</p>
          <BandListEditor bands={draft.savingsBands} onChange={(b) => update("savingsBands", b)} />
        </div>
      </Section>

      <Section title="Dividends" subtitle="Always rUK rates, both regions">
        <NumberField
          label="Dividend allowance"
          value={draft.dividendAllowance}
          onChange={(v) => update("dividendAllowance", Number(v))}
          prefix="£"
        />
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-slate-700">Dividend tax bands</p>
          <BandListEditor bands={draft.dividendBands} onChange={(b) => update("dividendBands", b)} />
        </div>
      </Section>

      <Section title="Capital gains tax" subtitle="Always rUK rates, both regions">
        <NumberField
          label="Annual exempt amount"
          value={draft.cgtAEA}
          onChange={(v) => update("cgtAEA", Number(v))}
          prefix="£"
        />
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-slate-700">CGT bands</p>
          <BandListEditor bands={draft.cgtBands} onChange={(b) => update("cgtBands", b)} />
        </div>
      </Section>

      <Section title="National Insurance (Class 1)" subtitle="Employment income only, both regions">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Primary threshold"
            value={draft.niPrimaryThreshold}
            onChange={(v) => update("niPrimaryThreshold", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Upper earnings limit"
            value={draft.niUEL}
            onChange={(v) => update("niUEL", Number(v))}
            prefix="£"
          />
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-slate-700">NI bands</p>
          <BandListEditor bands={draft.niBands} onChange={(b) => update("niBands", b)} />
        </div>
      </Section>

      <Section
        title="Self-employment"
        subtitle="Trading allowance, Class 4 & Class 2 NI — both regions"
      >
        <NumberField
          label="Trading allowance"
          value={draft.tradingAllowance}
          onChange={(v) => update("tradingAllowance", Number(v))}
          prefix="£"
        />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <NumberField
            label="Class 4 lower profits limit"
            value={draft.class4LowerProfitsLimit}
            onChange={(v) => update("class4LowerProfitsLimit", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Class 4 upper profits limit"
            value={draft.class4UpperProfitsLimit}
            onChange={(v) => update("class4UpperProfitsLimit", Number(v))}
            prefix="£"
          />
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-slate-700">Class 4 NI bands</p>
          <BandListEditor bands={draft.class4Bands} onChange={(b) => update("class4Bands", b)} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <NumberField
            label="Class 2 small profits threshold"
            value={draft.class2SmallProfitsThreshold}
            onChange={(v) => update("class2SmallProfitsThreshold", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Class 2 voluntary weekly rate"
            value={draft.class2VoluntaryWeeklyRate}
            onChange={(v) => update("class2VoluntaryWeeklyRate", Number(v))}
            prefix="£"
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Class 2 is informational only since the 2024/25 abolition — above
          the small profits threshold it's £0 and treated as paid; below
          it, this weekly rate is what someone could pay voluntarily.
        </p>
      </Section>

      <Section
        title="High Income Child Benefit Charge"
        subtitle="Tapers between these two thresholds — unchanged since April 2024"
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Charge starts at (adjusted net income)"
            value={draft.hicbcThresholdStart}
            onChange={(v) => update("hicbcThresholdStart", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Full 100% clawback at"
            value={draft.hicbcThresholdFull}
            onChange={(v) => update("hicbcThresholdFull", Number(v))}
            prefix="£"
          />
        </div>
      </Section>

      <Section
        title="Student loan repayment thresholds"
        subtitle="Rates are stable (9% undergraduate, 6% postgraduate) but editable below too"
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Plan 1"
            value={draft.studentLoanPlan1}
            onChange={(v) => update("studentLoanPlan1", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Plan 2"
            value={draft.studentLoanPlan2}
            onChange={(v) => update("studentLoanPlan2", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Plan 4 (Scotland)"
            value={draft.studentLoanPlan4}
            onChange={(v) => update("studentLoanPlan4", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Plan 5"
            value={draft.studentLoanPlan5}
            onChange={(v) => update("studentLoanPlan5", Number(v))}
            prefix="£"
          />
          <NumberField
            label="Postgraduate Loan"
            value={draft.studentLoanPostgraduate}
            onChange={(v) => update("studentLoanPostgraduate", Number(v))}
            prefix="£"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <NumberField
            label="Undergraduate rate (Plans 1/2/4/5)"
            value={(draft.studentLoanUndergraduateRate * 100).toFixed(2).replace(/\.?0+$/, "") || "0"}
            onChange={(v) => update("studentLoanUndergraduateRate", (Number(v) || 0) / 100)}
            suffix="%"
          />
          <NumberField
            label="Postgraduate rate"
            value={(draft.studentLoanPostgraduateRate * 100).toFixed(2).replace(/\.?0+$/, "") || "0"}
            onChange={(v) => update("studentLoanPostgraduateRate", (Number(v) || 0) / 100)}
            suffix="%"
          />
        </div>
      </Section>

      <Section
        title="Marriage Allowance"
        subtitle="10% of the Personal Allowance, rounded up to the nearest £10"
      >
        <NumberField
          label="Transferable amount"
          value={draft.marriageAllowanceTransferable}
          onChange={(v) => update("marriageAllowanceTransferable", Number(v))}
          prefix="£"
        />
      </Section>

      {status === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
      )}
      {status === "saved" && (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">
          Saved {draft.taxYear} for both regions.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
      >
        {status === "saving" ? "Saving…" : `Save ${draft.taxYear || "tax year"}`}
      </button>
    </form>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {subtitle && <p className="mb-4 text-xs text-slate-400">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  type = "number",
  placeholder,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  type?: "number" | "text";
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 bg-white py-2.5 ${
            prefix ? "pl-7" : "pl-3"
          } ${suffix ? "pr-8" : "pr-3"} text-sm font-medium text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
