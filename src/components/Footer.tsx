import { ArrowUpRight } from "lucide-react";
import { NAV_LINKS } from "../lib/data";
import { useIstClock } from "../hooks/useInView";
import { Wordmark } from "./Wordmark";
import { Kicker, StatusDot } from "./ui";

/** Decorative signature, one span per letter for the hover play (aria-hidden). */
const SIGNATURE = Array.from("v3rsi0n.");

const ELSEWHERE = [
  { name: "GitHub", url: "https://github.com/4nx3b" },
  { name: "Telegram", url: "https://t.me/v3rsi0n" },
  { name: "Last.fm", url: "https://www.last.fm/user/zensxin" },
  { name: "AniList", url: "https://anilist.co/user/zensxin/" },
];

export function Footer() {
  const clock = useIstClock();
  return (
    <footer className="relative overflow-hidden border-t border-ink bg-paper">
      <div className="page relative pt-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark spark={false} />
            <p className="mt-5 max-w-[38ch] text-lg text-ink-soft">
              Android root specialist. Custom ROMs, root modules, music players.
            </p>
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-rule-strong px-4 py-2">
              <StatusDot tone="moss" label="Open for collabs" />
              <span aria-hidden className="h-3 w-px bg-rule-strong" />
              <span className="font-mono text-xs text-graphite tabular">IST {clock}</span>
            </div>
          </div>

          <nav aria-label="Site">
            <Kicker>Site</Kicker>
            <ul className="mt-4 flex flex-col">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="inline-flex min-h-11 min-w-11 items-center text-md text-ink-soft transition-colors duration-[var(--dur-2)] hover:text-ink">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Elsewhere">
            <Kicker>Elsewhere</Kicker>
            <ul className="mt-4 flex flex-col">
              {ELSEWHERE.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex min-h-11 items-center gap-1.5 text-md text-ink-soft transition-colors duration-[var(--dur-2)] hover:text-ink"
                  >
                    {l.name}
                    <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-graphite group-hover:text-ink" strokeWidth={1.75} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="relative mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6">
          <span className="font-mono text-xs text-graphite">© 2026 v3rsi0n</span>
          <span className="font-mono text-xs text-graphite">Versioned in public, tested on real hardware.</span>
        </div>
        {/* Giant clipped signature */}
        <p
          aria-hidden
          className="sig mt-12 -mb-[0.24em] select-none whitespace-nowrap font-display leading-[0.8] tracking-[-0.03em]"
          style={{ fontSize: "clamp(80px, 16vw, 240px)" }}
        >
          {SIGNATURE.map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </p>

      </div>
    </footer>
  );
}
