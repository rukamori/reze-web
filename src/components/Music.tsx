import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play as PlayIcon, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { cn } from "../utils/cn";
import { PLAYLISTS, TRACKS, ytThumb, type Playlist } from "../lib/data";
import { Kicker, StatusDot } from "./ui";

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
};

/* ---------------- YouTube IFrame API loader (once, on first click) ---------------- */

let ytReady: Promise<void> | null = null;
function loadYT(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (ytReady) return ytReady;
  ytReady = new Promise<void>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      ytReady = null;
      reject(new Error("YouTube player failed to load"));
    };
    document.head.appendChild(s);
  });
  return ytReady;
}

const YT_PLAYING = 1;
const YT_ENDED = 0;

/**
 * Full songs through YouTube's official, visible embed. Nothing loads or plays
 * until the visitor presses Play; no audio files are hosted here.
 */
export function TrackPlayer() {
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [vol, setVol] = useState(72);

  const mountRef = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const volRef = useRef(vol);
  volRef.current = vol;

  const go = useCallback((n: number) => {
    const i = (n + TRACKS.length) % TRACKS.length;
    setIdx(i);
    setProgress(0);
    setDuration(0);
    player.current?.loadVideoById?.(TRACKS[i].youtubeId);
  }, []);

  // Seek readout: one rAF loop, only while playing
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      const p = player.current;
      if (p?.getCurrentTime) {
        const t = p.getCurrentTime() as number;
        if (Math.floor(t) !== last) {
          last = Math.floor(t);
          setProgress(t);
          setDuration((p.getDuration?.() as number) || 0);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => () => player.current?.destroy?.(), []);

  const start = async () => {
    if (player.current || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      await loadYT();
      const host = document.createElement("div");
      mountRef.current?.replaceChildren(host);
      player.current = new window.YT.Player(host, {
        videoId: TRACKS[idxRef.current].youtubeId,
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, autoplay: 1, modestbranding: 1 },
        events: {
          onReady: (e: any) => {
            e.target.setVolume(volRef.current);
            e.target.playVideo();
          },
          onStateChange: (e: any) => {
            setPlaying(e.data === YT_PLAYING);
            if (e.data === YT_ENDED) go(idxRef.current + 1);
          },
          onError: () => setFailed(true),
        },
      });
      setStarted(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const p = player.current;
    if (!p) return void start();
    if (playing) p.pauseVideo?.();
    else p.playVideo?.();
  };

  const track = TRACKS[idx];

  return (
    <div className="rounded-[var(--radius-lg)] border border-ink bg-composer p-5 shadow-[var(--shadow-ink-sm)]">
      <div className="flex items-center justify-between gap-3">
        <Kicker className="text-ink-soft">Now playing</Kicker>
        <StatusDot tone={playing ? "moss" : "graphite"} label={playing ? "On air" : "Standby"} />
      </div>

      {/* Visible 16:9 player; a poster until the first click */}
      <div className="relative mt-4 aspect-video min-w-[200px] overflow-hidden rounded-[var(--radius-md)] bg-panel-3">
        <div ref={mountRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
        {!started && (
          <>
            <img
              src={ytThumb(track.youtubeId)}
              alt=""
              width={480}
              height={360}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
            <button
              type="button"
              onClick={start}
              disabled={loading}
              aria-label={`Play ${track.title} by ${track.artist}`}
              className="absolute top-1/2 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-vermilion text-ink shadow-[var(--shadow-ink-sm)] transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep disabled:cursor-wait"
            >
              <PlayIcon aria-hidden className="h-5 w-5 translate-x-px fill-current" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      <div className="mt-4 min-w-0">
        <p className="truncate font-display text-title text-ink">{track.title}</p>
        <p className="truncate font-mono text-xs text-graphite">{track.artist}</p>
        {failed && (
          <p role="status" className="mt-1 font-mono text-xs text-vermilion-ink">
            The YouTube player couldn&rsquo;t load here. Try again, or open it on YouTube.
          </p>
        )}
      </div>

      {/* Transport */}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => go(idx - 1)} aria-label="Previous track" className="flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink transition-colors duration-[var(--dur-2)] hover:border-ink">
          <SkipBack aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-[var(--dur-2)]",
            playing ? "bg-ink text-paper hover:bg-ink-soft" : "bg-vermilion text-ink hover:bg-vermilion-deep"
          )}
        >
          {playing ? (
            <Pause aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.5} />
          ) : (
            <PlayIcon aria-hidden className="h-4 w-4 translate-x-px fill-current" strokeWidth={1.5} />
          )}
        </button>
        <button type="button" onClick={() => go(idx + 1)} aria-label="Next track" className="flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink transition-colors duration-[var(--dur-2)] hover:border-ink">
          <SkipForward aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <label className="ml-auto flex items-center gap-2">
          <Volume2 aria-hidden className="h-4 w-4 text-graphite" strokeWidth={1.75} />
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={vol}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVol(v);
              player.current?.setVolume?.(v);
            }}
            className="range w-20 sm:w-24"
          />
        </label>
      </div>

      <div className="mt-2">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          value={Math.floor(progress)}
          onChange={(e) => {
            const v = Number(e.target.value);
            setProgress(v);
            player.current?.seekTo?.(v, true);
          }}
          disabled={!started}
          aria-label="Seek"
          className="range w-full disabled:opacity-50"
        />
        <div className="flex justify-between font-mono text-xs text-graphite tabular">
          <span>{fmt(progress)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Track list */}
      <ol className="mt-4 flex flex-col border-t border-rule pt-2" aria-label="Tracks">
        {TRACKS.map((t, i) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === idx ? "true" : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] p-1.5 text-left transition-colors duration-[var(--dur-2)]",
                i === idx ? "bg-paper-deep" : "hover:bg-[#14130f0d]"
              )}
            >
              <img src={ytThumb(t.youtubeId)} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-[var(--radius-xs)] bg-paper-deep object-cover" />
              <span className="min-w-0">
                <span className={cn("block truncate text-md", i === idx ? "font-semibold text-ink" : "text-ink")}>{t.title}</span>
                <span className="block truncate font-mono text-xs text-graphite">{t.artist}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 font-mono text-xs text-graphite">Streams through YouTube&rsquo;s player.</p>
    </div>
  );
}

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
