/**
 * The short audio overview. It uses the browser's own audio control, so
 * play/pause, seeking, volume and keyboard use all work the way people expect,
 * and it never starts by itself. The whole panel can be collapsed, and the
 * written transcript is one tap away.
 */
export function PitchPlayer({ src, transcript }: { src: string; transcript: string[] }) {
  return (
    <section aria-label="Audio overview" className="mt-8">
      <details open className="rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:p-5">
        <summary className="cursor-pointer text-base font-bold leading-snug text-brand-700">
          Hear how it works (about 80 seconds)
        </summary>

        <audio
          controls
          preload="metadata"
          src={src}
          aria-label="Audio overview of the UK Personal Tax Calculator"
          className="mt-3 w-full"
        >
          Your browser can&apos;t play audio. You can read the transcript below instead.
        </audio>

        <details className="mt-3 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-brand-700 underline underline-offset-4">
            Read the transcript
          </summary>
          <div className="mt-2 space-y-2 leading-relaxed">
            {transcript.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </details>
      </details>
    </section>
  );
}
