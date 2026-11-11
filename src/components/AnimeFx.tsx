import { useEffect, useRef } from "react";
import { useScrollVar, useVelocityVar } from "../hooks/useScrollVar";

/* ------------------------------------------------------------------ *
 * Original, abstract anime/manga-style FX. No characters are drawn.
 * Everything is aria-hidden, pointer-events: none, transform/opacity only,
 * and driven by the shared scroll clock (--p per element, --sv velocity).
 * Reduced motion: all of it holds still (see index.css).
 * ------------------------------------------------------------------ */

/** Adds data-off while the element is off-screen or the tab is hidden, so CSS loops pause. */
function useOffscreenPause(ref: React.RefObject<Element | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = true;
    const sync = () => {
      if (onScreen && !document.hidden) el.removeAttribute("data-off");
      else el.setAttribute("data-off", "");
    };
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        sync();
      });
      io.observe(el);
    }
    document.addEventListener("visibilitychange", sync);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref]);
}

/** A single sakura petal with the notched tip. */
const PETAL = "M0 -11 L-2 -8 C-7 -10 -10 -3 -7 4 C-5 8 -2 10 0 10 C2 10 5 8 7 4 C10 -3 7 -10 2 -8 Z";

/* Deterministic layout: x %, start y %, size px, fall s, delay s, sway px, depth */
const PETALS: [number, number, number, number, number, number, number][] = [
  [6, -6, 14, 18, -2, 40, 1.0],
  [18, -12, 10, 22, -9, 28, 0.6],
  [29, -4, 16, 16, -5, 52, 1.3],
  [41, -10, 11, 20, -13, 34, 0.8],
  [53, -8, 13, 17, -3, 44, 1.1],
  [64, -14, 9, 21, -11, 26, 0.5],
  [72, -5, 15, 15, -7, 48, 1.4],
  [81, -11, 12, 19, -1, 38, 0.9],
  [90, -7, 10, 22, -15, 30, 0.7],
  [12, -16, 12, 20, -17, 36, 1.2],
  [47, -18, 14, 18, -19, 46, 1.0],
  [86, -15, 11, 16, -6, 32, 0.6],
];

export function SakuraField() {
  const ref = useRef<HTMLDivElement>(null);
  useOffscreenPause(ref);

  return (
    <div ref={ref} aria-hidden className="sakura pointer-events-none absolute inset-0 overflow-hidden">
      {PETALS.map(([x, y, size, dur, delay, sway, depth], i) => (
        <span
          key={i}
          className="petal-rush"
          style={{ left: `${x}%`, top: `${y}%`, ["--depth" as string]: depth }}
        >
          <svg
            className="petal"
            width={size * 2}
            height={size * 2}
            viewBox="-12 -12 24 24"
            style={{ ["--dur" as string]: `${dur}s`, ["--delay" as string]: `${delay}s`, ["--sway" as string]: `${sway}px` }}
          >
            <path
              d={PETAL}
              fill={i % 5 === 2 ? "var(--color-vermilion-wash)" : "var(--color-paper-deep)"}
              stroke={i % 5 === 2 ? "#ff4a1c66" : "var(--color-rule-strong)"}
              strokeWidth={0.9}
            />
            <path d="M0 -6 L0 4" stroke="var(--color-rule-strong)" strokeWidth={0.6} />
          </svg>
        </span>
      ))}
    </div>
  );
}

/** Manga speed lines: a radial burst that only shows while scrolling fast (--sv). */
export function SpeedLines() {
  const ref = useRef<SVGSVGElement>(null);
  useVelocityVar(ref as unknown as React.RefObject<HTMLElement>);
  const lines = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const r0 = 46 + ((i * 37) % 9);
    const r1 = 100;
    return {
      x1: 100 + Math.cos(a) * r0,
      y1: 100 + Math.sin(a) * r0,
      x2: 100 + Math.cos(a) * r1 * 1.6,
      y2: 100 + Math.sin(a) * r1 * 1.6,
      w: i % 3 === 0 ? 0.9 : 0.45,
    };
  });
  return (
    <svg ref={ref} aria-hidden viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className="speed-lines pointer-events-none absolute hidden md:block">
      {lines.map((l, i) => (
        <line key={i} x1={l.x1.toFixed(1)} y1={l.y1.toFixed(1)} x2={l.x2.toFixed(1)} y2={l.y2.toFixed(1)} stroke="var(--color-ink)" strokeWidth={l.w} />
      ))}
    </svg>
  );
}

/** Halftone dot field behind a section head; the dots slide with scroll. */
export function Halftone({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref);
  return <div ref={ref} aria-hidden className={`halftone pointer-events-none absolute ${className}`} />;
}

