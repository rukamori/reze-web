import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, AudioLines, ListMusic, Pause, Play as PlayIcon, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { cn } from "../utils/cn";
import { TRACKS, type Track } from "../lib/data";

/* ------------------------------------------------------------------ *
 * Audio-only player on SoundCloud's official Widget API.
 * One widget iframe for the whole site, parked off-screen (1×1, not
 * display:none so it initialises). The header pill plays and pauses it
 * directly; the song list is a separate popover. If a browser blocks
 * cross-frame audio, the widget bar is shown for one manual tap.
 * ------------------------------------------------------------------ */

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const trackUrl = (t: Track) => `https://api.soundcloud.com/tracks/${t.scId}`;
const widgetSrc = (t: Track) =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl(t))}` +
  "&auto_play=false&visual=false&show_artwork=false&buying=false&sharing=false&download=false&show_comments=false&show_user=false&show_teaser=false";

let scReady: Promise<void> | null = null;
function loadSC(): Promise<void> {
  if (window.SC?.Widget) return Promise.resolve();
  if (scReady) return scReady;
  scReady = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://w.soundcloud.com/player/api.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scReady = null;
      reject(new Error("SoundCloud widget failed to load"));
    };
    document.head.appendChild(s);
  });
  return scReady;
}

const BLOCKED_MS = 1500;

type MusicCtx = {
  idx: number;
  track: Track;
  playing: boolean;
  ready: boolean;
  failed: boolean;
  needTap: boolean;
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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [vol, setVolState] = useState(72);
  const [open, setOpenState] = useState(false);
  const [mounted, setMounted] = useState(false);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const widget = useRef<any>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const volRef = useRef(vol);
  volRef.current = vol;
  const playingRef = useRef(false);
  const blockTimer = useRef(0);
  const pending = useRef<null | (() => void)>(null);
  const readyRef = useRef(false);
  const userPaused = useRef(false);

  // Load the widget API on idle so it is ready before the first tap
  useEffect(() => {
    const go = () => setMounted(true);
    const w = window as any;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(go, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(go, 1500);
    return () => window.clearTimeout(t);
  }, []);

  const readDuration = useCallback(() => {
    widget.current?.getDuration?.((ms: number) => setDuration((ms || 0) / 1000));
  }, []);

  // After a play tap, if audio still isn't running 1.5s later (blocked, or it
  // started and stopped at once), show the SoundCloud bar for one manual tap.
  const armBlockCheck = useCallback(() => {
    userPaused.current = false;
    window.clearTimeout(blockTimer.current);
    blockTimer.current = window.setTimeout(() => {
      if (!playingRef.current && !userPaused.current) {
        setNeedTap(true);
        setOpenState(true);
      }
    }, BLOCKED_MS);
  }, []);

  // Bind the widget once the iframe and API exist
  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    loadSC()
      .then(() => {
        if (!alive || !frameRef.current) return;
        const SC = window.SC;
        const w = SC.Widget(frameRef.current);
        widget.current = w;
        const E = SC.Widget.Events;
        let lastSec = -1;
        let isReady = false;
        const onReady = () => {
          if (isReady || !alive) return;
          isReady = true;
          readyRef.current = true;
          setReady(true);
          w.setVolume(volRef.current);
          readDuration();
          const run = pending.current;
          pending.current = null;
          run?.();
        };
        w.bind(E.READY, onReady);
        // READY can fire before we bind; any reply from the widget also means ready
        w.getDuration((ms: number) => {
          setDuration((ms || 0) / 1000);
          onReady();
        });
        w.bind(E.PLAY, () => {
          playingRef.current = true;
          setPlaying(true);
          setNeedTap(false);
          readDuration();
        });
        w.bind(E.PAUSE, () => {
          playingRef.current = false;
          setPlaying(false);
        });
        w.bind(E.FINISH, () => {
          playingRef.current = false;
          setPlaying(false);
          loadTrack(idxRef.current + 1, true);
        });
        w.bind(E.PLAY_PROGRESS, (e: { currentPosition: number }) => {
          const s = Math.floor((e.currentPosition || 0) / 1000);
          if (s !== lastSec) {
            lastSec = s;
            setProgress(s);
          }
        });
        w.bind(E.ERROR, () => setFailed(true));
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
      window.clearTimeout(blockTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  function loadTrack(i: number, autoPlay: boolean) {
    const n = (i + TRACKS.length) % TRACKS.length;
    setIdx(n);
    setProgress(0);
    setDuration(0);
    const w = widget.current;
    if (!w) return;
    w.load(trackUrl(TRACKS[n]), {
      auto_play: autoPlay,
      visual: false,
      show_artwork: false,
      show_comments: false,
      show_user: false,
      buying: false,
      sharing: false,
      download: false,
      callback: () => {
        w.setVolume(volRef.current);
        readDuration();
      },
    });
    if (autoPlay) armBlockCheck();
  }

  const whenReady = (fn: () => void) => {
    if (widget.current && readyRef.current) fn();
    else {
      // Not ready yet: run it on READY, and show the manual-tap bar if nothing plays
      pending.current = fn;
      setMounted(true);
      armBlockCheck();
    }
  };

  const toggle = useCallback(() => {
    whenReady(() => {
      if (playingRef.current) {
        userPaused.current = true;
        window.clearTimeout(blockTimer.current);
        widget.current.pause();
      } else {
        widget.current.play();
        armBlockCheck();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, armBlockCheck]);

  const play = useCallback(
    (i: number) => {
      whenReady(() => {
        if (i !== idxRef.current) loadTrack(i, true);
        else if (!playingRef.current) {
          widget.current.play();
          armBlockCheck();
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, armBlockCheck]
  );

  const go = useCallback(
    (n: number) => {
      if (!widget.current) {
        setIdx((n + TRACKS.length) % TRACKS.length);
        return;
      }
      loadTrack(n, true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const seek = useCallback((s: number) => {
    setProgress(s);
    widget.current?.seekTo?.(s * 1000);
  }, []);

  const setVol = useCallback((v: number) => {
    setVolState(v);
    widget.current?.setVolume?.(v);
  }, []);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    if (!v) {
      setNeedTap(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const value = useMemo<MusicCtx>(
    () => ({
      idx, track: TRACKS[idx], playing, ready, failed, needTap, progress, duration, vol, open,
      setOpen, toggle, play, go, seek, setVol, triggerRef,
    }),
    [idx, playing, ready, failed, needTap, progress, duration, vol, open, setOpen, toggle, play, go, seek, setVol]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(
        <>
          {mounted && (
            <iframe
              ref={frameRef}
              title="SoundCloud audio player"
              aria-hidden={needTap ? undefined : true}
              tabIndex={needTap ? 0 : -1}
              allow="autoplay; encrypted-media"
              src={widgetSrc(TRACKS[0])}
              className={cn("sc-frame", needTap && "sc-frame-visible")}
            />
          )}
          {open && <SongPanel />}
        </>,
        document.body
      )}
    </Ctx.Provider>
  );
}

/* ---------------- Song list popover ---------------- */

function SongPanel() {
  const m = useMusic();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("button")?.focus();
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
      if (panel?.contains(t) || (t as Element).closest?.(".hp, .sc-frame")) return;
      m.setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={panelRef} id="song-list" role="dialog" aria-modal="true" aria-label="Song list" className="song-panel bg-panel text-panel-text" data-mode="open">
      <div className="flex items-center justify-between gap-3 border-b border-panel-rule px-4 py-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-vermilion">
          Music archive · {String(TRACKS.length).padStart(2, "0")}
        </p>
        <button
          type="button"
          onClick={() => m.setOpen(false)}
          aria-label="Close song list"
          className="flex h-11 w-11 items-center justify-center rounded-full text-panel-text-2 transition-colors duration-[var(--dur-2)] hover:bg-[#f3efe614] hover:text-panel-text"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      {m.needTap && (
        <p role="status" className="border-b border-panel-rule bg-[#ff4a1c1a] px-4 py-3 text-sm text-panel-text">
          Your browser needs one more tap: press play in the SoundCloud bar at the bottom of the screen.
        </p>
      )}

      <ol>
        {TRACKS.map((t, i) => {
          const on = i === m.idx;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => (on ? m.toggle() : m.play(i))}
                aria-current={on ? "true" : undefined}
                aria-label={on && m.playing ? `Pause ${t.title}` : `Play ${t.title} by ${t.artist}`}
                className={cn(
                  "flex min-h-[76px] w-full items-center gap-4 border-b border-panel-rule px-4 py-3 text-left transition-colors duration-[var(--dur-2)]",
                  on ? "bg-[#f3efe60f]" : "hover:bg-[#f3efe60a]"
                )}
              >
                <img
                  src={t.artwork}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  data-playing={on && m.playing ? "" : undefined}
                  className="disc h-12 w-12 shrink-0 rounded-full bg-panel-3 object-cover ring-1 ring-panel-rule"
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

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-2">
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
          <label className="ml-auto flex items-center gap-2">
            <Volume2 aria-hidden className="h-4 w-4 text-panel-muted" strokeWidth={1.75} />
            <span className="sr-only">Volume</span>
            <input type="range" min={0} max={100} value={m.vol} onChange={(e) => m.setVol(Number(e.target.value))} className="range range-dark w-24" />
          </label>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(m.duration))}
          value={Math.min(Math.floor(m.progress), Math.max(1, Math.floor(m.duration)))}
          onChange={(e) => m.seek(Number(e.target.value))}
          disabled={!m.duration}
          aria-label="Seek"
          className="range range-dark mt-2 w-full disabled:opacity-50"
        />
        <div className="flex justify-between font-mono text-xs text-panel-muted tabular">
          <span>{fmt(m.progress)}</span>
          <span>{fmt(m.duration)}</span>
        </div>
        {m.failed && (
          <p role="status" className="mt-2 font-mono text-xs text-panel-err">
            SoundCloud couldn&rsquo;t load right now. Try again in a moment.
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 font-mono text-xs text-panel-muted">
          Audio via SoundCloud ·
          <a
            href={m.track.permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-6 items-center gap-1 text-panel-text-2 underline decoration-panel-rule underline-offset-4 hover:text-panel-text"
          >
            open track
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
        </p>
      </div>
    </div>
  );
}

/* ---------------- Header pill (matches the reference) ---------------- */

export function HeaderPlayer({ compact = false }: { compact?: boolean }) {
  const m = useMusic();
  const listBtn = useRef<HTMLButtonElement>(null);

  const openList = () => {
    m.triggerRef.current = listBtn.current;
    m.setOpen(!m.open);
  };

  return (
    <div className={cn("hp flex items-stretch", compact && "hp-compact")}>
      <button
        type="button"
        onClick={m.toggle}
        aria-label={m.playing ? `Pause ${m.track.title}` : `Play ${m.track.title} by ${m.track.artist}`}
        className="hp-play flex w-12 shrink-0 items-center justify-center bg-vermilion text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep"
      >
        {m.playing ? <Pause aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.5} /> : <PlayIcon aria-hidden className="h-4 w-4 translate-x-px fill-current" strokeWidth={1.5} />}
      </button>

      <span className={cn("hp-mid flex min-w-0 items-center gap-2.5", compact ? "px-1.5" : "px-2.5")}>
        <Disc track={m.track} playing={m.playing} />
        {!compact && (
          <span className="min-w-0">
            <span className="block max-w-[12ch] truncate font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text)]">{m.track.title}</span>
            <span className="hp-artist block max-w-[14ch] truncate font-mono text-[11px] uppercase tracking-[0.12em]">{m.track.artist}</span>
          </span>
        )}
      </span>

      <button
        ref={listBtn}
        type="button"
        onClick={openList}
        aria-haspopup="dialog"
        aria-expanded={m.open}
        aria-controls="song-list"
        aria-label="Open song list"
        className="flex w-11 shrink-0 items-center justify-center border-l border-[var(--text)] text-[var(--text)] transition-colors duration-[var(--dur-2)] hover:text-vermilion-ink"
      >
        <ListMusic aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function Disc({ track, playing }: { track: Track; playing: boolean }) {
  return (
    <img
      src={track.artwork}
      alt=""
      width={36}
      height={36}
      data-playing={playing || undefined}
      className="disc h-9 w-9 shrink-0 rounded-full bg-paper-deep object-cover ring-1 ring-[var(--text)]"
    />
  );
}
