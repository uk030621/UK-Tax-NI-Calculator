import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { AdminAccessForm } from "@/components/AdminAccessForm";

// Same reasoning as app/page.tsx and app/admin/tax-years/page.tsx: this
// page's entire authorization check depends on a fresh session read
// every request, so it must never be served from a cached copy
// rendered for a different visitor or an earlier, unauthenticated
// request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAccessPage() {
  const session = await getServerSession(authOptions);

  if (!isAdminEmail(session?.user?.email)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold text-slate-900">Not authorized</p>
        <p className="mt-2 text-sm text-slate-500">
          Sign in with an account listed in <code>ADMIN_EMAILS</code> to
          manage who can use this app.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-4">
          <a
            href="/"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            ← Back to calculator
          </a>
          <a
            href="/admin/tax-years"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Manage tax years →
          </a>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Manage access
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Control who can sign in and use the calculator. Changes here
          take effect immediately, no redeploy needed.
        </p>
      </header>

      <AdminAccessForm />

      <footer className="mt-12 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} UK Tax &amp; NI Calculator. All rights reserved.
      </footer>
    </main>
  );
}
