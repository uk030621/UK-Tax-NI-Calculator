"use client";

import { useEffect, useId, useState } from "react";
import { useSession } from "next-auth/react";
import { Spinner } from "@/components/Spinner";
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

const RENT_A_ROOM_EXPENSE_CATEGORIES = [
  "Share of utility bills (gas, electricity, water, broadband)",
  "Cleaning / laundry",
  "Wear and tear / furnishings",
  "Advertising for a lodger",
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
  rentARoomReceipts: string;
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
  rentARoomReceipts: "",
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

const emptyRentARoomExpenses: Record<string, string> = Object.fromEntries(
  RENT_A_ROOM_EXPENSE_CATEGORIES.map((c) => [c, ""])
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
    rentalLossCarriedForward?: number;
    rentARoomGross?: number;
    rentARoomShared?: boolean;
    selfEmploymentGross?: number;
    selfEmploymentLossBroughtForward?: number;
    selfEmploymentLossCarriedForward?: number;
  };
  mortgageInterestRelief?: {
    interestPaid?: number;
    financeCostsBroughtForward?: number;
    financeCostsCarriedForward?: number;
  };
  savings?: { gross?: number };
  dividends?: { gross?: number; foreignTaxWithheld?: number };
  capitalGainsTax?: {
    gross?: number;
    otherCapitalGains?: number;
    mainResidenceGain?: number;
    mainResidenceExempt?: boolean;
    lossesThisYear?: number;
    broughtForwardLossAvailable?: number;
    lossesCarriedForward?: number;
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
  marriageAllowance?: { requested?: boolean; giving?: boolean };
  netIncome?: number;
  taxYear?: string;
  region?: Region;
}

/** "2026-27" -> "2025-26". Returns null if the label isn't in that format. */
function previousTaxYear(label: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) return null;
  const start = Number(match[1]) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

interface CarryForwardFigures {
  rentalLoss: number;
  financeCosts: number;
  selfEmploymentLoss: number;
  capitalLosses: number;
}

/** The "carry forward to next year" figures a saved calculation recorded. */
function carryForwardFigures(entry: HistoryEntry): CarryForwardFigures {
  return {
    rentalLoss: entry.nonSavings?.rentalLossCarriedForward ?? 0,
    financeCosts: entry.mortgageInterestRelief?.financeCostsCarriedForward ?? 0,
    selfEmploymentLoss: entry.nonSavings?.selfEmploymentLossCarriedForward ?? 0,
    capitalLosses: entry.capitalGainsTax?.lossesCarriedForward ?? 0,
  };
}

function hasCarryForward(figures: CarryForwardFigures): boolean {
  return Object.values(figures).some((v) => v > 0);
}

function savedDateLabel(entry: HistoryEntry): string {
  const when = entry.updatedAt ?? entry.createdAt;
  return when ? new Date(when).toLocaleDateString("en-GB") : "an earlier date";
}

export function TaxCalculatorForm() {
  const { data: session } = useSession();

  const [years, setYears] = useState<string[]>([]);
  const [taxYear, setTaxYear] = useState<string>("");
  const [region, setRegion] = useState<Region>("uk");
  const [income, setIncome] = useState<IncomeFields>(emptyIncome);
  // Whether the pension contribution field below holds the amount the
  // user actually paid ("net") or the total already including the 20%
  // their provider added ("gross") — see MoneyField's conversion at
  // submission time. Always reset to "net" alongside the income state
  // itself (loadEntryIntoForm, startNewCalculation) — a saved
  // calculation's stored figure is always net, so defaulting back to
  // "net" is the only interpretation that's never silently wrong.
  const [pensionEntryMode, setPensionEntryMode] = useState<"net" | "gross">("net");
  const [showOtherIncome, setShowOtherIncome] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [rentalExpenses, setRentalExpenses] = useState<Record<string, string>>(emptyExpenses);
  const [showRentARoomExpenses, setShowRentARoomExpenses] = useState(false);
  const [rentARoomExpenses, setRentARoomExpenses] = useState<Record<string, string>>(
    emptyRentARoomExpenses
  );
  const [rentARoomShared, setRentARoomShared] = useState(false);
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
  const [givingMarriageAllowance, setGivingMarriageAllowance] = useState(false);
  // Carry-forward offer: which saved calculation the user picked, whether
  // they've applied it (we then show where the figures came from, with an
  // Undo), and whether they've dismissed the offer for this tax year.
  const [carryForwardSourceId, setCarryForwardSourceId] = useState<string | null>(null);
  const [carryForwardAppliedFrom, setCarryForwardAppliedFrom] = useState<string | null>(null);
  const [carryForwardDismissed, setCarryForwardDismissed] = useState(false);

  // Saved calculations for the tax year immediately before the one being
  // calculated that recorded something to carry forward, newest first.
  const previousYearLabel = previousTaxYear(taxYear);
  const carryForwardCandidates = previousYearLabel
    ? historyList
        .filter((e) => e.taxYear === previousYearLabel && hasCarryForward(carryForwardFigures(e)))
        .sort((a, b) =>
          (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? "")
        )
    : [];
  const carryForwardSource =
    carryForwardCandidates.find((e) => e._id === carryForwardSourceId) ??
    carryForwardCandidates[0] ??
    null;

  // A new tax year means a new offer: forget any earlier choice or dismissal.
  // If figures had been filled in from last year's calculation, clear them
  // too, so they can't stay behind under a different tax year unnoticed.
  useEffect(() => {
    if (carryForwardAppliedFrom) {
      setIncome((prev) => ({
        ...prev,
        rentalLossBroughtForward: "",
        financeCostsBroughtForward: "",
        selfEmploymentLossBroughtForward: "",
        capitalLossesBroughtForward: "",
      }));
    }
    setCarryForwardSourceId(null);
    setCarryForwardAppliedFrom(null);
    setCarryForwardDismissed(false);
  }, [taxYear]);

  function applyCarryForward() {
    if (!carryForwardSource) return;
    const f = carryForwardFigures(carryForwardSource);
    const asField = (n: number) => (n > 0 ? String(n) : "");
    setIncome((prev) => ({
      ...prev,
      rentalLossBroughtForward: asField(f.rentalLoss),
      financeCostsBroughtForward: asField(f.financeCosts),
      selfEmploymentLossBroughtForward: asField(f.selfEmploymentLoss),
      capitalLossesBroughtForward: asField(f.capitalLosses),
    }));
    setShowOtherIncome(true);
    setCarryForwardAppliedFrom(savedDateLabel(carryForwardSource));
    setResult(null);
    setSaved(false);
  }

  function undoCarryForward() {
    setIncome((prev) => ({
      ...prev,
      rentalLossBroughtForward: "",
      financeCostsBroughtForward: "",
      selfEmploymentLossBroughtForward: "",
      capitalLossesBroughtForward: "",
    }));
    setCarryForwardAppliedFrom(null);
    setResult(null);
    setSaved(false);
  }

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
      rentARoomReceipts: entry.nonSavings?.rentARoomGross ? String(entry.nonSavings.rentARoomGross) : "",
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
    setPensionEntryMode("net"); // stored figures are always net — see declaration above
    setRentARoomShared(Boolean(entry.nonSavings?.rentARoomShared));
    setMainResidenceFullyExempt(Boolean(entry.capitalGainsTax?.mainResidenceExempt));
    setStudentLoanPlan(entry.studentLoan?.plan ?? "none");
    setHasPostgraduateLoan(Boolean(entry.studentLoan?.hasPostgraduateLoan));
    setReceivingMarriageAllowance(Boolean(entry.marriageAllowance?.requested));
    setGivingMarriageAllowance(Boolean(entry.marriageAllowance?.giving));
    setCarryForwardAppliedFrom(null); // the saved entry's own figures replace any filled in from last year
    if (entry.taxYear) setTaxYear(entry.taxYear);
    if (entry.region) setRegion(entry.region);
    if (
      entry.nonSavings?.pensionGross ||
      entry.nonSavings?.rentalGross ||
      entry.nonSavings?.rentARoomGross ||
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
    // Itemised expense category breakdowns aren't stored, only totals —
    // same limitation the mount-prefill already had, not new to editing.
    setRentalExpenses(emptyExpenses);
    setRentARoomExpenses(emptyRentARoomExpenses);
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
    setPensionEntryMode("net");
    setRentalExpenses(emptyExpenses);
    setRentARoomExpenses(emptyRentARoomExpenses);
    setRentARoomShared(false);
    setBusinessExpenses(emptyBusinessExpenses);
    setMainResidenceFullyExempt(false);
    setStudentLoanPlan("none");
    setHasPostgraduateLoan(false);
    setReceivingMarriageAllowance(false);
    setGivingMarriageAllowance(false);
    setCarryForwardAppliedFrom(null);
    setShowOtherIncome(false);
    setShowExpenses(false);
    setShowRentARoomExpenses(false);
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
    Object.values(rentARoomExpenses).some((v) => v !== "") ||
    rentARoomShared ||
    Object.values(businessExpenses).some((v) => v !== "") ||
    mainResidenceFullyExempt ||
    studentLoanPlan !== "none" ||
    hasPostgraduateLoan ||
    receivingMarriageAllowance ||
    givingMarriageAllowance;

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

  function updateRentARoomExpense(category: string, value: string) {
    setRentARoomExpenses((prev) => ({ ...prev, [category]: value }));
  }

  function updateBusinessExpense(category: string, value: string) {
    setBusinessExpenses((prev) => ({ ...prev, [category]: value }));
  }

  const rentalExpensesTotal = Object.values(rentalExpenses).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0
  );

  const rentARoomExpensesTotal = Object.values(rentARoomExpenses).reduce(
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
      rentARoomReceipts: Number(income.rentARoomReceipts) || 0,
      rentARoomExpenses: Object.entries(rentARoomExpenses)
        .filter(([, v]) => Number(v) > 0)
        .map(([category, v]) => ({ category, amount: Number(v) })),
      rentARoomShared,
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
      personalPensionContributions:
        pensionEntryMode === "gross"
          ? (Number(income.personalPensionContributions) || 0) * 0.8
          : Number(income.personalPensionContributions) || 0,
      giftAidDonations: Number(income.giftAidDonations) || 0,
      mainResidenceGain: Number(income.mainResidenceGain) || 0,
      mainResidenceFullyExempt,
      childBenefitReceived: Number(income.childBenefitReceived) || 0,
      studentLoanPlan,
      hasPostgraduateLoan,
      receivingMarriageAllowance,
      givingMarriageAllowance,
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

          {!editingId && carryForwardSource && !carryForwardDismissed && !carryForwardAppliedFrom && (
            <div className="rounded-lg bg-brand-50 px-3 py-3 text-xs text-brand-700">
              <p className="font-medium">
                Bring forward losses and unused relief from {previousYearLabel}?
              </p>
              {carryForwardCandidates.length > 1 && (
                <select
                  value={carryForwardSource._id ?? ""}
                  onChange={(e) => setCarryForwardSourceId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-brand-100 bg-white py-2 px-3 text-base text-slate-900 outline-none focus:border-brand-500"
                  aria-label="Which saved calculation to bring figures forward from"
                >
                  {carryForwardCandidates.map((e) => (
                    <option key={e._id} value={e._id}>
                      Saved {savedDateLabel(e)}
                      {typeof e.netIncome === "number" ? ` · net income ${GBP.format(e.netIncome)}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1.5">
                Your {previousYearLabel} calculation saved on {savedDateLabel(carryForwardSource)} carried forward:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {(() => {
                  const f = carryForwardFigures(carryForwardSource);
                  return (
                    <>
                      {f.rentalLoss > 0 && <li>Rental loss: {GBP.format(f.rentalLoss)}</li>}
                      {f.financeCosts > 0 && <li>Unused mortgage interest relief: {GBP.format(f.financeCosts)}</li>}
                      {f.selfEmploymentLoss > 0 && <li>Self-employment loss: {GBP.format(f.selfEmploymentLoss)}</li>}
                      {f.capitalLosses > 0 && <li>Capital losses: {GBP.format(f.capitalLosses)}</li>}
                    </>
                  );
                })()}
              </ul>
              <p className="mt-1.5 text-brand-700/80">
                Check these against your Self Assessment return before using them. Losses only carry
                forward if you have reported them to HMRC (HM Revenue &amp; Customs).
              </p>
              <div className="mt-2.5 flex gap-4">
                <button
                  type="button"
                  onClick={applyCarryForward}
                  className="font-medium underline hover:no-underline"
                >
                  Use these figures
                </button>
                <button
                  type="button"
                  onClick={() => setCarryForwardDismissed(true)}
                  className="font-medium underline hover:no-underline"
                >
                  No thanks
                </button>
              </div>
            </div>
          )}

          {!editingId && carryForwardAppliedFrom && (
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              <span>
                Brought-forward figures filled in from your {previousYearLabel} calculation saved on{" "}
                {carryForwardAppliedFrom}. You can change them below.
              </span>
              <button
                type="button"
                onClick={undoCarryForward}
                className="ml-3 shrink-0 font-medium underline hover:no-underline"
              >
                Undo
              </button>
            </div>
          )}

          <CategoryCard tone="setup" icon="📅" title="Tax year and region">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tax year
              </label>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-base font-medium text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
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
          </CategoryCard>

          <CategoryCard tone="income" icon="💼" title="Employment" badge={money(income.employmentIncome)}>
          <MoneyField
            label="Employment income (salary)"
            value={income.employmentIncome}
            onChange={(v) => updateField("employmentIncome", v)}
            placeholder="e.g. 45,000"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Use your taxable pay — the &quot;pay&quot; figure on your P60, which is already
            after any pension contributions (including AVCs) taken from your payslip before tax.
            Paying into a personal pension or SIPP yourself? That goes under
            Reliefs, in the &quot;Add…&quot; section below.
          </p>
          </CategoryCard>


          <div className="space-y-4">
            <CategoryCard tone="adjust" icon="🎓" title="Student loan" collapsible hasData={studentLoanPlan !== "none" || hasPostgraduateLoan}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Student loan plan
                </label>
                <select
                  value={studentLoanPlan}
                  onChange={(e) => setStudentLoanPlan(e.target.value as typeof studentLoanPlan)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-base font-medium text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
            </CategoryCard>

            <CategoryCard tone="adjust" icon="🤝" title="Marriage Allowance" collapsible hasData={receivingMarriageAllowance || givingMarriageAllowance}>
              <label className="flex items-start gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={receivingMarriageAllowance}
                  onChange={(e) => {
                    setReceivingMarriageAllowance(e.target.checked);
                    if (e.target.checked) setGivingMarriageAllowance(false);
                  }}
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

              <label className="mt-4 flex items-start gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={givingMarriageAllowance}
                  onChange={(e) => {
                    setGivingMarriageAllowance(e.target.checked);
                    if (e.target.checked) setReceivingMarriageAllowance(false);
                  }}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  I am giving part of my Marriage Allowance to my spouse or
                  civil partner
                </span>
              </label>
              <p className="mt-1.5 text-xs text-slate-400">
                Only tick this if your own income is{" "}
                <strong className="text-slate-500">below your Personal Allowance</strong>{" "}
                (£12,570). You give up £1,260 of your allowance so your
                partner can reduce their tax by up to £252. If your income is
                above £11,310, giving it away can mean you pay a little tax
                yourself — the results include that. Your partner&apos;s
                saving shows on their own calculation, with the box above
                ticked. You can tick one box or the other, not both.
              </p>
            </CategoryCard>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowOtherIncome((v) => !v)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {showOtherIncome ? "− Hide other income, reliefs & Child Benefit" : "+ Add pension, self-employment, rental, rent-a-room, savings, dividends, gains, reliefs or Child Benefit"}
            </button>
          </div>

          {showOtherIncome && (
            <div className="space-y-4">
              <CategoryCard tone="income" icon="🌅" title="Pension" collapsible hasData={filled(income.pensionIncome)} badge={money(income.pensionIncome)}>
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
              </CategoryCard>

              <CategoryCard tone="income" icon="🏠" title="Rental" collapsible hasData={filled(income.rentalIncome, income.mortgageInterest, income.rentalLossBroughtForward, income.financeCostsBroughtForward) || anyFilled(rentalExpenses)} badge={money(income.rentalIncome)}>
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
                    ? "− Hide itemised expenses"
                    : "+ Itemise allowable expenses (instead of the £1,000 allowance)"}
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
                            className="w-full rounded-lg border border-slate-200 py-1.5 pl-5 pr-2 text-base outline-none focus:border-brand-500"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="text-slate-500">Total itemised expenses</span>
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
              </CategoryCard>

              <CategoryCard tone="income" icon="🛏️" title="Rent-a-Room" collapsible hasData={filled(income.rentARoomReceipts) || rentARoomShared || anyFilled(rentARoomExpenses)} badge={money(income.rentARoomReceipts)}>
                <MoneyField
                  label="Rent-a-Room receipts (letting a furnished room in your own home)"
                  value={income.rentARoomReceipts}
                  onChange={(v) => updateField("rentARoomReceipts", v)}
                  placeholder="e.g. 6,000"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  A separate relief from Rental above — this is for a lodger
                  in the home you actually live in, not a separate let
                  property. Include everything the lodger pays: rent, plus
                  any share of bills, meals, cleaning or laundry rolled into
                  the figure. Up to £7,500 a year (2025/26 and 2026/27) is
                  tax-free automatically — nothing else to enter unless
                  you're over that.
                </p>

                <label className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={rentARoomShared}
                    onChange={(e) => setRentARoomShared(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>
                    I share this income with someone else (a partner or
                    joint owner), so the threshold halves to £3,750 each.
                    Enter only your own share of the receipts above.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowRentARoomExpenses((v) => !v)}
                  className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {showRentARoomExpenses
                    ? "− Hide itemised expenses"
                    : "+ Itemise actual expenses (only matters if you're over the threshold)"}
                </button>

                {showRentARoomExpenses && (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    {RENT_A_ROOM_EXPENSE_CATEGORIES.map((category) => (
                      <div key={category} className="flex items-center gap-2">
                        <label className="flex-1 text-xs text-slate-600">{category}</label>
                        <div className="relative w-28">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            £
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={rentARoomExpenses[category]}
                            onChange={(e) => updateRentARoomExpense(category, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 py-1.5 pl-5 pr-2 text-base outline-none focus:border-brand-500"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="text-slate-500">Total itemised expenses</span>
                      <span className="font-semibold text-slate-800">
                        {GBP.format(rentARoomExpensesTotal)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Only matters once your receipts go over the threshold
                      — below it, you're exempt regardless of expenses.
                      Above it, the calculator automatically uses whichever
                      is worth more: this total, or the threshold itself.
                      HMRC uses your actual expenses by default, so there is
                      nothing to tell them. To use the threshold instead, you
                      tell HMRC within a year of the 31 January Self
                      Assessment deadline for that tax year.
                    </p>
                  </div>
                )}

                <p className="mt-3 text-xs text-slate-400">
                  Not modelled: a loss from this source (HMRC requires
                  electing out of the scheme entirely to claim one — speak
                  to an accountant if your expenses genuinely exceed your
                  receipts), and mortgage interest relief on this income.
                </p>
              </CategoryCard>

              <CategoryCard tone="income" icon="🛠️" title="Self-employment" collapsible hasData={filled(income.selfEmploymentProfit, income.selfEmploymentLossBroughtForward) || anyFilled(businessExpenses)} badge={money(income.selfEmploymentProfit)}>
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
                    ? "− Hide itemised business expenses"
                    : "+ Itemise business expenses (instead of the £1,000 trading allowance)"}
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
                            className="w-full rounded-lg border border-slate-200 py-1.5 pl-5 pr-2 text-base outline-none focus:border-brand-500"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="text-slate-500">Total itemised business expenses</span>
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
              </CategoryCard>

              <CategoryCard tone="invest" icon="🐖" title="Savings interest" collapsible hasData={filled(income.savingsInterest)} badge={money(income.savingsInterest)}>
                <MoneyField
                  label="Savings interest"
                  value={income.savingsInterest}
                  onChange={(v) => updateField("savingsInterest", v)}
                  placeholder="e.g. 800"
                />
              </CategoryCard>
              <CategoryCard tone="invest" icon="📈" title="Dividends" collapsible hasData={filled(income.dividendIncome, income.foreignTaxWithheldOnDividends)} badge={money(income.dividendIncome)}>
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
              </CategoryCard>
              <CategoryCard tone="invest" icon="🏷️" title="Capital gains" collapsible hasData={filled(income.capitalGains, income.mainResidenceGain, income.capitalLossesThisYear, income.capitalLossesBroughtForward) || mainResidenceFullyExempt} badge={money(income.capitalGains)}>

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
              </CategoryCard>

              <CategoryCard tone="adjust" icon="🧾" title="Reliefs" collapsible hasData={filled(income.personalPensionContributions, income.giftAidDonations)}>

                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Personal pension contributions (relief at source)
                </label>
                <div className="mb-2 flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(["net", "gross"] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setPensionEntryMode(mode)}
                      className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
                        pensionEntryMode === mode
                          ? "bg-white text-brand-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {mode === "net" ? "I know what I paid" : "I know the total, incl. relief"}
                    </button>
                  ))}
                </div>
                <MoneyField
                  value={income.personalPensionContributions}
                  onChange={(v) => updateField("personalPensionContributions", v)}
                  placeholder={pensionEntryMode === "gross" ? "e.g. 5,000" : "e.g. 4,000"}
                />
                {pensionEntryMode === "gross" && (
                  <p className="mt-1.5 text-xs text-brand-600">
                    Enter the full amount sitting in the pot — the figure
                    your pension statement shows as the total contribution.
                    We&rsquo;ll work out the relief from there; no need to
                    subtract the 20% yourself.
                  </p>
                )}
                <p className="mt-1.5 text-xs text-slate-400">
                  Only for "relief at source" pensions — most personal
                  pensions/SIPPs, some workplace schemes, and some AVCs
                  (Additional Voluntary Contributions) paid to a separate
                  provider.
                  {pensionEntryMode === "net" && (
                    <>
                      {" "}Enter the amount you actually paid; basic-rate
                      relief is added automatically and doesn't need
                      entering here.
                    </>
                  )}
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
              </CategoryCard>

              <CategoryCard tone="adjust" icon="👶" title="Child Benefit" collapsible hasData={filled(income.childBenefitReceived)} badge={money(income.childBenefitReceived)}>
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
              </CategoryCard>
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
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-70"
            >
              {loading && <Spinner />}
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

/** "£1,500" when the text holds a positive number, otherwise nothing — used for the card badges. */
function money(value: string): string | undefined {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? GBP.format(n) : undefined;
}

/** True when the text holds a non-zero number. */
function filled(...values: (string | undefined)[]): boolean {
  return values.some((v) => Boolean(v && v.trim() !== "" && Number(v) !== 0));
}

/** True when any value in a record of text fields is filled in. */
function anyFilled(record: Record<string, string>): boolean {
  return filled(...Object.values(record));
}

type CardTone = "income" | "invest" | "adjust" | "setup";

// Written out in full (not built from strings) so Tailwind can see every class.
const CARD_TONES: Record<
  CardTone,
  { border: string; head: string; title: string; group: string; icon: string; badge: string; groupLabel: string }
> = {
  income: {
    border: "border-blue-200",
    head: "bg-blue-50",
    title: "text-blue-900",
    group: "text-blue-700",
    icon: "bg-blue-100",
    badge: "text-blue-800 ring-blue-200",
    groupLabel: "Income · taxed at your normal rates",
  },
  invest: {
    border: "border-violet-200",
    head: "bg-violet-50",
    title: "text-violet-900",
    group: "text-violet-700",
    icon: "bg-violet-100",
    badge: "text-violet-800 ring-violet-200",
    groupLabel: "Savings & investments · taxed separately",
  },
  adjust: {
    border: "border-teal-200",
    head: "bg-teal-50",
    title: "text-teal-900",
    group: "text-teal-700",
    icon: "bg-teal-100",
    badge: "text-teal-800 ring-teal-200",
    groupLabel: "Reliefs & adjustments",
  },
  setup: {
    border: "border-slate-200",
    head: "bg-slate-50",
    title: "text-slate-900",
    group: "text-slate-600",
    icon: "bg-slate-200",
    badge: "text-slate-800 ring-slate-200",
    groupLabel: "Set-up",
  },
};

/**
 * One tax category on the form: a tinted header with a large bold title, an
 * icon and a group label, plus a badge showing what has been entered so far.
 * The colour tells you which kind of figure this is at a glance.
 */
function CategoryCard({
  tone,
  icon,
  title,
  badge,
  collapsible = false,
  hasData = false,
  children,
}: {
  tone: CardTone;
  icon: string;
  title: string;
  badge?: string;
  /** Collapsible cards start closed unless something has been entered in them. */
  collapsible?: boolean;
  hasData?: boolean;
  children: React.ReactNode;
}) {
  const t = CARD_TONES[tone];
  const bodyId = useId();
  // null = the person hasn't touched it, so follow the data. Once a card has
  // data (typed, loaded from a saved calculation, or carried forward) it stays
  // open, so it can never close while the person is mid-edit.
  const [manual, setManual] = useState<boolean | null>(null);
  useEffect(() => {
    if (hasData && manual === null) setManual(true);
  }, [hasData, manual]);
  const open = !collapsible || (manual ?? hasData);

  const heading = (
    <>
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${t.icon}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className={`text-lg font-bold leading-tight ${t.title}`}>{title}</h3>
        <p className={`text-xs font-medium ${t.group}`}>{t.groupLabel}</p>
      </div>
      {badge ? (
        <span className={`shrink-0 rounded-full bg-white px-2.5 py-1 text-sm font-semibold ring-1 ${t.badge}`}>
          {badge}
        </span>
      ) : (
        collapsible &&
        !open && <span className={`shrink-0 text-xs font-semibold ${t.group}`}>Tap to add</span>
      )}
      {collapsible && (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-5 w-5 shrink-0 transition-transform ${t.group} ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      )}
    </>
  );

  return (
    <section className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${t.border}`}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setManual(!open)}
          aria-expanded={open}
          aria-controls={bodyId}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left ${t.head}`}
        >
          {heading}
        </button>
      ) : (
        <header className={`flex items-center gap-3 px-4 py-3 ${t.head}`}>{heading}</header>
      )}
      {/* Kept mounted when closed, only hidden, so nothing typed is ever lost. */}
      <div id={bodyId} className={`p-4 ${open ? "" : "hidden"}`}>
        {children}
      </div>
    </section>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
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
            title="Employment, pension, rental, rent-a-room & self-employment"
            subtitle={rentalDeductionSubtitle(result.nonSavings)}
            bands={result.nonSavings.bands}
            tax={result.nonSavings.tax}
          />
        )}

        {result.nonSavings.rentARoomGross > 0 && (
          <p className="-mt-2 text-xs text-slate-400">
            {rentARoomSubtitle(result.nonSavings)}
          </p>
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
            tone="violet"
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
            tone="rose"
            bands={result.nationalInsurance.bands}
            tax={result.nationalInsurance.total}
          />
        )}

        {result.nationalInsuranceClass4.total > 0 && (
          <IncomeSection
            title="National Insurance (Class 4, self-employment)"
            tone="rose"
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

        {result.marriageAllowance.giving && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {result.marriageAllowance.giverAppearsEligible ? (
              <>
                Marriage Allowance: you have given{" "}
                {GBP.format(result.marriageAllowance.amountGiven)} of your Personal Allowance to your
                partner.
                {result.marriageAllowance.giverIncomeAboveReducedAllowance > 0 && (
                  <>
                    {" "}
                    {GBP.format(result.marriageAllowance.giverIncomeAboveReducedAllowance)} of your income
                    now sits above your reduced allowance, so you may pay some tax because of this.
                  </>
                )}{" "}
                Your partner&apos;s saving, up to £252, shows on their own calculation.
              </>
            ) : (
              <span className="text-amber-600">
                ⚠ Marriage Allowance was applied, but your income is not below your Personal Allowance
                (GOV.UK says it must be below), so you may not qualify to give any away. Double-check
                before relying on this figure.
              </span>
            )}
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
    return `£${nonSavings.rentalDeductionApplied.toLocaleString()} itemised expenses deducted (beat the £1,000 allowance)`;
  }
  if (nonSavings.rentalDeductionMethod === "allowance") {
    return `£${nonSavings.rentalDeductionApplied.toLocaleString()} property allowance applied`;
  }
  return undefined;
}

function rentARoomSubtitle(nonSavings: CalculationResult["nonSavings"]): string {
  const threshold = nonSavings.rentARoomShared
    ? `£${nonSavings.rentARoomThresholdApplied.toLocaleString()} (your half of the shared £7,500 limit)`
    : `£${nonSavings.rentARoomThresholdApplied.toLocaleString()}`;
  if (nonSavings.rentARoomDeductionMethod === "exempt") {
    return `Rent-a-Room: fully tax-free — £${nonSavings.rentARoomGross.toLocaleString()} is within the ${threshold} threshold, nothing to report to HMRC`;
  }
  if (nonSavings.rentARoomDeductionMethod === "expenses") {
    return `Rent-a-Room: £${nonSavings.rentARoomDeductionApplied.toLocaleString()} itemised expenses deducted (beat the ${threshold} threshold) — HMRC uses your actual expenses by default, so there is nothing to tell them unless you previously chose the threshold method`;
  }
  const taxable = `£${nonSavings.rentARoomTaxableAmount.toLocaleString()} of the £${nonSavings.rentARoomGross.toLocaleString()} receipts is taxable`;
  return nonSavings.rentARoomExpensesTotal > 0
    ? `Rent-a-Room: the ${threshold} limit was deducted because it beat your itemised expenses — ${taxable}. To use the limit method, tell HMRC within a year of the 31 January Self Assessment deadline for that tax year`
    : `Rent-a-Room: the ${threshold} limit was deducted — ${taxable}. To use the limit method, tell HMRC within a year of the 31 January Self Assessment deadline for that tax year`;
}

function selfEmploymentDeductionSubtitle(
  nonSavings: CalculationResult["nonSavings"]
): string | undefined {
  if (nonSavings.selfEmploymentDeductionMethod === "expenses") {
    return `Self-employment: £${nonSavings.selfEmploymentDeductionApplied.toLocaleString()} itemised business expenses deducted (beat the £1,000 trading allowance)`;
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

type ResultTone = "amber" | "rose" | "violet";

// Matches the colours of the key above the results bar: income tax (amber),
// National Insurance (rose) and Capital Gains Tax (violet).
const RESULT_TONES: Record<ResultTone, { bar: string; bg: string; title: string; amount: string }> = {
  amber: { bar: "border-amber-400", bg: "bg-amber-50/60", title: "text-amber-900", amount: "text-amber-900" },
  rose: { bar: "border-rose-400", bg: "bg-rose-50/60", title: "text-rose-900", amount: "text-rose-900" },
  violet: { bar: "border-violet-400", bg: "bg-violet-50/60", title: "text-violet-900", amount: "text-violet-900" },
};

function IncomeSection({
  title,
  subtitle,
  bands,
  tax,
  tone = "amber",
}: {
  title: string;
  subtitle?: string;
  bands: BandBreakdown[];
  tax: number;
  tone?: ResultTone;
}) {
  const t = RESULT_TONES[tone];
  return (
    <div className={`rounded-xl border-l-4 p-4 ${t.bar} ${t.bg}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className={`text-base font-bold leading-snug ${t.title}`}>{title}</p>
        <p className={`shrink-0 text-lg font-bold ${t.amount}`}>{GBP.format(tax)}</p>
      </div>
      {subtitle && <p className="mb-2 text-xs text-slate-500">{subtitle}</p>}
      {bands.length > 0 && (
        <div className="space-y-1.5">
          {bands.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
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
