import { useCallback, useEffect, useRef, useState } from "react";
import { PLAYLISTS, type Playlist } from "../lib/data";

/* ---------------- Playlist shelf ---------------- */

const CACHE_KEY = "yt_playlists_v1";

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

/** Five YouTube Music playlists as a swipeable stack of real covers. */
export function PlaylistShelf() {
  const [lists, setLists] = useState<Playlist[]>(readCache);
  const [order, setOrder] = useState<number[]>(() => PLAYLISTS.map((_, i) => i));
  const [live, setLive] = useState(false);
  const deckRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** Refresh title, cover and count on every page load (covers are signed URLs). */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/yt-playlists?t=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
        if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return;
        const data = await res.json();
        if (!alive || !Array.isArray(data?.playlists)) return;
        setLists((prev) => {
          const next = prev.map((p) => {
            const l = data.playlists.find((x: Partial<Playlist>) => x.id === p.id);
            return l
              ? {
                  ...p,
                  title: l.title || p.title,
                  thumbnail: l.thumbnail || p.thumbnail,
                  itemCount: typeof l.itemCount === "number" ? l.itemCount : p.itemCount,
                }
              : p;
          });
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(next));
          } catch {
            /* private mode */
          }
          return next;
        });
        setLive(true);
      } catch {
        /* keep the cache */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Send the top card to the back (dir -1 brings the last one forward). */
  const cycle = useCallback((dir: 1 | -1) => {
    setOrder((o) => (dir === 1 ? [...o.slice(1), o[0]] : [o[o.length - 1], ...o.slice(0, -1)]));
  }, []);

  /* Drag the top card 1:1, fly it out past the threshold, else spring back. */
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    let card: HTMLElement | null = null;
    let id = -1;
    let x0 = 0;
    let t0 = 0;
    let dx = 0;
    let dragging = false;

    const topCard = () => deck.querySelector<HTMLElement>('[data-top="true"]');
    const setT = (el: HTMLElement, v: string, trans = "none") => {
      el.style.transition = trans;
      el.style.transform = v;
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      card = topCard();
      if (!card) return;
      id = e.pointerId;
      x0 = e.clientX;
      t0 = performance.now();
      dx = 0;
      dragging = false;
      card.setPointerCapture?.(id);
    };
    const move = (e: PointerEvent) => {
      if (!card || e.pointerId !== id) return;
      dx = e.clientX - x0;
      if (!dragging && Math.abs(dx) > 6) {
        dragging = true;
        deck.dataset.dragging = "true";
      }
      if (!dragging) return;
      e.preventDefault();
      setT(card, `translate3d(${dx}px,0,0) rotate(${(dx * 0.06).toFixed(2)}deg) rotateY(${(dx * -0.08).toFixed(2)}deg)`);
    };
    const up = (e: PointerEvent) => {
      if (!card || e.pointerId !== id) return;
      const el = card;
      const moved = Math.abs(dx);
      const v = moved / Math.max(1, performance.now() - t0);
      delete deck.dataset.dragging;
      card = null;
      if (!dragging) return; // a tap: the <a> handles it
      if (moved > 90 || v > 0.5) {
        const dir = dx < 0 ? -1 : 1;
        if (reduced) {
          el.style.transition = "none";
          el.style.transform = "";
          cycle(1);
          return;
        }
        setT(el, `translate3d(${dir * 120}%,0,0) rotate(${dir * 12}deg)`, "transform .35s var(--ease-out), opacity .35s var(--ease-out)");
        el.style.opacity = "0";
        window.setTimeout(() => {
          el.style.transition = "none";
          el.style.transform = "";
          el.style.opacity = "";
          cycle(1);
        }, 330);
      } else {
        setT(el, "", "transform .3s var(--ease-out)");
        window.setTimeout(() => {
          el.style.transition = "";
        }, 320);
      }
    };

    deck.addEventListener("pointerdown", down);
    deck.addEventListener("pointermove", move);
    deck.addEventListener("pointerup", up);
    deck.addEventListener("pointercancel", up);
    return () => {
      deck.removeEventListener("pointerdown", down);
      deck.removeEventListener("pointermove", move);
      deck.removeEventListener("pointerup", up);
      deck.removeEventListener("pointercancel", up);
    };
  }, [cycle, reduced]);

  const top = lists[order[0]];

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="My YouTube Music playlists — swipe or use the arrow keys"
      className="pl-deck-wrap"
    >
      <div
        ref={deckRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            cycle(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            cycle(-1);
          }
        }}
        className="pl-deck"
      >
        {order.map((li, depth) => {
          const p = lists[li];
          const isTop = depth === 0;
          return (
            <div
              key={p.id}
              data-top={isTop ? "true" : undefined}
              className="pl-stack-card"
              style={{ ["--d" as string]: depth, zIndex: order.length - depth }}
              aria-hidden={!isTop}
            >
              <a
                href={`https://music.youtube.com/playlist?list=${p.id}`}
                target="_blank"
                rel="noreferrer"
                draggable={false}
                tabIndex={isTop ? 0 : -1}
                className="block h-full w-full rounded-[var(--radius-lg)]"
                aria-label={`${p.label}: ${p.title}${typeof p.itemCount === "number" ? `, ${p.itemCount} tracks` : ""} — open in YouTube Music`}
              >
                <img
                  src={p.thumbnail}
                  alt=""
                  width={480}
                  height={480}
                  loading={depth > 1 ? "lazy" : "eager"}
                  decoding="async"
                  draggable={false}
                  className="pl-cover block h-full w-full rounded-[var(--radius-lg)] bg-paper-deep object-cover"
                />
              </a>
            </div>
          );
        })}
      </div>

      <div className="pl-meta" aria-live="polite">
        <p key={top?.id} className="m-swap">
          <span className="kicker block text-ink-soft">{top?.label}</span>
          <span className="mt-1 block truncate text-md text-ink">{top?.title}</span>
          {typeof top?.itemCount === "number" && (
            <span className="mt-0.5 block font-mono text-xs text-graphite tabular">
              {top.itemCount.toLocaleString("en-US")} tracks{live ? "" : ""}
            </span>
          )}
        </p>
        <p className="mt-2 font-mono text-xs text-graphite">Swipe the covers</p>
      </div>
    </div>
  );
}
