import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AudioLines, ListMusic, Pause, Play as PlayIcon, X } from "lucide-react";
import { cn } from "../utils/cn";
import { TRACKS, audioSrc, audioSrcFallback, type Track } from "../lib/data";

/* ------------------------------------------------------------------ *
 * One <audio> element for the whole site, streaming the mp3s that live
 * in /music on main (jsDelivr, with raw.githubusercontent as fallback).
 * The header pill plays and pauses directly; the popover is a compact
 * pause/resume + 3-row track list.
 * ------------------------------------------------------------------ */

type MusicCtx = {
  idx: number;
  track: Track;
  playing: boolean;
  failed: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  play: (i: number) => void;
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
  const [failed, setFailed] = useState(false);
  const [open, setOpenState] = useState(false);

  const audio = useRef<HTMLAudioElement | null>(null);
  const triedRaw = useRef(false);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const triggerRef = useRef<HTMLElement | null>(null);

  /** Created on the first user gesture, so mobile allows playback. */
  const getAudio = useCallback(() => {
    if (audio.current) return audio.current;
    const el = new Audio();
    el.preload = "none";
    el.crossOrigin = "anonymous";
    audio.current = el;

    el.addEventListener("play", () => setPlaying(true));
    el.addEventListener("playing", () => {
      setPlaying(true);
      setFailed(false);
    });
    el.addEventListener("pause", () => setPlaying(false));
    el.addEventListener("ended", () => {
      const next = (idxRef.current + 1) % TRACKS.length;
      load(next, true);
    });
    el.addEventListener("error", () => {
      // One retry from raw.githubusercontent, then give up quietly
      if (!triedRaw.current) {
        triedRaw.current = true;
        el.src = audioSrcFallback(TRACKS[idxRef.current].file);
        el.play().catch(() => setFailed(true));
      } else {
        setPlaying(false);
        setFailed(true);
      }
    });
    return el;
  }, []);

  const load = useCallback(
    (i: number, autoPlay: boolean) => {
      const n = (i + TRACKS.length) % TRACKS.length;
      setIdx(n);
      triedRaw.current = false;
      const el = getAudio();
      el.src = audioSrc(TRACKS[n].file);
      if (autoPlay) el.play().catch(() => setFailed(true));
    },
    [getAudio]
  );

  const toggle = useCallback(() => {
    const el = getAudio();
    if (!el.src) return load(idxRef.current, true);
    if (el.paused) el.play().catch(() => setFailed(true));
    else el.pause();
  }, [getAudio, load]);

  const play = useCallback(
    (i: number) => {
      const el = getAudio();
      if (i !== idxRef.current || !el.src) return load(i, true);
      if (el.paused) el.play().catch(() => setFailed(true));
      else el.pause();
    },
    [getAudio, load]
  );

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    if (!v) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  /** Lock-screen / OS media controls. */
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms || !("MediaMetadata" in window)) return;
    const t = TRACKS[idx];
    ms.metadata = new window.MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: "v3rsi0n · music archive",
      artwork: [{ src: t.artwork, sizes: "500x500", type: "image/jpeg" }],
    });
    ms.playbackState = playing ? "playing" : "paused";
    const set = (action: MediaSessionAction, fn: () => void) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    };
    set("play", () => toggle());
    set("pause", () => toggle());
    set("previoustrack", () => load(idxRef.current - 1, true));
    set("nexttrack", () => load(idxRef.current + 1, true));
  }, [idx, playing, toggle, load]);

  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    []
  );

  const value = useMemo<MusicCtx>(
    () => ({ idx, track: TRACKS[idx], playing, failed, open, setOpen, toggle, play, triggerRef }),
    [idx, playing, failed, open, setOpen, toggle, play]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {open && createPortal(<SongPanel />, document.body)}
    </Ctx.Provider>
  );
}

