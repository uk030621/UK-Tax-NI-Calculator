"use client";

import { useEffect, useState } from "react";

interface AllowedEmailEntry {
  _id: string;
  email: string;
  addedAt: string;
  addedBy: string;
  payment?: {
    amount: number; // minor units, e.g. pence
    currency: string;
    paidAt: string;
  };
}

function formatMoney(amountMinorUnits: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(
      amountMinorUnits / 100
    );
  } catch {
    return `${(amountMinorUnits / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function AdminAccessForm() {
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmailEntry[]>([]);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/admin/allowed-emails")
      .then((res) => res.json())
      .then((data: { allowedEmails?: AllowedEmailEntry[]; adminEmails?: string[] }) => {
        setAllowedEmails(data.allowedEmails ?? []);
        setAdminEmails(data.adminEmails ?? []);
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Could not load the allowlist. Refresh to try again.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;

    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not add that address");
      }
      setNewEmail("");
      setStatus("idle");
      load();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Could not add that address");
    }
  }

  async function handleDelete(entry: AllowedEmailEntry) {
    const message = entry.payment
      ? `Remove ${entry.email}? They paid ${formatMoney(entry.payment.amount, entry.payment.currency)} for access — removing them here does NOT refund them. Issue a refund separately in the Stripe dashboard if that's what you mean to do.`
      : `Remove ${entry.email} from the allowlist? They'll be signed out of access next time they visit.`;
    if (!window.confirm(message)) {
      return;
    }
    setDeletingId(entry._id);
    try {
      const res = await fetch(`/api/admin/allowed-emails/${entry._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove that address");
      setAllowedEmails((prev) => prev.filter((e) => e._id !== entry._id));
    } catch {
      setStatus("error");
      setErrorMsg("Could not remove that address. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Administrators</p>
        <p className="mt-1 text-xs text-slate-400">
          Set via <code>ADMIN_EMAILS</code> in the environment — not
          editable here, since changing who can administer the app
          shouldn&apos;t be a click away from this page. Edit the
          environment variable and redeploy to change this list. Every
          administrator is automatically allowed to use the app too,
          without needing to be added below.
        </p>
        <ul className="mt-4 space-y-1.5">
          {adminEmails.length === 0 && (
            <li className="text-sm text-slate-400">No ADMIN_EMAILS configured.</li>
          )}
          {adminEmails.map((email) => (
            <li
              key={email}
              className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-700"
            >
              {email}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Allowed users</p>
        <p className="mt-1 text-xs text-slate-400">
          Anyone signed in with one of these Google account emails can
          use the calculator. This list starts empty on a fresh
          deployment — until you add someone here, only administrators
          can use the app.
        </p>

        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="someone@example.com"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
          >
            {status === "saving" ? "Adding…" : "Add"}
          </button>
        </form>

        {status === "error" && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
        )}

        <div className="mt-4 space-y-2">
          {loading && <p className="text-sm text-slate-400">Loading…</p>}
          {!loading && allowedEmails.length === 0 && (
            <p className="text-sm text-slate-400">
              Nobody's been added yet — only administrators can use the
              app right now.
            </p>
          )}
          {allowedEmails.map((entry) => (
            <div
              key={entry._id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm"
            >
              <div>
                <p className="flex items-center gap-2 font-medium text-slate-800">
                  {entry.email}
                  {entry.payment && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Paid {formatMoney(entry.payment.amount, entry.payment.currency)}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {entry.payment
                    ? `Paid ${new Date(entry.payment.paidAt).toLocaleDateString("en-GB")}`
                    : `Added ${new Date(entry.addedAt).toLocaleDateString("en-GB")}${
                        entry.addedBy ? ` by ${entry.addedBy}` : ""
                      }`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(entry)}
                disabled={deletingId === entry._id}
                className="text-xs font-medium text-red-500 hover:text-red-600 disabled:text-slate-300"
              >
                {deletingId === entry._id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
