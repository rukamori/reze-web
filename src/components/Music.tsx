import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../utils/cn";
import { PLAYLISTS, type Playlist } from "../lib/data";

/* ---------------- Playlist shelf ---------------- */

const CACHE_KEY = "yt_playlists_v1";
const REFRESH_MS = 5 * 60_000;

function readCache(): Playlist[] {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    if (!v) return PLAYLISTS;
    const cached = JSON.parse(v) as Partial<Playlist>[];
    return PLAYLISTS.map((p) => ({ ...p, ...(cached.find((c) => c.id === p.id) ?? {}), label: p.label }));
  } catch {
    return PLAYLISTS;
  }
}

/** Five YouTube Music playlists; title, cover and count refresh from /api/yt-playlists. */
export function PlaylistShelf() {
  const [lists, setLists] = useState<Playlist[]>(readCache);

  useEffect(() => {
    let timer = 0;
    let alive = true;
    const pull = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/yt-playlists", { headers: { Accept: "application/json" } });
        const type = res.headers.get("content-type") || "";
        if (!res.ok || !type.includes("json")) return; // preview has no /api: stay quiet
        const data = await res.json();
        if (!alive || !Array.isArray(data?.playlists)) return;
        setLists((prev) => {
          const next = prev.map((p) => {
            const live = data.playlists.find((x: Partial<Playlist>) => x.id === p.id);
            if (!live) return p;
            return {
              ...p,
              title: live.title || p.title,
              thumbnail: live.thumbnail || p.thumbnail,
              itemCount: typeof live.itemCount === "number" ? live.itemCount : p.itemCount,
            };
          });
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(next));
          } catch {
            /* private mode */
          }
          return next;
        });
      } catch {
        /* offline: keep what we have */
      }
    };
    void pull();
    timer = window.setInterval(pull, REFRESH_MS);
    document.addEventListener("visibilitychange", pull);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pull);
    };
  }, []);

  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const dragged = useRef(false);

  // Coverflow: one rAF writes --ry/--tz/--s/--o per card from its distance to centre.
  // Only CSS vars are written; layout and scroll position are left to the browser.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let settle = 0;
    let lastActive = -1;
    const apply = () => {
      raf = 0;
      const tr = track.getBoundingClientRect();
      const mid = tr.left + tr.width / 2;
      let best = 0;
      let bestD = Infinity;
      const cards = track.querySelectorAll<HTMLElement>(".pl-card");
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const step = r.width + 20;
        const d = Math.max(-2, Math.min(2, (r.left + r.width / 2 - mid) / step));
        if (Math.abs(d) < bestD) {
          bestD = Math.abs(d);
          best = i;
        }
        if (reduced) return;
        const tilt = card.firstElementChild as HTMLElement | null;
        if (!tilt) return;
        const a = Math.abs(d);
        tilt.style.setProperty("--ry", `${(Math.max(-1, Math.min(1, d)) * -32).toFixed(2)}deg`);
        tilt.style.setProperty("--tz", `${(-a * 60).toFixed(1)}px`);
        tilt.style.setProperty("--s", (1 - Math.min(a, 1) * 0.12).toFixed(3));
        tilt.style.setProperty("--o", (1 - Math.min(a, 2) * 0.25).toFixed(3));
      });
      if (best !== lastActive) {
        lastActive = best;
        setActive(best);
      }
    };
    const onScroll = () => {
      track.setAttribute("data-moving", "");
      window.clearTimeout(settle);
      settle = window.setTimeout(() => track.removeAttribute("data-moving"), 120);
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onResize = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Mouse drag-to-scroll (touch keeps native scroll-snap)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let down = false;
    let x0 = 0;
    let left0 = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true;
      dragged.current = false;
      x0 = e.clientX;
      left0 = track.scrollLeft;
      track.style.scrollSnapType = "none";
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - x0;
      if (!dragged.current && Math.abs(dx) > 6) {
        dragged.current = true;
        track.setPointerCapture(e.pointerId);
        track.setAttribute("data-dragging", "");
      }
      if (dragged.current) track.scrollLeft = left0 - dx;
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      track.removeAttribute("data-dragging");
      if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
      track.style.scrollSnapType = "";
      // settle onto the nearest card
      const card = track.querySelector<HTMLElement>(".pl-card");
      if (card && dragged.current) {
        const step = card.offsetWidth + 20;
        const i = Math.round(track.scrollLeft / step);
        track.scrollTo({ left: i * step, behavior: "smooth" });
      }
    };
    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
    track.addEventListener("pointercancel", onUp);
    return () => {
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
      track.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const go = (dir: number) => {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(".pl-card");
    if (!track || !card) return;
    track.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: "smooth" });
  };

  // Desktop hover tilt on the cover, rAF + CSS vars only
  const hoverRaf = useRef(0);
  const onCoverMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    if (hoverRaf.current) return;
    hoverRaf.current = requestAnimationFrame(() => {
      hoverRaf.current = 0;
      const r = el.getBoundingClientRect();
      const ux = (clientX - r.left) / r.width - 0.5;
      const uy = (clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--hx", `${(ux * 16).toFixed(2)}deg`);
      el.style.setProperty("--hy", `${(-uy * 16).toFixed(2)}deg`);
    });
  };
  const onCoverLeave = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--hx", "0deg");
    e.currentTarget.style.setProperty("--hy", "0deg");
  };

  return (
    <div role="region" aria-roledescription="carousel" aria-label="My YouTube Music playlists" className="pl-wrap">
      <ul
        ref={trackRef}
        className="pl-track"
        tabIndex={0}
        aria-label="Playlists, swipe or use the arrow keys"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(-1);
          }
        }}
      >
        {lists.map((p, i) => (
          <li key={p.id} className="pl-card" aria-roledescription="slide" aria-label={`${i + 1} of ${lists.length}: ${p.label}`}>
            <a
              href={`https://music.youtube.com/playlist?list=${p.id}`}
              target="_blank"
              rel="noreferrer"
              draggable={false}
              onClick={(e) => {
                if (dragged.current) {
                  e.preventDefault();
                  dragged.current = false;
                }
              }}
              onPointerMove={onCoverMove}
              onPointerLeave={onCoverLeave}
              className="pl-tilt group block rounded-[var(--radius-lg)]"
            >
              <span className="pl-cover block overflow-hidden rounded-[var(--radius-lg)] bg-paper-deep shadow-[0_18px_40px_-22px_#14130f80]">
                <img
                  src={p.thumbnail}
                  alt={`${p.title} playlist cover`}
                  width={480}
                  height={480}
                  loading="lazy"
                  draggable={false}
                  className="block aspect-square w-full object-cover"
                />
              </span>
              <span className="kicker mt-4 block text-ink-soft">{p.label}</span>
              <span className="mt-1 block truncate text-md text-ink transition-colors duration-[var(--dur-2)] group-hover:text-vermilion-ink">
                {p.title}
              </span>
              {typeof p.itemCount === "number" && (
                <span className="mt-0.5 block font-mono text-xs text-graphite tabular">{p.itemCount.toLocaleString("en-US")} tracks</span>
              )}
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous playlist"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink transition-colors duration-[var(--dur-2)] hover:border-ink"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <span aria-hidden className="flex items-center gap-1.5">
          {lists.map((p, i) => (
            <span
              key={p.id}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-[var(--dur-3)] ease-[var(--ease-out)]",
                i === active ? "w-5 bg-ink" : "w-1.5 bg-rule-strong"
              )}
            />
          ))}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next playlist"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink transition-colors duration-[var(--dur-2)] hover:border-ink"
        >
          <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {lists[active] ? `${lists[active].label}: ${lists[active].title}` : ""}
      </p>
    </div>
  );
}