/* ---------------- Compact song list ---------------- */

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
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>("button"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (panel?.contains(t) || t.closest?.(".hp")) return;
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
    <div ref={panelRef} id="song-list" role="dialog" aria-modal="true" aria-label="Song list" className="song-panel bg-panel text-panel-text">
      {/* Pause / resume + what is playing */}
      <div className="flex items-center gap-3 border-b border-panel-rule p-3">
        <button
          type="button"
          onClick={m.toggle}
          aria-label={m.playing ? `Pause ${m.track.title}` : `Play ${m.track.title}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vermilion text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep"
        >
          {m.playing ? (
            <Pause aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.5} />
          ) : (
            <PlayIcon aria-hidden className="h-4 w-4 translate-x-px fill-current" strokeWidth={1.5} />
          )}
        </button>
        <p className="min-w-0 flex-1">
          <span className="block truncate font-mono text-xs font-semibold uppercase tracking-[0.06em]">{m.track.title}</span>
          <span className="block truncate font-mono text-[11px] uppercase tracking-[0.12em] text-panel-err">{m.track.artist}</span>
        </p>
        <button
          type="button"
          onClick={() => m.setOpen(false)}
          aria-label="Close song list"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-panel-text-2 transition-colors duration-[var(--dur-2)] hover:bg-[#f3efe614] hover:text-panel-text"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <ol>
        {TRACKS.map((t, i) => {
          const on = i === m.idx;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => m.play(i)}
                aria-current={on ? "true" : undefined}
                aria-label={on && m.playing ? `Pause ${t.title}` : `Play ${t.title} by ${t.artist}`}
                className={cn(
                  "flex min-h-[56px] w-full items-center gap-3 border-b border-panel-rule px-3 py-2 text-left transition-colors duration-[var(--dur-2)] last:border-b-0",
                  on ? "bg-[#f3efe60f]" : "hover:bg-[#f3efe60a]"
                )}
              >
                <img
                  src={t.artwork}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  decoding="async"
                  data-playing={on && m.playing ? "" : undefined}
                  className="disc h-10 w-10 shrink-0 rounded-full bg-panel-3 object-cover ring-1 ring-panel-rule"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs font-semibold uppercase tracking-[0.04em]">{t.title}</span>
                  <span className="block truncate font-mono text-[11px] uppercase tracking-[0.12em] text-panel-err">{t.artist}</span>
                </span>
                {on && m.playing && <AudioLines aria-hidden className="sp-bars h-5 w-5 shrink-0 text-panel-err" strokeWidth={1.75} />}
              </button>
            </li>
          );
        })}
      </ol>

      {m.failed && (
        <p role="status" className="border-t border-panel-rule px-3 py-2 font-mono text-[11px] text-panel-err">
          Couldn&rsquo;t load that track. Try again in a moment.
        </p>
      )}
    </div>
  );
}

/* ---------------- Header pill ---------------- */

export function HeaderPlayer({ compact = false }: { compact?: boolean }) {
  const m = useMusic();
  const listBtn = useRef<HTMLButtonElement>(null);

  return (
    <div className={cn("hp flex items-stretch", compact && "hp-compact")}>
      <button
        type="button"
        onClick={m.toggle}
        aria-label={m.playing ? `Pause ${m.track.title}` : `Play ${m.track.title} by ${m.track.artist}`}
        className="hp-play flex w-12 shrink-0 items-center justify-center bg-vermilion text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep"
      >
        {m.playing ? (
          <Pause aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.5} />
        ) : (
          <PlayIcon aria-hidden className="h-4 w-4 translate-x-px fill-current" strokeWidth={1.5} />
        )}
      </button>

      <span className={cn("hp-mid flex min-w-0 items-center gap-2.5", compact ? "px-1.5" : "px-2.5")}>
        <img
          src={m.track.artwork}
          alt=""
          width={36}
          height={36}
          decoding="async"
          data-playing={m.playing || undefined}
          className="disc h-9 w-9 shrink-0 rounded-full bg-paper-deep object-cover ring-1 ring-[var(--text)]"
        />
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
        onClick={() => {
          m.triggerRef.current = listBtn.current;
          m.setOpen(!m.open);
        }}
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
