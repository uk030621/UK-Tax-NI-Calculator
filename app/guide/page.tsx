import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { userGuideMarkdown } from "@/content/userGuide";
import { Markdown, splitGuide } from "@/components/MarkdownGuide";

// The administrator-only sections are hidden from everyone else, so the
// page depends on who is signed in and can't be statically cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "User guide – UK Tax & NI Calculator",
  description: "How to use the UK Tax & NI Calculator, field by field, with answers to common questions.",
};

export default async function GuidePage() {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminEmail(session?.user?.email);
  const { title, intro, sections: all } = splitGuide(userGuideMarkdown);
  const sections = all.filter((s) => isAdmin || !/administrators only/i.test(s.title));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <a href="/" className="mb-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Back to calculator
      </a>

      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      <Markdown source={intro} />

      <nav id="contents" aria-label="Guide contents" className="mt-6 scroll-mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
        <p className="text-sm font-semibold text-slate-800">Contents</p>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s) => (
        <section key={s.id} className="mt-10">
          <h2 id={s.id} className="scroll-mt-4 text-xl font-semibold text-slate-900">
            {s.title}
          </h2>
          <Markdown source={s.markdown} />
          <p className="mt-5 text-right">
            <a href="#contents" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              ↑ Back to contents
            </a>
          </p>
        </section>
      ))}

      <p className="mt-12 text-center text-xs text-slate-400">
        Figures are illustrative and based on published HM Revenue &amp; Customs (HMRC) rates. Not a
        substitute for professional tax advice.
      </p>
    </main>
  );
}
