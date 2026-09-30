import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { AdminTaxYearForm } from "@/components/AdminTaxYearForm";

// Same reasoning as app/page.tsx: this page's entire authorization check
// depends on a fresh session read every request, so it must never be
// served from a cached copy rendered for a different visitor or an
// earlier, unauthenticated request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminTaxYearsPage() {
  const session = await getServerSession(authOptions);

  if (!isAdminEmail(session?.user?.email)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold text-slate-900">Not authorized</p>
        <p className="mt-2 text-sm text-slate-500">
          Sign in with an account listed in <code>ADMIN_EMAILS</code> to
          manage tax year rates.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <a
          href="/"
          className="mb-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to calculator
        </a>
        <a
          href="/admin/access"
          className="mb-3 ml-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Manage access →
        </a>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Manage tax years
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Add a new tax year&apos;s HMRC rates, or fix an existing one. Copy
          last year&apos;s figures in as a starting point and edit only what
          the Budget changed.
        </p>
      </header>

      <AdminTaxYearForm />

      <footer className="mt-12 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} UK Tax &amp; NI Calculator. All rights reserved.
      </footer>
    </main>
  );
}
