"use client";

import { useEffect, useState } from "react";

interface SettingsData {
  businessName: string;
  address: string;
  contactEmail: string;
  icoReference: string;
  dataRegionNote: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

const EMPTY: SettingsData = {
  businessName: "",
  address: "",
  contactEmail: "",
  icoReference: "",
  dataRegionNote: "",
  updatedAt: null,
  updatedBy: null,
};

export function AdminSiteSettingsForm() {
  const [data, setData] = useState<SettingsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((d: SettingsData) => setData(d))
      .catch((err) => {
        setStatus("error");
        setErrorMsg(
          err instanceof Error
            ? `Could not load current settings: ${err.message}`
            : "Could not load current settings. Refresh to try again."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: data.businessName,
          address: data.address,
          contactEmail: data.contactEmail,
          icoReference: data.icoReference,
          dataRegionNote: data.dataRegionNote,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save");
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Could not save");
    }
  }

  const missing = [
    !data.businessName && "business name",
    !data.address && "address",
    !data.contactEmail && "contact email",
    !data.icoReference && "ICO reference",
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">Terms &amp; Privacy details</p>
      <p className="mt-1 text-xs text-slate-400">
        Fills in the business details shown on{" "}
        <a href="/terms" className="font-medium text-brand-600 hover:text-brand-700">
          /terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="font-medium text-brand-600 hover:text-brand-700">
          /privacy
        </a>
        . Changes are live immediately on both pages — no redeploy needed.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {!loading && missing.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Still missing: {missing.join(", ")}. These show as a plain
              placeholder on the public pages until set.
            </p>
          )}

          <Field label="Business or trading name">
            <input
              type="text"
              value={data.businessName}
              onChange={(e) => update("businessName", e.target.value)}
              placeholder="e.g. Jane Smith, trading as UK Tax & NI Calculator"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <Field label="Address (or registered office, if incorporated)">
            <textarea
              value={data.address}
              onChange={(e) => update("address", e.target.value)}
              rows={2}
              placeholder="Shown on your Terms and Privacy pages"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <Field label="Contact email for privacy / legal enquiries">
            <input
              type="email"
              value={data.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              placeholder="e.g. support@yourdomain.com"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <Field label="ICO registration reference">
            <input
              type="text"
              value={data.icoReference}
              onChange={(e) => update("icoReference", e.target.value)}
              placeholder="Once registered at ico.org.uk"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <Field label="Where data is processed (Privacy Policy wording)">
            <textarea
              value={data.dataRegionNote}
              onChange={(e) => update("dataRegionNote", e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Pre-filled with a generic-but-accurate line. Worth tightening
              once you&rsquo;ve confirmed exactly which region your
              database and hosting are actually configured to use.
            </p>
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={status === "saving"}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            {status === "saved" && (
              <span className="text-sm font-medium text-emerald-600">Saved ✓</span>
            )}
          </div>

          {status === "error" && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
          )}

          {data.updatedAt && (
            <p className="text-xs text-slate-400">
              Last updated {new Date(data.updatedAt).toLocaleDateString("en-GB")}
              {data.updatedBy ? ` by ${data.updatedBy}` : ""}.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
