import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AudioLines, ListMusic, Pause, Play as PlayIcon, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { cn } from "../utils/cn";
import { TRACKS, ytThumb, type Track } from "../lib/data";

/* ------------------------------------------------------------------ *
 * One shared YouTube player for the whole site.
 * The header pill controls it; the song list (a portal panel) holds the
 * visible iframe. The iframe never moves in the DOM (moving reloads it),
 * so the panel itself switches between "open" (list under the header) and
 * "mini" (a small visible card, bottom-right) while a song is playing.
 * ------------------------------------------------------------------ */

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

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

type MusicCtx = {
  idx: number;
  track: Track;
  playing: boolean;
  started: boolean;
  failed: boolean;
  progress: number;
  duration: number;
  vol: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  play: (i: number) => void;
  go: (n: number) => void;
  seek: (s: number) => void;
  setVol: (v: number) => void;
  dismiss: () => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
};

const Ctx = createContext<MusicCtx | null>(null);

export function useMusic() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMusic outside MusicProvider");
  return c;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [vol, setVolState] = useState(72);
  const [open, setOpenState] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const player = useRef<any>(null);
  const creating = useRef(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const volRef = useRef(vol);
  volRef.current = vol;

  const load = useCallback((i: number) => {
    const n = (i + TRACKS.length) % TRACKS.length;
    setIdx(n);
    setProgress(0);
    setDuration(0);
    player.current?.loadVideoById?.(TRACKS[n].youtubeId);
    return n;
  }, []);

  const create = useCallback(async (i: number) => {
    if (player.current || creating.current) return;
    creating.current = true;
    setStarted(true);
    setDismissed(false);
    setFailed(false);
    try {
      await loadYT();
      const host = document.createElement("div");
      mountRef.current?.replaceChildren(host);
      player.current = new window.YT.Player(host, {
        videoId: TRACKS[i].youtubeId,
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
            if (e.data === YT_ENDED) load(idxRef.current + 1);
          },
          onError: () => setFailed(true),
        },
      });
    } catch {
      setFailed(true);
    } finally {
      creating.current = false;
    }
  }, [load]);

  /** Header play button / row click: user gesture starts or resumes. */
  const play = useCallback(
    (i: number) => {
      setDismissed(false);
      if (!player.current) {
        setIdx(i);
        void create(i);
        return;
      }
      if (i !== idxRef.current) load(i);
      else player.current.playVideo?.();
    },
    [create, load]
  );

  const toggle = useCallback(() => {
    const p = player.current;
    if (!p) return play(idxRef.current);
    if (playing) p.pauseVideo?.();
    else {
      setDismissed(false);
      p.playVideo?.();
    }
  }, [playing, play]);

  const go = useCallback((n: number) => {
    if (!player.current) {
      setIdx((n + TRACKS.length) % TRACKS.length);
      return;
    }
    load(n);
  }, [load]);

  const seek = useCallback((s: number) => {
    setProgress(s);
    player.current?.seekTo?.(s, true);
  }, []);

  const setVol = useCallback((v: number) => {
    setVolState(v);
    player.current?.setVolume?.(v);
  }, []);

  const dismiss = useCallback(() => {
    player.current?.pauseVideo?.();
    setDismissed(true);
  }, []);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    if (!v) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Seek readout: one rAF loop, only while playing; setState once per second
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

  const value = useMemo<MusicCtx>(
    () => ({
      idx, track: TRACKS[idx], playing, started, failed, progress, duration, vol, open,
      setOpen, toggle, play, go, seek, setVol, dismiss, triggerRef,
    }),
    [idx, playing, started, failed, progress, duration, vol, open, setOpen, toggle, play, go, seek, setVol, dismiss]
  );

  const mode: "open" | "mini" | "hidden" = open ? "open" : started && !dismissed ? "mini" : "hidden";

  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(<SongPanel mode={mode} mountRef={mountRef} />, document.body)}
    </Ctx.Provider>
  );
}

