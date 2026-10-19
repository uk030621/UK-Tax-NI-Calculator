"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Spinner } from "@/components/Spinner";

export function AuthButton() {
  const { data: session, status } = useSession();
  // Set on click and never cleared: signing in or out navigates away, so the
  // spinner simply stays until the next page has loaded.
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  if (status === "loading") {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-slate-100" />;
  }

  if (session?.user) {
    return (
      <button
        onClick={() => {
          setBusy("out");
          signOut();
        }}
        disabled={busy !== null}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-70"
      >
        {busy === "out" ? (
          <Spinner className="h-4 w-4" />
        ) : session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="h-5 w-5 rounded-full"
          />
        )}
        {busy === "out" ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        setBusy("in");
        signIn("google");
      }}
      disabled={busy !== null}
      className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-80"
    >
      {busy === "in" && <Spinner />}
      {busy === "in" ? "Signing you in…" : "Sign in with Google"}
    </button>
  );
}
