import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "../utils/cn";
import { ABOUT, ANIME, MUSIC } from "../lib/data";
import { PlaylistShelf, TrackPlayer } from "./Music";
import { Play } from "./Play";
import { Reveal } from "./Reveal";
import { Kicker, SectionHead } from "./ui";

/* ---------- Use-case panel layout ---------- */

function UseCase({
  title,
  prompt,
  checks,
  get,
  link,
  aside,
}: {
  title: string;
  prompt: string;
  checks: ReactNode[];
  get: string;
  link?: { href: string; label: string };
  aside?: ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        <h3 className="font-display text-page font-normal text-ink">{title}</h3>
        <div className="mt-6 rounded-[var(--radius-md)] border border-rule-strong bg-card p-4">
          <Kicker>Example</Kicker>
          <p className="mt-2 font-mono text-md text-ink">
            <span aria-hidden className="mr-2 text-vermilion-ink">›</span>
            {prompt}
          </p>
        </div>
        <ul className="mt-6 flex flex-col gap-3">
          {checks.map((c, i) => (
            <li key={i} className="flex gap-3 text-lg text-ink-soft">
              <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-moss-ink" strokeWidth={2} />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ink pt-4">
          <div>
            <Kicker>You get</Kicker>
            <p className="mt-1 text-sm text-ink-soft">{get}</p>
          </div>
          {link && (
            <a
              href={link.href}
              target={link.href.startsWith("#") ? undefined : "_blank"}
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink underline decoration-rule-strong underline-offset-4 transition-colors duration-[var(--dur-2)] hover:decoration-ink"
            >
              {link.label}
              <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </a>
          )}
        </div>
      </div>
      {aside && <div>{aside}</div>}
    </div>
  );
}

function AnimeStats() {
  const rows = [
    { v: ANIME.count.toLocaleString("en-US"), l: "titles completed" },
    { v: ANIME.episodes.toLocaleString("en-US"), l: "episodes logged" },
    { v: ANIME.minutes.toLocaleString("en-US"), l: "minutes watched" },
    { v: ANIME.mean.toFixed(1), l: "mean score" },
  ];
  return (
    <dl className="grid grid-cols-2 border-t border-ink">
      {rows.map((r, i) => (
        <div key={r.l} className={cn("flex flex-col-reverse border-b border-rule py-5", i % 2 === 1 && "border-l pl-5")}>
          <dt className="mt-1 font-mono text-xs text-graphite">{r.l}</dt>
          <dd className="font-display text-page text-ink tabular">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function MeTab() {
  const f = ABOUT.facts;
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
      <div>
        <h3 className="font-display text-page font-normal text-ink">The short version.</h3>
        <p className="mt-4 font-mono text-md text-ink-soft">
          {f.age} <span aria-hidden className="text-graphite">·</span> {f.gender}{" "}
          <span aria-hidden className="text-graphite">·</span>{" "}
          <span role="img" aria-label={f.country}>
            {f.flag}
          </span>
        </p>
        <p className="mt-3 max-w-[48ch] text-lg text-ink-soft">{f.line}</p>

        <h4 className="mt-10 font-mono text-xs uppercase tracking-[0.14em] text-graphite">Into</h4>
        <ul className="mt-3 border-t border-rule">
          {ABOUT.interests.map((it) => (
            <li key={it.title} className="border-b border-rule py-4">
              <p className="text-lg font-semibold text-ink">{it.title}</p>
              <p className="mt-1 text-md text-ink-soft">{it.desc}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="font-mono text-xs uppercase tracking-[0.14em] text-graphite">Devices</h4>
        <table className="mt-3 w-full border-t border-ink text-left">
          <thead className="sr-only sm:not-sr-only">
            <tr className="border-b border-rule font-mono text-xs uppercase tracking-[0.12em] text-graphite">
              <th scope="col" className="py-3 pr-4 font-normal">Role</th>
              <th scope="col" className="py-3 pr-4 font-normal">Device</th>
              <th scope="col" className="py-3 font-normal">Detail</th>
            </tr>
          </thead>
          <tbody>
            {ABOUT.devices.map((d) => (
              <tr key={d.role} className="flex flex-col gap-1 border-b border-rule py-4 sm:table-row sm:py-0">
                <th scope="row" className="font-mono text-xs font-normal uppercase tracking-[0.12em] text-vermilion-ink sm:py-4 sm:pr-4 sm:align-top">
                  {d.role}
                </th>
                <td className="text-lg font-medium text-ink sm:py-4 sm:pr-4 sm:align-top">{d.device}</td>
                <td className="text-md text-ink-soft sm:py-4 sm:align-top">
                  <span className="font-mono text-sm">{d.detail}</span>
                  {d.aside && <span className="block text-sm italic text-graphite">({d.aside})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4 className="mt-10 font-mono text-xs uppercase tracking-[0.14em] text-graphite">Games · {ABOUT.gamesLead}</h4>
        <ol className="mt-3 border-t border-ink">
          {ABOUT.games.map((g, i) => (
            <li key={g} className="flex items-baseline gap-4 border-b border-rule py-3">
              <span className="w-6 shrink-0 font-mono text-xs text-graphite tabular">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-lg text-ink">{g}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const TABS = [
  {
    id: "me",
    label: "Me",
    render: () => <MeTab />,
  },
  {
    id: "anime",
    label: "Anime",
    render: () => (
      <UseCase
        title="Logged on AniList."
        prompt={`anilist stats --user ${ANIME.handle}`}
        checks={[`${ANIME.count} titles completed.`, `${ANIME.episodes.toLocaleString("en-US")} episodes logged.`, `Mean score ${ANIME.mean.toFixed(1)}.`]}
        get="The full watch list, scored."
        link={{ href: ANIME.url, label: `${ANIME.handle} on AniList` }}
        aside={<AnimeStats />}
      />
    ),
  },
  {
    id: "music",
    label: "Music",
    render: () => (
      <div className="flex flex-col gap-12">
        <section aria-label="My YouTube Music playlists">
          <Kicker className="text-ink-soft">My YouTube Music playlists</Kicker>
          <div className="mt-4">
            <PlaylistShelf />
          </div>
        </section>
        <UseCase
          title="Mostly J-pop and EDM."
          prompt={`last.fm now --user ${MUSIC.handle}`}
          checks={[
            ABOUT.interests[2].desc,
            "Five playlists: Japanese, English, Hindi, Phonk and a mix.",
            "Scrobbled on Last.fm.",
          ]}
          get="Scrobbles, top artists, the lot."
          link={{ href: MUSIC.url, label: `${MUSIC.handle} on Last.fm` }}
          aside={<TrackPlayer />}
        />
      </div>
    ),
  },
  {
    id: "play",
    label: "Play",
    render: () => (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <h3 className="font-display text-page font-normal text-ink">The playground.</h3>
          <p className="mt-4 max-w-[48ch] text-lg text-ink-soft">
            Four canvas games in a modal, nothing at stake. High scores stay in your browser. Escape closes any of them.
          </p>
        </div>
        <Play />
      </div>
    ),
  },
] as const;

/** Hashes that select a tab: #about → Me, #play → Play, #now-tab-<id> → that tab. */
const HASH_TAB: Record<string, string> = { "#about": "me", "#play": "play" };

export function Now() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const go = (i: number) => {
    const n = (i + TABS.length) % TABS.length;
    setActive(n);
    tabs.current[n]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(TABS.length - 1); }
  };

  // "#now-tab-play" links switch to the Play tab
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash;
      const i = TABS.findIndex((t) => `#now-tab-${t.id}` === h || HASH_TAB[h] === t.id);
      if (i >= 0) setActive(i);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const tab = TABS[active];

  return (
    <section id="about" aria-labelledby="now-title" className="page relative py-24 lg:py-32">
      <span id="play" aria-hidden className="absolute top-0" />
      <SectionHead
        num="02"
        label="About"
        title={
          <span id="now-title">
            The person behind
            <br />
            the <em className="ital">builds</em>.
          </span>
        }
      />

      <Reveal delay={80} className="mt-12">
        <div role="tablist" aria-label="Interests" onKeyDown={onKey} className="grid grid-cols-2 gap-x-4 border-b border-rule min-[360px]:flex min-[360px]:gap-x-4 sm:gap-x-8">
          {TABS.map((t, i) => {
            const on = i === active;
            return (
              <button
                key={t.id}
                ref={(el) => { tabs.current[i] = el; }}
                id={`now-tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`now-panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  "relative flex min-h-12 shrink-0 items-baseline gap-2.5 pb-3 pt-2 text-[17px] transition-colors duration-[var(--dur-2)]",
                  on ? "text-ink" : "text-ink-soft hover:text-ink"
                )}
              >
                <span className={cn("font-mono text-xs tabular", on ? "text-vermilion-ink" : "text-graphite")}>{String(i + 1).padStart(2, "0")}</span>
                <span className={on ? "font-medium" : ""}>{t.label}</span>
                {on && <span aria-hidden className="m-grow-x absolute inset-x-0 -bottom-px h-0.5 bg-ink" />}
              </button>
            );
          })}
        </div>

        <div
          key={tab.id}
          id={`now-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`now-tab-${tab.id}`}
          tabIndex={0}
          className="m-swap rounded-[var(--radius-sm)] pt-10"
        >
          {tab.render()}
        </div>
      </Reveal>
    </section>
  );
}