/* ---------------- The panel: song list + the one visible player ---------------- */

function SongPanel({ mode, mountRef }: { mode: "open" | "mini" | "hidden"; mountRef: React.RefObject<HTMLDivElement | null> }) {
  const m = useMusic();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape, outside click and a focus trap while open
  useEffect(() => {
    if (mode !== "open") return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("button, input");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        m.setOpen(false);
      } else if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>("button, input, a[href]")).filter((el) => !el.hasAttribute("disabled"));
        if (!items.length) return;
        const a = items[0];
        const z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel?.contains(t) || m.triggerRef.current?.closest(".hp")?.contains(t)) return;
      m.setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div
      ref={panelRef}
      id="song-list"
      role={mode === "open" ? "dialog" : "region"}
      aria-modal={mode === "open" ? true : undefined}
      aria-label={mode === "open" ? "Song list" : "Now playing"}
      data-mode={mode}
      hidden={mode === "hidden"}
      className="song-panel bg-panel text-panel-text"
    >
      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 border-b border-panel-rule px-4 py-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-vermilion">
          {mode === "open" ? `Music archive · ${String(TRACKS.length).padStart(2, "0")}` : "Now playing"}
        </p>
        <button
          type="button"
          onClick={() => (mode === "open" ? m.setOpen(false) : m.dismiss())}
          aria-label={mode === "open" ? "Close song list" : "Stop and close player"}
          className="flex h-11 w-11 items-center justify-center rounded-full text-panel-text-2 transition-colors duration-[var(--dur-2)] hover:bg-[#f3efe614] hover:text-panel-text"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Rows (open only) */}
      {mode === "open" && (
        <ol className="sp-rows">
          {TRACKS.map((t, i) => {
            const on = i === m.idx;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => m.play(i)}
                  aria-current={on ? "true" : undefined}
                  aria-label={`Play ${t.title} by ${t.artist}`}
                  className={cn(
                    "flex min-h-[72px] w-full items-center gap-4 border-b border-panel-rule px-4 py-3 text-left transition-colors duration-[var(--dur-2)]",
                    on ? "bg-[#f3efe60f]" : "hover:bg-[#f3efe60a]"
                  )}
                >
                  <img
                    src={ytThumb(t.youtubeId)}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-panel-rule"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-semibold uppercase tracking-[0.04em] text-panel-text">{t.title}</span>
                    <span className="block truncate font-mono text-xs uppercase tracking-[0.12em] text-panel-err">{t.artist}</span>
                  </span>
                  {on && m.playing ? (
                    <AudioLines aria-hidden className="sp-bars h-6 w-6 shrink-0 text-panel-err" strokeWidth={1.75} />
                  ) : (
                    <span aria-hidden className="shrink-0 font-display text-[40px] leading-none text-panel-err tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* The one visible YouTube player (never re-parented) */}
      <div className="sp-player-wrap">
        <div className="relative aspect-video w-full overflow-hidden bg-panel-3">
          <div ref={mountRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
          {!m.started && (
            <>
              <img src={ytThumb(m.track.youtubeId)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              <button
                type="button"
                onClick={() => m.play(m.idx)}
                aria-label={`Play ${m.track.title} by ${m.track.artist}`}
                className="absolute top-1/2 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-vermilion text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep"
              >
                <PlayIcon aria-hidden className="h-5 w-5 translate-x-px fill-current" strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className={cn("px-4 pb-4", mode === "mini" ? "pt-2" : "pt-3")}>
        {mode === "mini" && (
          <p className="truncate font-mono text-xs font-semibold uppercase tracking-[0.04em]">
            {m.track.title} <span className="text-panel-err">· {m.track.artist}</span>
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={() => m.go(m.idx - 1)} aria-label="Previous track" className="sp-btn">
            <SkipBack aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={m.toggle}
            aria-label={m.playing ? "Pause" : `Play ${m.track.title}`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-vermilion text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep"
          >
            {m.playing ? <Pause aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.5} /> : <PlayIcon aria-hidden className="h-4 w-4 translate-x-px fill-current" strokeWidth={1.5} />}
          </button>
          <button type="button" onClick={() => m.go(m.idx + 1)} aria-label="Next track" className="sp-btn">
            <SkipForward aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </button>
          {mode === "open" && (
            <label className="ml-auto flex items-center gap-2">
              <Volume2 aria-hidden className="h-4 w-4 text-panel-muted" strokeWidth={1.75} />
              <span className="sr-only">Volume</span>
              <input type="range" min={0} max={100} value={m.vol} onChange={(e) => m.setVol(Number(e.target.value))} className="range range-dark w-24" />
            </label>
          )}
        </div>
        {mode === "open" && (
          <>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(m.duration))}
              value={Math.floor(m.progress)}
              onChange={(e) => m.seek(Number(e.target.value))}
              disabled={!m.started}
              aria-label="Seek"
              className="range range-dark mt-2 w-full disabled:opacity-50"
            />
            <div className="flex justify-between font-mono text-xs text-panel-muted tabular">
              <span>{fmt(m.progress)}</span>
              <span>{fmt(m.duration)}</span>
            </div>
            {m.failed && (
              <p role="status" className="mt-2 font-mono text-xs text-panel-err">
                The YouTube player couldn&rsquo;t load. Try again in a moment.
              </p>
            )}
            <p className="mt-2 font-mono text-xs text-panel-muted">Streams through YouTube&rsquo;s player.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Header pill (matches the reference) ---------------- */

export function HeaderPlayer({ compact = false }: { compact?: boolean }) {
  const m = useMusic();
  const listBtn = useRef<HTMLButtonElement>(null);
  const discBtn = useRef<HTMLButtonElement>(null);

  const openList = (from: HTMLElement | null) => {
    m.triggerRef.current = from;
    m.setOpen(!m.open);
  };

  return (
    <div className={cn("hp flex items-stretch", compact && "hp-compact")}>
      <button
        type="button"
        onClick={m.toggle}
        aria-label={m.playing ? "Pause" : `Play ${m.track.title}`}
        className="hp-play flex w-12 shrink-0 items-center justify-center bg-vermilion text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep"
      >
        {m.playing ? <Pause aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.5} /> : <PlayIcon aria-hidden className="h-4 w-4 translate-x-px fill-current" strokeWidth={1.5} />}
      </button>

      {compact ? (
        <button
          ref={discBtn}
          type="button"
          onClick={() => openList(discBtn.current)}
          aria-haspopup="dialog"
          aria-expanded={m.open}
          aria-controls="song-list"
          aria-label={`Song list, now ${m.track.title}`}
          className="flex items-center px-1.5"
        >
          <Disc track={m.track} playing={m.playing} />
        </button>
      ) : (
        <>
          <span className="flex min-w-0 items-center gap-2.5 px-2.5">
            <Disc track={m.track} playing={m.playing} />
            <span className="min-w-0">
              <span className="block max-w-[12ch] truncate font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text)]">{m.track.title}</span>
              <span className="hp-artist block max-w-[14ch] truncate font-mono text-[11px] uppercase tracking-[0.12em]">{m.track.artist}</span>
            </span>
          </span>
          <button
            ref={listBtn}
            type="button"
            onClick={() => openList(listBtn.current)}
            aria-haspopup="dialog"
            aria-expanded={m.open}
            aria-controls="song-list"
            aria-label="Open song list"
            className="flex w-11 shrink-0 items-center justify-center text-[var(--text)] transition-colors duration-[var(--dur-2)] hover:text-vermilion-ink"
          >
            <ListMusic aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </>
      )}
    </div>
  );
}

function Disc({ track, playing }: { track: Track; playing: boolean }) {
  return (
    <img
      src={ytThumb(track.youtubeId)}
      alt=""
      width={36}
      height={36}
      data-playing={playing || undefined}
      className="disc h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--text)]"
    />
  );
}
