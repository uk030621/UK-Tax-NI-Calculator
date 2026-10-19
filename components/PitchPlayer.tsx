"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A play/pause button for the short audio pitch, with a seek bar and a
 * written transcript. The audio file is not downloaded until the button is
 * tapped (preload="none"), and it never starts by itself.
 */
export function PitchPlayer({ src, transcript }: { src: string; transcript: string[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setFailed(false);
      setWaiting(true);
      audio.play().catch(() => {
        setWaiting(false);
        setFailed(true);
      });
    } else {
      audio.pause();
    }
  }

  return (
    <section
      aria-label="Audio overview"
      className="mt-8 rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:p-5"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause the audio overview" : "Play the audio overview"}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm transition hover:bg-brand-600"
        >
          {waiting ? (
            <Spinner className="h-6 w-6" />
          ) : playing ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight text-brand-700">
            Hear how it works
          </p>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={1}
              value={Math.min(current, duration || 1)}
              onChange={(e) => {
                const audio = audioRef.current;
                if (audio) audio.currentTime = Number(e.target.value);
              }}
              disabled={!duration}
              aria-label="Position in the audio overview"
              className="h-2 w-full min-w-0 cursor-pointer accent-brand-500 disabled:cursor-default"
            />
            <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
              {duration ? `${formatTime(current)} / ${formatTime(duration)}` : "0:48"}
            </span>
          </div>
        </div>
      </div>

      {failed && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          The audio couldn&apos;t be played. You can read the transcript below instead.
        </p>
      )}

      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPlaying={() => setWaiting(false)}
        onWaiting={() => setWaiting(true)}
        onPause={() => {
          setPlaying(false);
          setWaiting(false);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onError={() => {
          setWaiting(false);
          setFailed(true);
        }}
      />

      <details className="mt-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-brand-700">Read the transcript instead</summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          {transcript.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </details>
    </section>
  );
}
