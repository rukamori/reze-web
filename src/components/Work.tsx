import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Download, GitFork, LifeBuoy, Lightbulb, Star, TriangleAlert } from "lucide-react";
import { cn } from "../utils/cn";
import { APP, ROM_POST } from "../lib/data";
import { ago, useGithubRepo } from "../hooks/useGithubRepo";
import { Reveal } from "./Reveal";
import { SpinBadge } from "./AnimeFx";
import { Button, Kicker, SectionHead } from "./ui";

/* ---------------- ROM post ---------------- */

function RomPost() {
  const p = ROM_POST;
  const links = p.links.filter((l) => l.url.trim() !== "");
  const [primary, ...rest] = [...links.filter((l) => l.primary), ...links.filter((l) => !l.primary)];

  return (
    <Reveal
      as="article"
      aria-labelledby="rom-title"
      className="mt-14 overflow-hidden rounded-[var(--radius-xl)] border border-panel-rule bg-panel-2"
    >
      <img
        src={p.thumbnail}
        width={p.thumbnailWidth}
        height={p.thumbnailHeight}
        alt={p.thumbnailAlt}
        loading="lazy"
        decoding="async"
        className="block aspect-video h-auto w-full bg-panel-3 object-cover"
      />

      <div className="grid gap-10 p-5 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14 lg:p-10">
        {/* Meta + links */}
        <div>
          <h3 id="rom-title" className="font-display text-page font-normal text-panel-text">
            {p.title}
          </h3>
          <p className="mt-2 font-mono text-sm text-panel-text-2">
            {p.codename} · {p.variant}
          </p>

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-y border-panel-rule py-4 font-mono text-sm">
            <dt className="text-panel-muted">Released</dt>
            <dd className="text-panel-text">
              <time dateTime={p.date}>{p.dateLabel}</time>
            </dd>
            <dt className="text-panel-muted">Maintainer</dt>
            <dd>
              <a
                href={p.maintainerUrl}
                target="_blank"
                rel="noreferrer"
                className="-my-3 inline-flex min-h-11 items-center text-panel-text underline decoration-panel-rule underline-offset-4 transition-colors duration-[var(--dur-2)] hover:decoration-panel-text"
              >
                {p.maintainer}
              </a>
            </dd>
          </dl>

          <div className="mt-6 flex flex-col gap-3">
            {primary && (
              <Button href={primary.url} target="_blank" rel="noreferrer" variant="accent" className="w-full">
                <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                {primary.label}
              </Button>
            )}
            {rest.map((l) => (
              <Button
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                variant="outline"
                className="w-full hover:bg-[#f3efe614]"
              >
                {l.label === "Support" ? (
                  <LifeBuoy aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                )}
                {l.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Changelog, tip, notes, warning */}
        <div className="flex flex-col gap-8">
          <section aria-labelledby="rom-changelog">
            <Kicker>
              <span id="rom-changelog">Changelog</span>
            </Kicker>
            <ol className="mt-3 border-t border-panel-rule">
              {p.changelog.map((c, i) => (
                <li key={c} className="flex gap-4 border-b border-panel-rule py-3 text-[16px] leading-[1.6] text-panel-text">
                  <span aria-hidden className="w-6 shrink-0 pt-0.5 font-mono text-xs text-panel-muted tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex gap-3 rounded-[var(--radius-md)] border border-panel-rule bg-panel-3 p-4">
            <Lightbulb aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-panel-ok" strokeWidth={1.75} />
            <p className="text-[16px] leading-[1.6] text-panel-text-2">
              <strong className="font-semibold text-panel-text">Tip:</strong> {p.tip}
            </p>
          </div>

          <section aria-labelledby="rom-notes">
            <Kicker>
              <span id="rom-notes">Notes</span>
            </Kicker>
            <p className="mt-3 text-[16px] font-semibold leading-[1.6] text-panel-text">{p.notesLead}</p>
            <ul className="mt-3 flex flex-col gap-3">
              {p.notes.map((n) => (
                <li key={n} className="flex gap-3 text-[16px] leading-[1.6] text-panel-text-2">
                  <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-panel-muted" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </section>

          <div role="note" className="flex gap-3 rounded-[var(--radius-md)] bg-[var(--warn-bg)] p-4 text-[var(--warn-fg)]">
            <TriangleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
            <p className="text-[16px] leading-[1.6]">
              <strong className="font-semibold">Warning:</strong> {p.warning}
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ---------------- ArchiveTune with live stars ---------------- */

/** A number that rises 6px when it changes. */
function LiveNumber({ value }: { value: number | null }) {
  return (
    <span key={value ?? "none"} className="m-rise inline-block tabular" style={{ ["--rise-y" as string]: "6px", ["--m-dur" as string]: "var(--dur-3)" }}>
      {value === null ? "—" : value.toLocaleString("en-US")}
    </span>
  );
}

function AppCard() {
  const ref = useRef<HTMLDivElement>(null);
  const { stats, checkedAt } = useGithubRepo(APP.repo, ref);
  // "updated Xs ago" ticks with the 1s clock-free approach: re-render every 10s only while mounted
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);
  const lastCheck = checkedAt ?? stats?.ts ?? null;

  return (
    <Reveal className="mt-10">
      <div ref={ref} className="grid gap-8 rounded-[var(--radius-xl)] border border-panel-rule p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-panel-err">
            {APP.name} <span className="text-panel-muted">· {APP.sector}</span>
          </p>
          <h3 className="mt-3 font-display text-page font-normal text-panel-text">{APP.title}</h3>
          <p className="mt-4 text-lg text-panel-text-2">{APP.desc}</p>
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {APP.tags.map((t) => (
              <li key={t} className="rounded-full border border-panel-rule px-2.5 py-1 font-mono text-xs text-panel-text-2">
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-between gap-6">
          <dl aria-live="polite" className="grid grid-cols-2 divide-x divide-panel-rule border-y border-panel-rule">
            <div className="flex flex-col-reverse py-4 pr-4">
              <dt className="mt-1 flex items-center gap-1.5 font-mono text-xs text-panel-muted">
                <Star aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> stars on GitHub
              </dt>
              <dd className="font-mono text-[clamp(36px,2.4vw+20px,52px)] leading-none text-panel-text">
                <LiveNumber value={stats?.stars ?? null} />
              </dd>
            </div>
            <div className="flex flex-col-reverse py-4 pl-4">
              <dt className="mt-1 flex items-center gap-1.5 font-mono text-xs text-panel-muted">
                <GitFork aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> forks
              </dt>
              <dd className="font-mono text-[clamp(36px,2.4vw+20px,52px)] leading-none text-panel-text">
                <LiveNumber value={stats?.forks ?? null} />
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-mono text-xs text-panel-muted">
              {lastCheck ? (
                <>
                  <span aria-hidden className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", checkedAt ? "bg-panel-ok" : "bg-panel-muted")} />
                  live · checked {ago(Date.now() - lastCheck)}
                </>
              ) : (
                "loading from api.github.com…"
              )}
            </p>
            <a
              href={APP.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-panel-text underline decoration-panel-rule underline-offset-4 transition-colors duration-[var(--dur-2)] hover:decoration-panel-text"
            >
              {APP.linkLabel}
              <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function Work() {
  return (
    <section id="work" aria-labelledby="work-title" className="panel-scope">
      <div className="page relative py-24 lg:py-32">
        <SpinBadge className="top-20 right-[var(--gutter)] hidden md:block lg:top-24" />
        <SectionHead
          num="01"
          label="Work"
          title={
            <span id="work-title">
              One ROM, one app,
              <br />
              both <em className="ital">shipped</em>.
            </span>
          }
        />
        <RomPost />
        <AppCard />
      </div>
    </section>
  );
}