/** Kana title band between sections: slides with scroll, drifts slowly.
    Pauses on hover/focus and under reduced motion, and stops when off-screen. */
export function KanaMarquee() {
  const ref = useRef<HTMLElement>(null);
  useScrollVar(ref);
  useOffscreenPause(ref);
  const text = "カスタムROM · アプリ · ルート · v3rsi0n";
  const row = Array.from({ length: 4 }, (_, i) => (
    <span key={i} className="kana-item">
      {text}
      <span className="kana-star">✦</span>
    </span>
  ));
  return (
    <section ref={ref} aria-label={`Banner: ${text}`} className="kana-band relative overflow-hidden border-y border-ink bg-ink text-paper">
      <div aria-hidden className="kana-scroll">
        <div className="kana-track">
          {row}
          {row}
        </div>
      </div>
    </section>
  );
}

/** Circular text badge that turns as it passes through the viewport. */
export function SpinBadge({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref);
  return (
    <div ref={ref} aria-hidden className={`spin-badge pointer-events-none ${className}`}>
      <svg viewBox="0 0 120 120" className="spin-badge-ring h-full w-full">
        <defs>
          <path id="badge-circle" d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
        <text fill="currentColor" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" letterSpacing="3.2">
          <textPath href="#badge-circle">✦ FLASH · ROOT · SHIP ✦ FLASH · ROOT · SHIP</textPath>
        </text>
      </svg>
      <span className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-vermilion" />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bigger reactive pieces. All original abstract vector art, driven by
 * the same scroll timelines (CSS where supported, --p fallback).
 * ------------------------------------------------------------------ */

/** Manga motion arrows that draw themselves in as the section arrives. */
export function MotionVectors({ className = "", flip = false, count = 5 }: { className?: string; flip?: boolean; count?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref);
  const rows = Array.from({ length: count }, (_, i) => {
    const y = 14 + i * 20;
    const len = 96 - (i % 3) * 22;
    return { y, len, w: i % 2 === 0 ? 1.4 : 0.8 };
  });
  return (
    <div ref={ref} aria-hidden className={`mv ${className}`} data-flip={flip || undefined}>
      <svg viewBox="0 0 140 110" className="h-full w-full" fill="none" stroke="currentColor" strokeLinecap="round">
        {rows.map((r, i) => (
          <g key={i} className="mv-line" style={{ ["--i" as string]: i }}>
            <path d={`M4 ${r.y}h${r.len}`} strokeWidth={r.w} pathLength={1} />
            <path d={`M${r.len - 6} ${r.y - 5}l7 5-7 5`} strokeWidth={r.w} pathLength={1} />
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Huge outlined wordmark sliding behind a section. */
export function GiantType({ text = "V3RSI0N", reverse = false, className = "" }: { text?: string; reverse?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref);
  return (
    <div ref={ref} aria-hidden className={`giant-type ${className}`} data-reverse={reverse || undefined}>
      <span className="giant-type-row">{text}</span>
    </div>
  );
}

/** Dashed orbit ring with a vermilion satellite. */
export function OrbitRing({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref);
  return (
    <div ref={ref} aria-hidden className={`orbit ${className}`}>
      <svg viewBox="0 0 200 200" className="orbit-ring h-full w-full" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="96" strokeWidth="1" strokeDasharray="3 7" />
        <circle cx="100" cy="100" r="72" strokeWidth="1" opacity="0.6" />
        <circle cx="100" cy="100" r="44" strokeWidth="1" strokeDasharray="1 6" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={(100 + Math.cos(a) * 88).toFixed(1)}
              y1={(100 + Math.sin(a) * 88).toFixed(1)}
              x2={(100 + Math.cos(a) * (i % 4 === 0 ? 78 : 83)).toFixed(1)}
              y2={(100 + Math.sin(a) * (i % 4 === 0 ? 78 : 83)).toFixed(1)}
              strokeWidth="1"
            />
          );
        })}
        <circle cx="196" cy="100" r="5" fill="var(--color-vermilion)" stroke="none" />
      </svg>
    </div>
  );
}

/** A band of speed lines that wipes open from the left as it enters. */
export function BurstLines({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref);
  return (
    <div ref={ref} aria-hidden className={`burst ${className}`}>
      <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="burst-inner h-full w-full" fill="none" stroke="currentColor">
        {Array.from({ length: 30 }, (_, i) => {
          const y = (i % 10) * 4 + 2;
          const x = (i * 13) % 360;
          return <line key={i} x1={x} y1={y} x2={x + 30 + (i % 5) * 14} y2={y} strokeWidth={i % 3 === 0 ? 1.4 : 0.7} />;
        })}
      </svg>
    </div>
  );
}
