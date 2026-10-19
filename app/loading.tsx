import { Spinner } from "@/components/Spinner";

// Shown straight away while the home page is prepared on the server
// (checking your sign-in, access and the latest rates can take a few
// seconds), so a tap on a button is never followed by a blank screen.
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Spinner className="h-10 w-10 text-brand-500" />
      <p role="status" className="text-base font-medium text-slate-700">
        Loading the calculator…
      </p>
      <p className="text-sm text-slate-500">This can take a few seconds.</p>
    </main>
  );
}
