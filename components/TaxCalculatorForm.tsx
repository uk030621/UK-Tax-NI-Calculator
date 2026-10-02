"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { CalculationResult, BandBreakdown } from "@/lib/calculateTax";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1,
});

const RENTAL_EXPENSE_CATEGORIES = [
  "Letting agent / management fees",
  "Landlord insurance",
  "Repairs & maintenance",
  "Ground rent & service charges",
  "Council tax & utility bills (voids)",
  "Legal & professional fees",
  "Advertising & direct costs",
  "Other allowable expenses",
] as const;

const BUSINESS_EXPENSE_CATEGORIES = [
  "Cost of goods / materials",
  "Office costs (stationery, phone, software)",
  "Travel costs",
  "Business premises: rent, rates, utilities",
  "Staff costs",
  "Advertising & marketing",
  "Professional/legal/accountancy fees",
  "Other allowable business expenses",
] as const;

type Region = "uk" | "scotland";

interface IncomeFields {
  employmentIncome: string;
  pensionIncome: string;
  rentalIncome: string;
  rentalLossBroughtForward: string;
  mortgageInterest: string;
  financeCostsBroughtForward: string;
  selfEmploymentProfit: string;
  selfEmploymentLossBroughtForward: string;
  savingsInterest: string;
  dividendIncome: string;
  foreignTaxWithheldOnDividends: string;
  capitalGains: string;
  capitalLossesThisYear: string;
  capitalLossesBroughtForward: string;
  personalPensionContributions: string;
  giftAidDonations: string;
  mainResidenceGain: string;
  childBenefitReceived: string;
}

const emptyIncome: IncomeFields = {
  employmentIncome: "",
  pensionIncome: "",
  rentalIncome: "",
  rentalLossBroughtForward: "",
  mortgageInterest: "",
  financeCostsBroughtForward: "",
  selfEmploymentProfit: "",
  selfEmploymentLossBroughtForward: "",
  savingsInterest: "",
  dividendIncome: "",
  foreignTaxWithheldOnDividends: "",
  capitalGains: "",
  capitalLossesThisYear: "",
  capitalLossesBroughtForward: "",
  personalPensionContributions: "",
  giftAidDonations: "",
  mainResidenceGain: "",
  childBenefitReceived: "",
};

const emptyExpenses: Record<string, string> = Object.fromEntries(
  RENTAL_EXPENSE_CATEGORIES.map((c) => [c, ""])
);

const emptyBusinessExpenses: Record<string, string> = Object.fromEntries(
  BUSINESS_EXPENSE_CATEGORIES.map((c) => [c, ""])
);

interface HistoryEntry {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
  nonSavings?: {
    employmentGross?: number;
    pensionGross?: number;
    rentalGross?: number;
    rentalLossBroughtForward?: number;
    selfEmploymentGross?: number;
    selfEmploymentLossBroughtForward?: number;
  };
  mortgageInterestRelief?: { interestPaid?: number; financeCostsBroughtForward?: number };
  savings?: { gross?: number };
  dividends?: { gross?: number; foreignTaxWithheld?: number };
  capitalGainsTax?: {
    gross?: number;
    otherCapitalGains?: number;
    mainResidenceGain?: number;
    mainResidenceExempt?: boolean;
    lossesThisYear?: number;
    broughtForwardLossAvailable?: number;
  };
  reliefAtSource?: {
    personalPensionContributionsNet?: number;
    giftAidDonationsNet?: number;
  };
  hicbc?: { childBenefitReceived?: number };
  studentLoan?: {
    plan?: "none" | "plan1" | "plan2" | "plan4" | "plan5";
    hasPostgraduateLoan?: boolean;
  };
  marriageAllowance?: { requested?: boolean };
  netIncome?: number;
  taxYear?: string;
  region?: Region;
}

