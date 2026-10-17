import React from "react";

/**
 * A small Markdown renderer covering exactly what the user guide uses:
 * headings, paragraphs, bullet and numbered lists (with indented
 * continuation lines), tables, horizontal rules, **bold**, *italic* and
 * `code`. Deliberately not a general-purpose parser — it never renders raw
 * HTML, so content can't inject markup.
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key} className="font-semibold text-slate-800">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(<code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{tok.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export type GuideSection = { title: string; id: string; markdown: string };

/** Splits the guide into its "## " sections. Text before the first one is returned as the intro. */
export function splitGuide(md: string): { title: string; intro: string; sections: GuideSection[] } {
  const lines = md.split("\n");
  let title = "";
  const intro: string[] = [];
  const sections: GuideSection[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (/^# /.test(line) && !title) {
      title = line.replace(/^# /, "").trim();
    } else if (/^## /.test(line)) {
      if (current) sections.push({ title: current.title, id: slugify(current.title), markdown: current.lines.join("\n") });
      current = { title: line.replace(/^## /, "").trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  if (current) sections.push({ title: current.title, id: slugify(current.title), markdown: current.lines.join("\n") });
  return { title, intro: intro.join("\n"), sections };
}

const BULLET = /^(\s*)([-*])\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+)\.\s+(.*)$/;

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  const isBlockStart = (l: string) =>
    /^#{1,6}\s/.test(l) || /^\s*---+\s*$/.test(l) || l.startsWith("|") || BULLET.test(l) || NUMBERED.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }

    const h = /^(#{3,6})\s+(.*)$/.exec(line);
    if (h) {
      const text = h[2].trim();
      out.push(
        <h3 key={k++} id={slugify(text)} className="mt-6 scroll-mt-4 text-base font-semibold text-slate-800">
          {renderInline(text, `h${k}`)}
        </h3>
      );
      i++; continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      out.push(<hr key={k++} className="my-6 border-slate-200" />);
      i++; continue;
    }

    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={k++} className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-600">
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-800">
                    {renderInline(c, `th${k}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="odd:bg-slate-50">
                  {r.map((c, ci) => (
                    <td key={ci} className="border-b border-slate-100 px-3 py-2 align-top">
                      {renderInline(c, `td${k}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const re = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) {
          items.push(m[3]);
          i++;
        } else if (lines[i].trim() !== "" && /^\s+/.test(lines[i]) && items.length > 0 && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i])) {
          items[items.length - 1] += " " + lines[i].trim();
          i++;
        } else break;
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag
          key={k++}
          className={`mt-3 space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 ${ordered ? "list-decimal" : "list-disc"}`}
        >
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `li${k}-${ii}`)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(
      <p key={k++} className="mt-3 text-sm leading-relaxed text-slate-600">
        {renderInline(para.join(" "), `p${k}`)}
      </p>
    );
  }
  return <>{out}</>;
}
