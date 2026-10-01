export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-slate-700 pt-1">{children}</p>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-slate-600">{children}</p>;
}

export function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Renders a site-settings-backed value inline within a sentence — the
 * real value once an admin has set it at /admin/access, or a plain
 * bracketed placeholder until then. Admins see the same placeholder
 * amber-highlighted, as a visible prompt to go fill it in; a regular
 * visitor just sees a neutral, honest "not yet set" marker rather than
 * an alarming warning that isn't meant for them.
 */
export function Field({
  value,
  label,
  isAdmin,
}: {
  value: string;
  label: string;
  isAdmin: boolean;
}) {
  if (value) return <>{value}</>;
  if (isAdmin) {
    return (
      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
        [{label} — set this at /admin/access]
      </span>
    );
  }
  return <span className="text-slate-400">[{label}]</span>;
}