export function TaxCalculatorForm() {
  const { data: session } = useSession();

  const [years, setYears] = useState<string[]>([]);
  const [taxYear, setTaxYear] = useState<string>("");
  const [region, setRegion] = useState<Region>("uk");
  const [income, setIncome] = useState<IncomeFields>(emptyIncome);
  const [showOtherIncome, setShowOtherIncome] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [rentalExpenses, setRentalExpenses] = useState<Record<string, string>>(emptyExpenses);
  const [showBusinessExpenses, setShowBusinessExpenses] = useState(false);
  const [businessExpenses, setBusinessExpenses] = useState<Record<string, string>>(
    emptyBusinessExpenses
  );
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mainResidenceFullyExempt, setMainResidenceFullyExempt] = useState(false);
  const [studentLoanPlan, setStudentLoanPlan] = useState<"none" | "plan1" | "plan2" | "plan4" | "plan5">("none");
  const [hasPostgraduateLoan, setHasPostgraduateLoan] = useState(false);
  const [receivingMarriageAllowance, setReceivingMarriageAllowance] = useState(false);

  useEffect(() => {
    fetch("/api/tax-years")
      .then((res) => res.json())
      .then((data: { years: string[] }) => {
        setYears(data.years);
        if (data.years.length > 0) setTaxYear(data.years[0]);
      })
      .catch(() => setError("Could not load available tax years."));
  }, []);

  // For signed-in users, fetch their saved calculations — used both to
  // populate the history list below and to prefill the form from the
  // most recent entry as a convenience starting point.
  useEffect(() => {
    if (!session?.user) return;
    fetchHistory({ prefillFromMostRecent: true });
  }, [session?.user]);

  function fetchHistory({ prefillFromMostRecent = false } = {}) {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data: { history?: HistoryEntry[] }) => {
        const list = data.history ?? [];
        setHistoryList(list);
        if (prefillFromMostRecent && list[0]) {
          loadEntryIntoForm(list[0]);
          setPrefilled(true);
        }
      })
      .catch(() => {
        // Silently ignore — history/prefill is a convenience, not required.
      });
  }

  // Populates the form from a saved entry. Used for both the mount-time
  // prefill (asEdit=false — just a convenient starting point, saving
  // creates a new entry as usual) and the explicit "Edit" button on a
  // history row (asEdit=true — saving updates that entry instead).
  function loadEntryIntoForm(entry: HistoryEntry, asEdit = false) {
    setIncome({
      employmentIncome: entry.nonSavings?.employmentGross ? String(entry.nonSavings.employmentGross) : "",
      pensionIncome: entry.nonSavings?.pensionGross ? String(entry.nonSavings.pensionGross) : "",
      rentalIncome: entry.nonSavings?.rentalGross ? String(entry.nonSavings.rentalGross) : "",
      // Brought-forward figures only come back when editing THIS exact
      // saved entry — restoring what it already had is correct there.
      // During the generic mount-time prefill this might not even be the
      // right prior year, so auto-carrying a loss/credit forward here
      // would risk silently double-counting it — same reasoning as why
      // these three fields were never auto-filled on mount to begin with.
      rentalLossBroughtForward: asEdit && entry.nonSavings?.rentalLossBroughtForward ? String(entry.nonSavings.rentalLossBroughtForward) : "",
      mortgageInterest: entry.mortgageInterestRelief?.interestPaid ? String(entry.mortgageInterestRelief.interestPaid) : "",
      financeCostsBroughtForward: asEdit && entry.mortgageInterestRelief?.financeCostsBroughtForward ? String(entry.mortgageInterestRelief.financeCostsBroughtForward) : "",
      selfEmploymentProfit: entry.nonSavings?.selfEmploymentGross ? String(entry.nonSavings.selfEmploymentGross) : "",
      selfEmploymentLossBroughtForward: asEdit && entry.nonSavings?.selfEmploymentLossBroughtForward ? String(entry.nonSavings.selfEmploymentLossBroughtForward) : "",
      savingsInterest: entry.savings?.gross ? String(entry.savings.gross) : "",
      dividendIncome: entry.dividends?.gross ? String(entry.dividends.gross) : "",
      foreignTaxWithheldOnDividends: entry.dividends?.foreignTaxWithheld ? String(entry.dividends.foreignTaxWithheld) : "",
      capitalGains: entry.capitalGainsTax?.otherCapitalGains ? String(entry.capitalGainsTax.otherCapitalGains) : "",
      mainResidenceGain: entry.capitalGainsTax?.mainResidenceGain ? String(entry.capitalGainsTax.mainResidenceGain) : "",
      capitalLossesThisYear: entry.capitalGainsTax?.lossesThisYear ? String(entry.capitalGainsTax.lossesThisYear) : "",
      capitalLossesBroughtForward: asEdit && entry.capitalGainsTax?.broughtForwardLossAvailable ? String(entry.capitalGainsTax.broughtForwardLossAvailable) : "",
      personalPensionContributions: entry.reliefAtSource?.personalPensionContributionsNet ? String(entry.reliefAtSource.personalPensionContributionsNet) : "",
      giftAidDonations: entry.reliefAtSource?.giftAidDonationsNet ? String(entry.reliefAtSource.giftAidDonationsNet) : "",
      childBenefitReceived: entry.hicbc?.childBenefitReceived ? String(entry.hicbc.childBenefitReceived) : "",
    });
    setMainResidenceFullyExempt(Boolean(entry.capitalGainsTax?.mainResidenceExempt));
    setStudentLoanPlan(entry.studentLoan?.plan ?? "none");
    setHasPostgraduateLoan(Boolean(entry.studentLoan?.hasPostgraduateLoan));
    setReceivingMarriageAllowance(Boolean(entry.marriageAllowance?.requested));
    if (entry.taxYear) setTaxYear(entry.taxYear);
    if (entry.region) setRegion(entry.region);
    if (
      entry.nonSavings?.pensionGross ||
      entry.nonSavings?.rentalGross ||
      entry.nonSavings?.selfEmploymentGross ||
      entry.savings?.gross ||
      entry.dividends?.gross ||
      entry.capitalGainsTax?.gross ||
      entry.capitalGainsTax?.mainResidenceGain ||
      entry.hicbc?.childBenefitReceived ||
      entry.reliefAtSource?.personalPensionContributionsNet ||
      entry.reliefAtSource?.giftAidDonationsNet
    ) {
      setShowOtherIncome(true);
    }
    // Itemized expense category breakdowns aren't stored, only totals —
    // same limitation the mount-prefill already had, not new to editing.
    setRentalExpenses(emptyExpenses);
    setBusinessExpenses(emptyBusinessExpenses);
    setResult(null);
    setSaved(false);
    setError(null);
    if (asEdit) {
      setEditingId(entry._id ?? null);
      setPrefilled(false);
    }
  }

  function startNewCalculation() {
    setEditingId(null);
    setIncome(emptyIncome);
    setRentalExpenses(emptyExpenses);
    setBusinessExpenses(emptyBusinessExpenses);
    setMainResidenceFullyExempt(false);
    setStudentLoanPlan("none");
    setHasPostgraduateLoan(false);
    setReceivingMarriageAllowance(false);
    setShowOtherIncome(false);
    setShowExpenses(false);
    setShowBusinessExpenses(false);
    setError(null);
    setResult(null);
    setSaved(false);
    setPrefilled(false);
  }

  /** True if there's anything in the form worth protecting from an accidental "Clear all". */
  const formHasInput =
    Object.values(income).some((v) => v !== "") ||
    Object.values(rentalExpenses).some((v) => v !== "") ||
    Object.values(businessExpenses).some((v) => v !== "") ||
    mainResidenceFullyExempt ||
    studentLoanPlan !== "none" ||
    hasPostgraduateLoan ||
    receivingMarriageAllowance;

  function handleClearAll() {
    if (formHasInput) {
      const message = editingId
        ? "Clear everything you've entered? You'll stop editing this saved calculation — it stays saved exactly as it was."
        : "Clear everything you've entered?";
      if (!window.confirm(message)) return;
    }
    startNewCalculation();
  }

  async function handleDeleteEntry(id: string) {
    if (!id) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistoryList((prev) => prev.filter((e) => e._id !== id));
        if (editingId === id) {
          startNewCalculation();
        }
      }
    } finally {
      setDeletingId(null);
    }
  }

  function clearPrefill() {
    startNewCalculation();
  }

  function updateExpense(category: string, value: string) {
    setRentalExpenses((prev) => ({ ...prev, [category]: value }));
  }

  function updateBusinessExpense(category: string, value: string) {
    setBusinessExpenses((prev) => ({ ...prev, [category]: value }));
  }

  const rentalExpensesTotal = Object.values(rentalExpenses).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0
  );

  const businessExpensesTotal = Object.values(businessExpenses).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0
  );

  function updateField(field: keyof IncomeFields, value: string) {
    setIncome((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!taxYear) {
      setError("Select a tax year.");
      return;
    }

    const payload = {
      taxYear,
      region,
      employmentIncome: Number(income.employmentIncome) || 0,
      pensionIncome: Number(income.pensionIncome) || 0,
      rentalIncome: Number(income.rentalIncome) || 0,
      rentalExpenses: Object.entries(rentalExpenses)
        .filter(([, v]) => Number(v) > 0)
        .map(([category, v]) => ({ category, amount: Number(v) })),
      rentalLossBroughtForward: Number(income.rentalLossBroughtForward) || 0,
      mortgageInterest: Number(income.mortgageInterest) || 0,
      financeCostsBroughtForward: Number(income.financeCostsBroughtForward) || 0,
      selfEmploymentProfit: Number(income.selfEmploymentProfit) || 0,
      selfEmploymentLossBroughtForward: Number(income.selfEmploymentLossBroughtForward) || 0,
      selfEmploymentExpenses: Object.entries(businessExpenses)
        .filter(([, v]) => Number(v) > 0)
        .map(([category, v]) => ({ category, amount: Number(v) })),
      savingsInterest: Number(income.savingsInterest) || 0,
      dividendIncome: Number(income.dividendIncome) || 0,
      foreignTaxWithheldOnDividends: Number(income.foreignTaxWithheldOnDividends) || 0,
      capitalGains: Number(income.capitalGains) || 0,
      capitalLossesThisYear: Number(income.capitalLossesThisYear) || 0,
      capitalLossesBroughtForward: Number(income.capitalLossesBroughtForward) || 0,
      personalPensionContributions: Number(income.personalPensionContributions) || 0,
      giftAidDonations: Number(income.giftAidDonations) || 0,
      mainResidenceGain: Number(income.mainResidenceGain) || 0,
      mainResidenceFullyExempt,
      childBenefitReceived: Number(income.childBenefitReceived) || 0,
      studentLoanPlan,
      hasPostgraduateLoan,
      receivingMarriageAllowance,
    };

    setLoading(true);
    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Calculation failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    const isEditing = Boolean(editingId);
    const res = await fetch(isEditing ? `/api/history/${editingId}` : "/api/history", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (res.ok) {
      setSaved(true);
      fetchHistory(); // refresh the list so it reflects the change immediately
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-5">
          {editingId && (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span>
                Editing your saved {taxYear || ""} calculation — Save will update it, not create a new one
              </span>
              <button
                type="button"
                onClick={startNewCalculation}
                className="font-medium underline hover:no-underline"
              >
                Start new instead
              </button>
            </div>
          )}

          {prefilled && !editingId && (
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              <span>Prefilled from your last saved calculation</span>
              <button
                type="button"
                onClick={clearPrefill}
                className="font-medium underline hover:no-underline"
              >
                Clear
              </button>
            </div>
          )}

          <MoneyField
            label="Employment income (salary)"
            value={income.employmentIncome}
            onChange={(v) => updateField("employmentIncome", v)}
            placeholder="e.g. 45,000"
          />
          <p className="-mt-3 text-xs text-slate-400">
            Use your taxable pay — the &quot;pay&quot; figure on your P60, which is already
            after any pension contributions (including AVCs) taken from your payslip before tax.
            Paying into a personal pension or SIPP yourself? That goes under
            Reliefs, in the &quot;Add…&quot; section below.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tax year
              </label>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
              >
                {years.length === 0 && <option value="">No years found</option>}
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Region
              </label>
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(["uk", "scotland"] as Region[]).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRegion(r)}
                    className={`flex-1 rounded-lg py-1.5 text-sm font-medium capitalize transition ${
                      region === r
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {r === "uk" ? "Rest of UK" : "Scotland"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl bg-slate-50 p-4">
            <div>
              <CategoryHeader label="Student loan" />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Student loan plan
                </label>
                <select
                  value={studentLoanPlan}
                  onChange={(e) => setStudentLoanPlan(e.target.value as typeof studentLoanPlan)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-sm font-medium text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="none">No undergraduate loan</option>
                  <option value="plan1">Plan 1</option>
                  <option value="plan2">Plan 2</option>
                  <option value="plan4">Plan 4 (Scotland)</option>
                  <option value="plan5">Plan 5</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-400">
                  Not sure which plan? Check your annual statement at{" "}
                  gov.uk/sign-in-to-manage-your-student-loan-balance.
                </p>
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={hasPostgraduateLoan}
                  onChange={(e) => setHasPostgraduateLoan(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  I also have a Postgraduate Loan (this can run alongside
                  an undergraduate plan — both are repaid at once)
                </span>
              </label>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <CategoryHeader label="Marriage Allowance" />
              <label className="flex items-start gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={receivingMarriageAllowance}
                  onChange={(e) => setReceivingMarriageAllowance(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  My spouse or civil partner is transferring their Marriage
                  Allowance to me
                </span>
              </label>
              <p className="mt-1.5 text-xs text-slate-400">
                Only tick this if you're the <strong className="text-slate-500">recipient</strong>.
                Two conditions apply that this app can't check for you:
                your partner must have unused Personal Allowance
                themselves (broadly, their own income is below £12,570),
                and you must not be a higher or additional-rate taxpayer
                — if your own income turns out too high once you
                calculate, the results will flag that you may not
                actually be eligible.
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowOtherIncome((v) => !v)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {showOtherIncome ? "− Hide other income, reliefs & Child Benefit" : "+ Add pension, self-employment, rental, savings, dividends, gains, reliefs or Child Benefit"}
            </button>
          </div>

          {showOtherIncome && (
            <div className="space-y-4 rounded-xl bg-slate-50 p-4">
              <div>
                <CategoryHeader label="Pension" />
                <MoneyField
                  label="Pension income"
                  value={income.pensionIncome}
                  onChange={(v) => updateField("pensionIncome", v)}
                  placeholder="e.g. 15,000"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  State Pension, workplace or private pension income — taxed
                  the same as salary, but never subject to National
                  Insurance. Keep this separate from Employment income above
                  so NI isn't wrongly applied to it.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <CategoryHeader label="Rental" />
                <MoneyField
                  label="Rental profit (before expenses/allowance)"
                  value={income.rentalIncome}
                  onChange={(v) => updateField("rentalIncome", v)}
                  placeholder="e.g. 12,000"
                />
                <button
                  type="button"
                  onClick={() => setShowExpenses((v) => !v)}
                  className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {showExpenses
                    ? "− Hide itemized expenses"
                    : "+ Itemize allowable expenses (instead of the £1,000 allowance)"}
                </button>

                {showExpenses && (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    {RENTAL_EXPENSE_CATEGORIES.map((category) => (
                      <div key={category} className="flex items-center gap-2">
                        <label className="flex-1 text-xs text-slate-600">{category}</label>
                        <div className="relative w-28">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            £
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={rentalExpenses[category]}
                            onChange={(e) => updateExpense(category, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 py-1.5 pl-5 pr-2 text-sm outline-none focus:border-brand-500"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="text-slate-500">Total itemized expenses</span>
                      <span className="font-semibold text-slate-800">
                        {GBP.format(rentalExpensesTotal)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      The calculator automatically uses whichever is worth more — this
                      total or the £1,000 flat allowance — so it's fine to fill this in
                      even if it comes to less than £1,000.
                    </p>
                  </div>
                )}

                <div className="mt-3">
                  <MoneyField
                    label="Rental losses brought forward from last year"
                    value={income.rentalLossBroughtForward}
                    onChange={(v) => updateField("rentalLossBroughtForward", v)}
                    placeholder="e.g. 2,000"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    From last year's results, if your expenses exceeded your
                    rental income. Relieved against this year's rental profit
                    first — any amount still unused carries forward again.
                  </p>
                </div>

                <div className="mt-3">
                  <MoneyField
                    label="Mortgage interest paid"
                    value={income.mortgageInterest}
                    onChange={(v) => updateField("mortgageInterest", v)}
                    placeholder="e.g. 6,000"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    Not deducted from rental profit — since 2020/21 it earns a
                    flat-rate tax credit against your final bill instead,
                    applied automatically at whatever rate this tax year uses
                    (20% for 2025/26 and 2026/27), regardless of your tax band.
                  </p>
                </div>

                <div className="mt-3">
                  <MoneyField
                    label="Unused finance costs brought forward from last year"
                    value={income.financeCostsBroughtForward}
                    onChange={(v) => updateField("financeCostsBroughtForward", v)}
                    placeholder="e.g. 1,000"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    From last year's results, if your mortgage interest
                    relief was capped below the full amount paid. Added to
                    this year's interest before the same cap is applied.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <CategoryHeader label="Self-employment" />
                <MoneyField
                  label="Self-employment income (before expenses/allowance)"
                  value={income.selfEmploymentProfit}
                  onChange={(v) => updateField("selfEmploymentProfit", v)}
                  placeholder="e.g. 20,000"
                />
                <button
                  type="button"
                  onClick={() => setShowBusinessExpenses((v) => !v)}
                  className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {showBusinessExpenses
                    ? "− Hide itemized business expenses"
                    : "+ Itemize business expenses (instead of the £1,000 trading allowance)"}
                </button>

                {showBusinessExpenses && (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    {BUSINESS_EXPENSE_CATEGORIES.map((category) => (
                      <div key={category} className="flex items-center gap-2">
                        <label className="flex-1 text-xs text-slate-600">{category}</label>
                        <div className="relative w-28">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            £
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={businessExpenses[category]}
                            onChange={(e) => updateBusinessExpense(category, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 py-1.5 pl-5 pr-2 text-sm outline-none focus:border-brand-500"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="text-slate-500">Total itemized business expenses</span>
                      <span className="font-semibold text-slate-800">
                        {GBP.format(businessExpensesTotal)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Same rule as rental — whichever is worth more (this total
                      or the £1,000 trading allowance) is used automatically.
                    </p>
                  </div>
                )}

                <p className="mt-2 text-xs text-slate-400">
                  Taxed via Class 4 National Insurance (6%/2%) rather than the
                  Class 1 rate used for salary. Class 2 is shown as an
                  informational note in your results — it's £0 to pay above
                  the small profits threshold since the 2024/25 abolition.
                </p>

                <div className="mt-3">
                  <MoneyField
                    label="Self-employment losses brought forward from last year"
                    value={income.selfEmploymentLossBroughtForward}
                    onChange={(v) => updateField("selfEmploymentLossBroughtForward", v)}
                    placeholder="e.g. 3,000"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    From last year's results, if your business expenses
                    exceeded your self-employment income. Relieved against
                    this year's trading profit first — any amount still
                    unused carries forward again.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <CategoryHeader label="Savings interest" />
                <MoneyField
                  label="Savings interest"
                  value={income.savingsInterest}
                  onChange={(v) => updateField("savingsInterest", v)}
                  placeholder="e.g. 800"
                />
              </div>
              <div className="border-t border-slate-200 pt-4">
                <CategoryHeader label="Dividends" />
                <MoneyField
                  label="Dividend income"
                  value={income.dividendIncome}
                  onChange={(v) => updateField("dividendIncome", v)}
                  placeholder="e.g. 1,500"
                />
                <div className="mt-3">
                  <MoneyField
                    label="Foreign tax already withheld on these dividends"
                    value={income.foreignTaxWithheldOnDividends}
                    onChange={(v) => updateField("foreignTaxWithheldOnDividends", v)}
                    placeholder="e.g. 225"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    E.g. US shares: with a W-8BEN on file, the US withholds
                    15% at source. Enter that amount here and it's credited
                    against your UK dividend tax (never more than the UK tax
                    actually due, and never as a refund) — so you're not
                    taxed twice on the same dividend.
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <CategoryHeader label="Capital gains" />

                <div>
                  <MoneyField
                    label="Gain on selling your only or main home"
                    value={income.mainResidenceGain}
                    onChange={(v) => updateField("mainResidenceGain", v)}
                    placeholder="e.g. 80,000"
                  />
                  <label className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={mainResidenceFullyExempt}
                      onChange={(e) => setMainResidenceFullyExempt(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      This was my only or main home for the entire time I
                      owned it — no separate letting, no business use, no
                      periods it wasn't my home. (Fully exempt under Private
                      Residence Relief if checked.)
                    </span>
                  </label>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Only the clean, full-relief case is calculated. If any
                    part of the period doesn't qualify — you let it out, ran
                    a business from part of it, or lived elsewhere for a
                    stretch — leave this unchecked. The app will then tax
                    the whole gain as if none of it were exempt, which will
                    likely overstate your real bill (HMRC would actually
                    give you <em>partial</em> relief) — treat that figure as a
                    conservative estimate, not a final answer, and get
                    proper advice for a mixed-use or partial-relief sale.
                  </p>
                </div>

                <div className="mt-3">
                  <MoneyField
                    label="Other capital gains (total, before annual exemption)"
                    value={income.capitalGains}
                    onChange={(v) => updateField("capitalGains", v)}
                    placeholder="e.g. 15,000"
                  />
                </div>
                <div className="mt-3">
                  <MoneyField
                    label="Capital losses this year"
                    value={income.capitalLossesThisYear}
                    onChange={(v) => updateField("capitalLossesThisYear", v)}
                    placeholder="e.g. 2,000"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    From anything you sold at a loss in the same tax year.
                    These must be set against this year's gains in full —
                    unlike brought-forward losses below, you can't choose
                    to save any of this year's loss for later.
                  </p>
                </div>
                <div className="mt-3">
                  <MoneyField
                    label="Capital losses brought forward from earlier years"
                    value={income.capitalLossesBroughtForward}
                    onChange={(v) => updateField("capitalLossesBroughtForward", v)}
                    placeholder="e.g. 5,000"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    Only used if a taxable gain remains after the annual
                    exempt amount — and only down to that level, never
                    below it, so you never burn through more of an old
                    loss than you actually need to this year.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <CategoryHeader label="Reliefs" />
                <MoneyField
                  label="Personal pension contributions (relief at source)"
                  value={income.personalPensionContributions}
                  onChange={(v) => updateField("personalPensionContributions", v)}
                  placeholder="e.g. 4,000"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Only for "relief at source" pensions — most personal
                  pensions/SIPPs, some workplace schemes, and some AVCs
                  (Additional Voluntary Contributions) paid to a separate
                  provider. Enter the amount you actually paid; basic-rate
                  relief is added automatically and doesn't need entering
                  here.
                  <strong className="text-slate-500">
                    {" "}Don't enter workplace pension contributions —
                    including most AVCs paid into your main scheme —
                    already taken from your payslip before tax
                  </strong>{" "}
                  ("net pay arrangement," most auto-enrolment schemes) —
                  those are already reflected in your Employment income
                  above, and entering them again here would double-claim
                  relief you've already had.
                </p>
                <div className="mt-3">
                  <MoneyField
                    label="Gift Aid donations"
                    value={income.giftAidDonations}
                    onChange={(v) => updateField("giftAidDonations", v)}
                    placeholder="e.g. 800"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    The amount you actually donated to charity through Gift
                    Aid. Works the same way as pension contributions above
                    — basic-rate relief is claimed automatically by the
                    charity, and this figure extends your basic and
                    higher-rate bands for any further relief you're due.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <CategoryHeader label="Child Benefit" />
                <MoneyField
                  label="Child Benefit received this year"
                  value={income.childBenefitReceived}
                  onChange={(v) => updateField("childBenefitReceived", v)}
                  placeholder="e.g. 1,355"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Only enter this if <strong className="text-slate-500">you</strong> are
                  the higher earner in your household — the High Income
                  Child Benefit Charge is worked out on whichever partner
                  earns more, not on whoever actually claims the benefit,
                  and not on your combined household income. It tapers
                  away gradually between £60,000 and £80,000 of adjusted
                  net income, fully clawed back at £80,000 and above.
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
            >
              {loading ? "Calculating…" : "Calculate"}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={loading || (!formHasInput && !result && !editingId)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear all
            </button>
          </div>
        </div>
      </form>

      {result && <ResultCard result={result} />}

      {result && (
        <div className="text-center">
          {session?.user ? (
            <button
              onClick={handleSave}
              disabled={saved}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:text-slate-400"
            >
              {saved
                ? editingId
                  ? "Updated ✓"
                  : "Saved to your history ✓"
                : editingId
                ? "Update saved calculation"
                : "Save this calculation"}
            </button>
          ) : (
            <p className="text-sm text-slate-400">
              Sign in with Google to save calculations to your history.
            </p>
          )}
        </div>
      )}

      {session?.user && historyList.length > 0 && (
        <SavedCalculationsList
          entries={historyList}
          editingId={editingId}
          deletingId={deletingId}
          onEdit={(entry) => loadEntryIntoForm(entry, true)}
          onDelete={handleDeleteEntry}
        />
      )}
    </div>
  );
}

function SavedCalculationsList({
  entries,
  editingId,
  deletingId,
  onEdit,
  onDelete,
}: {
  entries: HistoryEntry[];
  editingId: string | null;
  deletingId: string | null;
  onEdit: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-slate-800">Your saved calculations</p>
      <div className="space-y-2">
        {entries.map((entry) => {
          const id = entry._id;
          if (!id) return null;
          const isThisEditing = editingId === id;
          const isThisDeleting = deletingId === id;
          const savedDate = entry.createdAt ? new Date(entry.createdAt) : null;
          return (
            <div
              key={id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                isThisEditing ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-slate-50"
              }`}
            >
              <div>
                <p className="font-medium text-slate-800">
                  {entry.taxYear ?? "Unknown year"} · {entry.region === "scotland" ? "Scotland" : "Rest of UK"}
                </p>
                <p className="text-xs text-slate-400">
                  {typeof entry.netIncome === "number" ? `Net income ${GBP.format(entry.netIncome)}` : ""}
                  {savedDate ? ` · saved ${savedDate.toLocaleDateString("en-GB")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Delete this saved calculation? This can't be undone.")) {
                      onDelete(id);
                    }
                  }}
                  disabled={isThisDeleting}
                  className="text-xs font-medium text-red-500 hover:text-red-600 disabled:text-slate-300"
                >
                  {isThisDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryHeader({ label }: { label: string }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}
    </p>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          £
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-base font-medium text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: CalculationResult }) {
  // The bar's total is income plus gains *after this year's capital
  // losses* — the same base the net figure is calculated from — so that
  // net + income tax + NI + CGT + the other deductions below add up to
  // exactly 100% with no gap at the end.
  const totalBase =
    result.totalGrossIncome + result.capitalGainsTax.netGainsAfterCurrentYearLosses;
  const totalNI = result.nationalInsurance.total + result.nationalInsuranceClass4.total;
  const studentLoan = result.studentLoan.totalRepayment;
  const childBenefitCharge = result.hicbc.charge;
  const otherDeductions = studentLoan + childBenefitCharge;
  const otherLabel =
    studentLoan > 0 && childBenefitCharge > 0
      ? "Other deductions"
      : studentLoan > 0
      ? "Student loan"
      : "Child Benefit charge";
  const share = (amount: number) => (totalBase > 0 ? Math.max(0, amount) / totalBase : 0);
  const netPct = share(result.netIncome);
  const taxPct = share(result.totalIncomeTax);
  const niPct = share(totalNI);
  const cgtPct = share(result.capitalGainsTax.tax);
  const otherPct = share(otherDeductions);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <p className="text-sm text-slate-500">Take-home / net position</p>
          <p className="text-3xl font-semibold tracking-tight text-slate-900">
            {GBP.format(result.netIncome)}
          </p>
        </div>
        <p className="text-sm font-medium text-slate-400">
          {PERCENT.format(result.effectiveTaxRate)} effective rate
        </p>
      </div>

      <div className="mb-6 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-brand-500" style={{ width: `${netPct * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${taxPct * 100}%` }} />
        <div className="bg-rose-400" style={{ width: `${niPct * 100}%` }} />
        <div className="bg-violet-400" style={{ width: `${cgtPct * 100}%` }} />
        <div className="bg-slate-400" style={{ width: `${otherPct * 100}%` }} />
      </div>

      <dl
        className={`grid gap-2 text-center ${
          otherDeductions > 0 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-4"
        }`}
      >
        <Legend color="bg-brand-500" label="Net" value={GBP.format(result.netIncome)} />
        <Legend color="bg-amber-400" label="Income tax" value={GBP.format(result.totalIncomeTax)} />
        <Legend color="bg-rose-400" label="NI" value={GBP.format(totalNI)} />
        <Legend color="bg-violet-400" label="CGT" value={GBP.format(result.capitalGainsTax.tax)} />
        {otherDeductions > 0 && (
          <Legend color="bg-slate-400" label={otherLabel} value={GBP.format(otherDeductions)} />
        )}
      </dl>

      <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
        {result.nonSavings.gross > 0 && (
          <IncomeSection
            title="Employment, pension, rental & self-employment"
            subtitle={rentalDeductionSubtitle(result.nonSavings)}
            bands={result.nonSavings.bands}
            tax={result.nonSavings.tax}
          />
        )}

        {result.nonSavings.selfEmploymentGross > 0 && selfEmploymentDeductionSubtitle(result.nonSavings) && (
          <p className="-mt-2 text-xs text-slate-400">
            {selfEmploymentDeductionSubtitle(result.nonSavings)}
          </p>
        )}

        {rentalLossNote(result.nonSavings) && (
          <p className="-mt-2 text-xs text-slate-400">{rentalLossNote(result.nonSavings)}</p>
        )}

        {selfEmploymentLossNote(result.nonSavings) && (
          <p className="-mt-2 text-xs text-slate-400">{selfEmploymentLossNote(result.nonSavings)}</p>
        )}

        {result.mortgageInterestRelief.interestPaid > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-sm">
            <span className="text-teal-700">
              Mortgage interest relief ({PERCENT.format(result.mortgageInterestRelief.reliefRate)}{" "}
              credit on {GBP.format(result.mortgageInterestRelief.reducerBase)}
              {result.mortgageInterestRelief.financeCostsBroughtForward > 0
                ? `, including ${GBP.format(result.mortgageInterestRelief.financeCostsBroughtForward)} brought forward`
                : ""}
              )
            </span>
            <span className="font-medium text-teal-800">
              −{GBP.format(result.mortgageInterestRelief.credit)}
            </span>
          </div>
        )}

        {result.mortgageInterestRelief.financeCostsCarriedForward > 0 && (
          <p className="-mt-2 text-xs text-slate-400">
            {GBP.format(result.mortgageInterestRelief.financeCostsCarriedForward)} unused finance
            costs to carry forward to next year.
          </p>
        )}

        {result.savings.gross > 0 && (
          <IncomeSection
            title="Savings interest"
            subtitle={
              result.savings.zeroRateAmount > 0
                ? `£${result.savings.zeroRateAmount.toLocaleString()} tax-free (starting rate + personal savings allowance)`
                : undefined
            }
            bands={result.savings.bands}
            tax={result.savings.tax}
          />
        )}

        {result.dividends.gross > 0 && (
          <IncomeSection
            title="Dividends"
            subtitle={
              result.dividends.zeroRateAmount > 0
                ? `£${result.dividends.zeroRateAmount.toLocaleString()} covered by dividend allowance`
                : undefined
            }
            bands={result.dividends.bands}
            tax={result.dividends.tax}
          />
        )}

        {result.dividends.foreignTaxWithheld > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-sm">
            <span className="text-teal-700">
              Foreign Tax Credit Relief (of {GBP.format(result.dividends.foreignTaxWithheld)}{" "}
              withheld abroad)
            </span>
            <span className="font-medium text-teal-800">
              −{GBP.format(result.dividends.foreignTaxCredit)}
            </span>
          </div>
        )}

        {result.capitalGainsTax.mainResidenceExemptAmount > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-sm">
            <span className="text-teal-700">
              Private Residence Relief — full exemption on your home sale
            </span>
            <span className="font-medium text-teal-800">
              £{result.capitalGainsTax.mainResidenceExemptAmount.toLocaleString()} tax-free
            </span>
          </div>
        )}

        {result.capitalGainsTax.mainResidenceGain > 0 && !result.capitalGainsTax.mainResidenceExempt && (
          <p className="-mt-2 text-xs text-amber-600">
            ⚠ The £{result.capitalGainsTax.mainResidenceGain.toLocaleString()} home-sale gain
            is taxed here as an ordinary gain since it wasn't marked as fully
            exempt — this is a conservative estimate, not partial relief.
          </p>
        )}

        {result.capitalGainsTax.gross > 0 && (
          <IncomeSection
            title="Capital gains"
            subtitle={capitalGainsSubtitle(result.capitalGainsTax)}
            bands={result.capitalGainsTax.bands}
            tax={result.capitalGainsTax.tax}
          />
        )}

        {result.capitalGainsTax.lossesCarriedForward > 0 && (
          <p className="-mt-2 text-xs text-slate-400">
            £{result.capitalGainsTax.lossesCarriedForward.toLocaleString()} unused capital
            loss to carry forward to next year.
          </p>
        )}

        {result.nationalInsurance.total > 0 && (
          <IncomeSection
            title="National Insurance (Class 1)"
            bands={result.nationalInsurance.bands}
            tax={result.nationalInsurance.total}
          />
        )}

        {result.nationalInsuranceClass4.total > 0 && (
          <IncomeSection
            title="National Insurance (Class 4, self-employment)"
            bands={result.nationalInsuranceClass4.bands}
            tax={result.nationalInsuranceClass4.total}
          />
        )}

        {result.class2.profit > 0 && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {result.class2.treatedAsPaid ? (
              <>
                Class 2 National Insurance: £0 — your profit is above the
                £{result.class2.smallProfitsThreshold.toLocaleString()} small
                profits threshold, so it's treated as paid for your State
                Pension record.
              </>
            ) : (
              <>
                Class 2 National Insurance: not due, but your profit is below
                the £{result.class2.smallProfitsThreshold.toLocaleString()}{" "}
                small profits threshold — you could pay{" "}
                {GBP.format(result.class2.voluntaryAnnualAmount)} voluntarily
                (£{result.class2.voluntaryWeeklyRate.toFixed(2)}/week) to
                protect your State Pension record.
              </>
            )}
          </div>
        )}

        {result.hicbc.childBenefitReceived > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">
              High Income Child Benefit Charge (
              {result.hicbc.percentageClawedBack.toFixed(0)}% of{" "}
              {GBP.format(result.hicbc.childBenefitReceived)} clawed back)
            </span>
            <span className="font-medium text-slate-800">
              {GBP.format(result.hicbc.charge)}
            </span>
          </div>
        )}

        {result.studentLoan.totalRepayment > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">
              Student loan repayment
              {result.studentLoan.plan !== "none" && result.studentLoan.hasPostgraduateLoan
                ? " (undergraduate + postgraduate)"
                : result.studentLoan.hasPostgraduateLoan
                ? " (postgraduate)"
                : ""}
            </span>
            <span className="font-medium text-slate-800">
              {GBP.format(result.studentLoan.totalRepayment)}
            </span>
          </div>
        )}

        {result.reliefAtSource.personalPensionContributionsNet > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
            <span className="text-emerald-700">
              {result.reliefAtSource.additionalPensionRelief > 0
                ? "Additional pension relief you can claim, beyond the 20% your provider already added"
                : "No further pension relief to claim — you're already a basic-rate taxpayer, so you've had the relief you're due"}
            </span>
            <span className="font-medium text-emerald-800">
              {GBP.format(result.reliefAtSource.additionalPensionRelief)}
            </span>
          </div>
        )}

        {result.marriageAllowance.requested && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {result.marriageAllowance.recipientAppearsEligible ? (
              <>
                Marriage Allowance: £{result.marriageAllowance.amountTransferred.toLocaleString()}{" "}
                added to your Personal Allowance.
              </>
            ) : (
              <span className="text-amber-600">
                ⚠ Marriage Allowance was applied, but your own income looks
                too high for you to actually qualify as the recipient —
                eligibility requires you to stay a basic-rate taxpayer.
                Double-check before relying on this figure.
              </span>
            )}
          </div>
        )}
      </div>

      <p className="mt-5 text-xs text-slate-400">
        Personal allowance applied: {GBP.format(result.personalAllowance)}
        {result.reliefAtSource.bandExtension > 0 && (
          <>
            {" "}· Basic/higher-rate bands widened by{" "}
            {GBP.format(result.reliefAtSource.bandExtension)} (
            {GBP.format(result.reliefAtSource.personalPensionContributionsGross)} grossed-up
            pension relief
            {result.reliefAtSource.giftAidDonationsGross > 0
              ? ` + ${GBP.format(result.reliefAtSource.giftAidDonationsGross)} grossed-up Gift Aid`
              : ""}
            )
          </>
        )}
      </p>
    </div>
  );
}

function rentalDeductionSubtitle(nonSavings: CalculationResult["nonSavings"]): string | undefined {
  if (nonSavings.rentalDeductionMethod === "expenses") {
    return `£${nonSavings.rentalDeductionApplied.toLocaleString()} itemized expenses deducted (beat the £1,000 allowance)`;
  }
  if (nonSavings.rentalDeductionMethod === "allowance") {
    return `£${nonSavings.rentalDeductionApplied.toLocaleString()} property allowance applied`;
  }
  return undefined;
}

function selfEmploymentDeductionSubtitle(
  nonSavings: CalculationResult["nonSavings"]
): string | undefined {
  if (nonSavings.selfEmploymentDeductionMethod === "expenses") {
    return `Self-employment: £${nonSavings.selfEmploymentDeductionApplied.toLocaleString()} itemized business expenses deducted (beat the £1,000 trading allowance)`;
  }
  if (nonSavings.selfEmploymentDeductionMethod === "allowance") {
    return `Self-employment: £${nonSavings.selfEmploymentDeductionApplied.toLocaleString()} trading allowance applied`;
  }
  return undefined;
}

function rentalLossNote(nonSavings: CalculationResult["nonSavings"]): string | undefined {
  const { rentalLossReliefApplied, rentalLossCarriedForward } = nonSavings;
  if (rentalLossReliefApplied <= 0 && rentalLossCarriedForward <= 0) return undefined;

  const parts: string[] = [];
  if (rentalLossReliefApplied > 0) {
    parts.push(`£${rentalLossReliefApplied.toLocaleString()} loss brought forward relieved against this year's rental profit`);
  }
  if (rentalLossCarriedForward > 0) {
    parts.push(`£${rentalLossCarriedForward.toLocaleString()} unused rental loss to carry forward to next year`);
  }
  return parts.join(" — ");
}

function selfEmploymentLossNote(nonSavings: CalculationResult["nonSavings"]): string | undefined {
  const { selfEmploymentLossReliefApplied, selfEmploymentLossCarriedForward } = nonSavings;
  if (selfEmploymentLossReliefApplied <= 0 && selfEmploymentLossCarriedForward <= 0) return undefined;

  const parts: string[] = [];
  if (selfEmploymentLossReliefApplied > 0) {
    parts.push(`£${selfEmploymentLossReliefApplied.toLocaleString()} loss brought forward relieved against this year's trading profit`);
  }
  if (selfEmploymentLossCarriedForward > 0) {
    parts.push(`£${selfEmploymentLossCarriedForward.toLocaleString()} unused self-employment loss to carry forward to next year`);
  }
  return parts.join(" — ");
}

function capitalGainsSubtitle(cgt: CalculationResult["capitalGainsTax"]): string {
  const parts: string[] = [];
  if (cgt.lossesThisYear > 0) {
    parts.push(`£${cgt.lossesThisYear.toLocaleString()} this year's losses deducted first`);
  }
  parts.push(`£${cgt.annualExemptAmount.toLocaleString()} annual exempt amount applied`);
  if (cgt.broughtForwardLossUsed > 0) {
    parts.push(`£${cgt.broughtForwardLossUsed.toLocaleString()} loss brought forward used`);
  }
  return parts.join(" — ");
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function IncomeSection({
  title,
  subtitle,
  bands,
  tax,
}: {
  title: string;
  subtitle?: string;
  bands: BandBreakdown[];
  tax: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <p className="text-sm font-semibold text-slate-800">{GBP.format(tax)}</p>
      </div>
      {subtitle && <p className="mb-2 text-xs text-slate-400">{subtitle}</p>}
      {bands.length > 0 && (
        <div className="space-y-1.5">
          {bands.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="text-slate-500">
                {PERCENT.format(b.rate)} on {GBP.format(b.taxable)}
              </span>
              <span className="font-medium text-slate-800">{GBP.format(b.tax)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
