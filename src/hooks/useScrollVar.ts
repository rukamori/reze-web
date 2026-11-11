import { useEffect, type RefObject } from "react";

/**
 * Scroll-linked motion.
 *
 * Preferred path: CSS scroll-driven animations (`animation-timeline: view()`),
 * which run on the compositor and follow the finger exactly. When the browser
 * supports them this hook does nothing at all — no scroll listener, no JS.
 *
 * Fallback (Firefox today): one rAF that computes progress from *cached*
 * geometry, so it never reads the layout of the element it transforms (that
 * feedback loop is what made the old version stutter), eases toward the target,
 * and writes `--p` only on the registered element — never on <html>, which
 * would restyle the whole document every frame.
 */

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const supportsViewTimeline = () =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline", "view()");

type Item = { el: HTMLElement; top: number; h: number; cur: number; target: number };

const items = new Map<HTMLElement, Item>();
let raf = 0;
let settling = false;
let ro: ResizeObserver | null = null;

/** Cache document-space geometry once; re-measured on resize/content change. */
function measure(it: Item) {
  const r = it.el.getBoundingClientRect();
  it.top = r.top + window.scrollY;
  it.h = r.height;
}

function frame() {
  raf = 0;
  const vh = window.innerHeight || 1;
  const mid = window.scrollY + vh / 2;
  let moving = false;
  for (const it of items.values()) {
    it.target = Math.max(-1, Math.min(1, (it.top + it.h / 2 - mid) / vh));
    // critically damped ease: no overshoot, no visible stepping
    it.cur += (it.target - it.cur) * 0.18;
    if (Math.abs(it.target - it.cur) < 0.0008) it.cur = it.target;
    else moving = true;
    it.el.style.setProperty("--p", it.cur.toFixed(4));
  }
  settling = moving;
  if (moving) raf = requestAnimationFrame(frame);
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(frame);
}

function onScroll() {
  settling = true;
  schedule();
}

function onResize() {
  for (const it of items.values()) measure(it);
  schedule();
}

function listen(on: boolean) {
  if (on) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    if (!ro && typeof ResizeObserver !== "undefined") ro = new ResizeObserver(onResize);
  } else {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
  }
}

/** Registers `ref` for `--p` (-1 above … 0 centred … 1 below). */
export function useScrollVar(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    // CSS drives it, or the visitor asked for no motion
    if (!el || reduced() || supportsViewTimeline()) return;
    const it: Item = { el, top: 0, h: 0, cur: 0, target: 0 };
    measure(it);
    const wasEmpty = items.size === 0;
    items.set(el, it);
    ro?.observe(el);
    if (wasEmpty) listen(true);
    schedule();
    return () => {
      items.delete(el);
      ro?.unobserve(el);
      el.style.removeProperty("--p");
      if (items.size === 0) {
        listen(false);
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        settling = false;
      }
    };
  }, [ref]);
}

/**
 * Writes `--sv` (eased scroll speed, 0…1) on the given element only.
 * Used by the manga speed lines, which flare during a fast flick.
 */
export function useVelocityVar(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let localRaf = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let sv = 0;
    let visible = false;

    const tick = (now: number) => {
      localRaf = 0;
      const y = window.scrollY;
      const dt = Math.max(1, now - lastT);
      const v = Math.min(1, Math.abs(y - lastY) / dt / 3);
      lastY = y;
      lastT = now;
      sv += (v - sv) * (v > sv ? 0.4 : 0.1);
      if (sv < 0.004) sv = 0;
      el.style.setProperty("--sv", sv.toFixed(3));
      if (sv > 0 && visible) localRaf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (visible && !localRaf) localRaf = requestAnimationFrame(tick);
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) kick();
      });
      io.observe(el);
    } else visible = true;

    window.addEventListener("scroll", kick, { passive: true });
    return () => {
      window.removeEventListener("scroll", kick);
      io?.disconnect();
      if (localRaf) cancelAnimationFrame(localRaf);
      el.style.removeProperty("--sv");
    };
  }, [ref]);
}

/** True while the JS fallback is still easing (used by tests). */
export const isSettling = () => settling;
