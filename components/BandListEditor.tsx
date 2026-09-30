"use client";

interface Band {
  threshold: number;
  rate: number;
}

export function BandListEditor({
  bands,
  onChange,
}: {
  bands: Band[];
  onChange: (bands: Band[]) => void;
}) {
  function updateBand(index: number, field: "threshold" | "rate", value: string) {
    const next = [...bands];
    const num = Number(value);
    next[index] = {
      ...next[index],
      [field]: field === "rate" ? num / 100 : num,
    };
    onChange(next);
  }

  function addBand() {
    onChange([...bands, { threshold: 0, rate: 0 }]);
  }

  function removeBand(index: number) {
    onChange(bands.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {bands.map((band, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              £
            </span>
            <input
              type="number"
              value={band.threshold}
              onChange={(e) => updateBand(i, "threshold", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-6 pr-2 text-sm outline-none focus:border-brand-500"
              placeholder="Threshold"
            />
          </div>
          <div className="relative w-28">
            <input
              type="number"
              step="0.01"
              value={(band.rate * 100).toFixed(2).replace(/\.?0+$/, "") || "0"}
              onChange={(e) => updateBand(i, "rate", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-2 pr-6 text-sm outline-none focus:border-brand-500"
              placeholder="Rate"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              %
            </span>
          </div>
          <button
            type="button"
            onClick={() => removeBand(i)}
            className="rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Remove band"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addBand}
        className="text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        + Add band
      </button>
    </div>
  );
}
