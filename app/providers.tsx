"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  // Passing the already-resolved session in means useSession() in any
  // client component (AuthButton, in particular) reports the correct
  // status immediately on first render — no "loading" state to flash
  // through, since the server already did this fetch a moment ago in
  // the layout above.
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
