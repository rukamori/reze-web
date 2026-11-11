import { useEffect, type RefObject } from "react";

/**
 * One scroll clock for the whole page.
 * - Registered elements that are on screen get `--p`: their centre relative to
 *   the viewport centre, -1 (above) … 0 (centred) … 1 (below), 3 decimals.
 * - <html> gets `--sv`: eased scroll speed, 0 (still) … 1 (fast flick).
 * One passive scroll/resize listener, one rAF, no React state.
 * Disabled under prefers-reduced-motion (vars stay at their 0 defaults).
 */

const visible = new Set<HTMLElement>();
const all = new Set<HTMLElement>();
let io: IntersectionObserver | null = null;
let raf = 0;
let lastY = 0;
let lastT = 0;
let sv = 0;
let listening = false;

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function frame(now: number) {
  raf = 0;
  const vh = window.innerHeight || 1;
  for (const el of visible) {
    const r = el.getBoundingClientRect();
    const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
    el.style.setProperty("--p", p.toFixed(3));
  }
  // velocity: px per ms → 0..1, eased back to 0 when the page stops
  const y = window.scrollY;
  const dt = Math.max(1, now - (lastT || now - 16));
  const v = Math.min(1, Math.abs(y - lastY) / dt / 3);
  lastY = y;
  lastT = now;
  sv = sv + (v - sv) * (v > sv ? 0.35 : 0.08);
  if (sv < 0.002) sv = 0;
  document.documentElement.style.setProperty("--sv", sv.toFixed(3));
  if (sv > 0) raf = requestAnimationFrame(frame); // keep easing down
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(frame);
}

function ensure() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  lastY = window.scrollY;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) visible.add(el);
        else visible.delete(el);
      }
      schedule();
    },
    { rootMargin: "20% 0px 20% 0px" }
  );
  for (const el of all) io.observe(el);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
}

/** Register `ref` with the scroll clock; it receives `--p` while on screen. */
export function useScrollVar(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || typeof IntersectionObserver === "undefined") return;
    all.add(el);
    ensure();
    io?.observe(el);
    schedule();
    return () => {
      all.delete(el);
      visible.delete(el);
      io?.unobserve(el);
    };
  }, [ref]);
}
