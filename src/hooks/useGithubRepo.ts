import { useEffect, useRef, useState, type RefObject } from "react";

export type RepoStats = { stars: number; forks: number; pushed_at: string; etag: string; ts: number };

const POLL_MS = 30_000;
const BACKOFF_MS = 10 * 60_000;
const cacheKey = (repo: string) => `gh_repo_${repo.replace("/", "_")}_v1`;

function readCache(repo: string): RepoStats | null {
  try {
    const v = localStorage.getItem(cacheKey(repo));
    return v ? (JSON.parse(v) as RepoStats) : null;
  } catch {
    return null;
  }
}
function writeCache(repo: string, v: RepoStats) {
  try {
    localStorage.setItem(cacheKey(repo), JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

/**
 * Live GitHub repo stats. Renders the cached value first, then polls every 30s
 * with If-None-Match (a 304 does not count against the 60/h anonymous limit).
 * Polls only while the page is visible and `ref` is on screen; 403/429 backs off 10 min.
 */
export function useGithubRepo(repo: string, ref: RefObject<Element | null>) {
  const [stats, setStats] = useState<RepoStats | null>(() => readCache(repo));
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    const el = ref.current;
    let timer = 0;
    let inView = false;
    let nextDelay = 0; // first check right away once visible
    let inflight: AbortController | null = null;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, ms);
    };
    const canPoll = () => inView && document.visibilityState === "visible";

    async function tick() {
      if (!canPoll()) return; // resumes on visibility / intersection
      inflight?.abort();
      inflight = new AbortController();
      const prev = statsRef.current;
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: { Accept: "application/vnd.github+json", ...(prev?.etag ? { "If-None-Match": prev.etag } : {}) },
          signal: inflight.signal,
        });
        if (res.status === 304 && prev) {
          setCheckedAt(Date.now());
          nextDelay = POLL_MS;
        } else if (res.ok) {
          const d = await res.json();
          const next: RepoStats = {
            stars: Number(d.stargazers_count ?? 0),
            forks: Number(d.forks_count ?? 0),
            pushed_at: String(d.pushed_at ?? ""),
            etag: res.headers.get("ETag") ?? "",
            ts: Date.now(),
          };
          writeCache(repo, next);
          setStats(next);
          setCheckedAt(Date.now());
          nextDelay = POLL_MS;
        } else if (res.status === 403 || res.status === 429) {
          nextDelay = BACKOFF_MS;
        } else {
          nextDelay = POLL_MS;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        nextDelay = POLL_MS;
      }
      if (canPoll()) schedule(nextDelay);
    }

    const resume = () => {
      if (canPoll()) schedule(nextDelay);
      else window.clearTimeout(timer);
    };

    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        resume();
      });
      io.observe(el);
    } else {
      inView = true;
      resume();
    }
    document.addEventListener("visibilitychange", resume);

    return () => {
      window.clearTimeout(timer);
      inflight?.abort();
      io?.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [repo, ref]);

  return { stats, checkedAt };
}

/** "12s ago" / "4m ago" / "3h ago" / "2d ago" */
export function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
