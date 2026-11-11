import { useCallback, useRef, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { HERO, type PartitionKey } from "../lib/data";
import { usePointerVars } from "../hooks/usePointerVars";
import { useScrollVar } from "../hooks/useScrollVar";
import { FigPhone, type FigPhoneHandle } from "./FigPhone";
import { PartitionBench } from "./HeroBench";
import { SakuraField, SpeedLines } from "./AnimeFx";
import { Button, Figure, Pill, StatusDot } from "./ui";

/** Portrait art (user-supplied), resized to webp in public/art. */
const PORTRAIT = {
  src900: "art/hero-portrait-900.webp",
  src1400: "art/hero-portrait-1400.webp",
  width: 900,
  height: 1377,
  alt: "Anime illustration: a blue-haired bassist sitting on a laundromat bench beside her bass",
};

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hero-card overflow-hidden rounded-[var(--radius-xs)] border border-ink bg-paper">
      <p className="bg-ink px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-paper">{label}</p>
      <div className="px-3 py-3 text-md text-ink">{children}</div>
    </div>
  );
}

export function Hero() {
  const [active, setActive] = useState<PartitionKey | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [flashed, setFlashed] = useState(false);

  const heroRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const phone = useRef<FigPhoneHandle>(null);

  // Scroll clock: portrait drifts up, the name drifts down, petals rush past
  useScrollVar(heroRef);
  useScrollVar(nameRef);
  useScrollVar(portraitRef);
  // FIG. 1 depth parallax (pointer) — writes --px/--py, no re-renders
  usePointerVars(figRef);

  const pick = useCallback((k: PartitionKey) => {
    setActive(k);
    setFlashed(false);
  }, []);

  const flash = async () => {
    if (flashing) return;
    setFlashing(true);
    setFlashed(false);
    await phone.current?.flash();
    setFlashing(false);
    setFlashed(true);
    setActive("boot");
  };

  const sentence = `${HERO.lines.join(" ")} ${HERO.emphasis}.`;

  return (
    <>
      <section id="top" ref={heroRef} aria-labelledby="hero-title" className="hero relative overflow-x-clip">
        <div
          aria-hidden
          className="grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,#000_30%,transparent_80%)]"
        />
        <SakuraField />

        <div className="page relative grid grid-cols-1 gap-x-6 pt-10 pb-16 lg:grid-cols-12 lg:pt-12 lg:pb-24">
          {/* Name block: sits behind the portrait */}
          <div ref={nameRef} className="hero-name relative z-0 lg:col-span-8 lg:col-start-1 lg:row-start-1">
            <div className="m-rise flex flex-wrap items-center gap-x-5 gap-y-3 lg:max-w-[52%]" style={{ ["--rise-y" as string]: "10px" }}>
              <p className="flex items-center gap-3 font-mono text-micro uppercase tracking-[0.18em]">
                <span className="shrink-0 whitespace-nowrap text-vermilion-ink">§ 00</span>
                <span aria-hidden className="h-px w-8 bg-rule-strong" />
                <span className="text-graphite">{HERO.kicker}</span>
              </p>
              <Pill badge="New" className="m-float">
                {HERO.pill}
              </Pill>
            </div>
            <p aria-hidden className="hero-wordmark mt-4 select-none font-display text-ink">
              {Array.from("V3RSI0N").map((ch, i) => (
                <span key={i} className="m-focus inline-block" style={{ ["--i" as string]: i, ["--rise-y" as string]: "30px", ["--m-dur" as string]: "var(--dur-hero)" }}>
                  {ch}
                </span>
              ))}
            </p>
          </div>

          {/* Portrait: overlaps the name (miuka.moe-style key visual) */}
          <div
            ref={portraitRef}
            className="hero-portrait-wrap relative z-10 mx-auto -mt-3 w-[84%] max-w-[300px] sm:max-w-[340px] lg:col-span-4 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:mt-6 lg:max-w-none lg:self-start"
          >
            <SpeedLines />
            <div className="hero-portrait">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${PORTRAIT.src900} 900w, ${PORTRAIT.src1400} 1400w`}
                  sizes="(min-width: 1024px) 34vw, 80vw"
                />
                <img
                  src={PORTRAIT.src900}
                  width={PORTRAIT.width}
                  height={PORTRAIT.height}
                  alt={PORTRAIT.alt}
                  // eslint-disable-next-line react/no-unknown-property
                  fetchPriority="high"
                  decoding="async"
                  className="block h-auto w-full bg-paper-deep object-cover"
                />
              </picture>
            </div>
            <span className="hero-sticker hero-sticker-a" style={{ ["--i" as string]: 0 }}>
              Flash it, don&rsquo;t fear it
            </span>
            <span className="hero-sticker hero-sticker-b" style={{ ["--i" as string]: 1 }}>
              v3rsi0n / ROM.LOG
            </span>
          </div>

          {/* Sentence, facts, CTAs */}
          <div className="relative z-20 mt-10 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:mt-6">
            <h1 id="hero-title" aria-label={sentence} className="font-display text-page font-normal text-ink">
              <span aria-hidden className="m-focus block" style={{ ["--i" as string]: 3 }}>
                {HERO.lines[0]} {HERO.lines[1]} {HERO.lines[2]} <em className="ital">{HERO.emphasis}</em>.
              </span>
            </h1>
            <p className="m-rise mt-5 font-mono text-md text-ink-soft" style={{ ["--m-delay" as string]: "0.32s" }}>
              {HERO.age} <span aria-hidden className="text-graphite">·</span> {HERO.gender}{" "}
              <span aria-hidden className="text-graphite">·</span>{" "}
              <span role="img" aria-label={HERO.country}>
                {HERO.flag}
              </span>
            </p>
            <div className="m-rise mt-7 flex flex-wrap items-center gap-3" style={{ ["--m-delay" as string]: "0.4s" }}>
              <Button href="#work" variant="ink" className="min-h-[52px] px-7 text-[16px]">
                {HERO.ctaPrimary}
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Button>
              <Button href="#ask" variant="outline" className="min-h-[52px] bg-paper/80 px-7 text-[16px]">
                <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                {HERO.ctaSecondary}
              </Button>
            </div>
          </div>

          {/* Info cards */}
          <div className="m-stagger relative z-20 mt-10 grid gap-4 sm:grid-cols-3 lg:col-span-3 lg:col-start-10 lg:row-span-2 lg:row-start-1 lg:mt-16 lg:grid-cols-1 lg:self-start">
            <InfoCard label="Builds">Custom ROMs · Apps · Root modules</InfoCard>
            <InfoCard label="Device">Realme GT Neo 3 · lisaa</InfoCard>
            <InfoCard label="Status">
              <StatusDot tone="moss" label="Open for collabs" className="text-ink" />
            </InfoCard>
          </div>
        </div>
      </section>

      {/* FIG. 1 bench, moved out of the hero */}
      <section aria-label="Figure 1: a stock device, taken apart" className="page relative grid items-center gap-10 pb-20 lg:grid-cols-12 lg:pb-28">
        <div className="lg:col-span-5">
          <p className="kicker">Bench</p>
          <p className="mt-3 max-w-[40ch] font-display text-page text-ink">Take a stock device apart, one partition at a time.</p>
          <p className="mt-3 max-w-[48ch] text-lg text-ink-soft">Pick a partition to see what lives there, or flash the whole stack.</p>
        </div>
        <div ref={figRef} className="lg:col-span-6 lg:col-start-7">
          <Figure caption="Fig. 1 — A stock device, taken apart" bodyClassName="flex flex-col items-center gap-5">
            <FigPhone ref={phone} active={active} onActive={pick} />
            <PartitionBench active={active} onPick={pick} onFlash={flash} flashing={flashing} flashed={flashed} />
          </Figure>
        </div>
      </section>
    </>
  );
}
