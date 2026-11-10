import { useCallback, useRef, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { HERO, type PartitionKey } from "../lib/data";
import { usePointerVars, type PointerFrame } from "../hooks/usePointerVars";
import { FigPhone, type FigPhoneHandle } from "./FigPhone";
import { PartitionBench } from "./HeroBench";
import { Button, Figure, Pill } from "./ui";

const LENS = 320; // lens window (px), matches .lens
const DOT = 22; // .grid-paper pitch

export function Hero() {
  const [active, setActive] = useState<PartitionKey | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [flashed, setFlashed] = useState(false);

  const figRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const lensDots = useRef<HTMLElement>(null);
  const phone = useRef<FigPhoneHandle>(null);

  // FIG. 1 depth parallax: writes --px/--py, no re-renders
  usePointerVars(figRef);

  // Dot-grid lens: a composited window + counter-shifted dots, transforms only
  const moveLens = useCallback((f: PointerFrame) => {
    const lens = lensRef.current;
    const dots = lensDots.current;
    if (!lens || !dots) return;
    if (!f.inside) {
      lens.removeAttribute("data-on");
      return;
    }
    const x = f.x - LENS / 2;
    const y = f.y - LENS / 2;
    const mod = (n: number) => ((n % DOT) + DOT) % DOT;
    lens.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    dots.style.transform = `translate3d(${(-mod(x)).toFixed(1)}px, ${(-mod(y)).toFixed(1)}px, 0)`;
    lens.setAttribute("data-on", "");
  }, []);
  usePointerVars(heroRef, { onFrame: moveLens });

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

  const lineStyle = (i: number) => ({
    ["--i" as string]: i,
    ["--rise-y" as string]: "22px",
    ["--m-dur" as string]: "var(--dur-hero)",
    ["--m-delay" as string]: "0.05s",
  });
  const sentence = `${HERO.lines.join(" ")} ${HERO.emphasis}.`;

  return (
    <section id="top" ref={heroRef} aria-labelledby="hero-title" className="relative overflow-x-clip">
      <div
        aria-hidden
        className="grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,#000_30%,transparent_80%)]"
      />
      <div ref={lensRef} aria-hidden className="lens">
        <i ref={lensDots} className="grid-paper" />
      </div>

      <div className="page relative grid items-center gap-x-10 gap-y-14 pt-14 pb-20 lg:grid-cols-12 lg:pt-20 lg:pb-28">
        {/* Copy */}
        <div className="lg:col-span-7">
          <div className="m-rise flex flex-wrap items-center gap-x-5 gap-y-3" style={{ ["--rise-y" as string]: "10px" }}>
            <p className="flex items-center gap-3 font-mono text-micro uppercase tracking-[0.18em]">
              <span className="shrink-0 whitespace-nowrap text-vermilion-ink">§ 00</span>
              <span aria-hidden className="h-px w-8 bg-rule-strong" />
              <span className="text-graphite">{HERO.kicker}</span>
            </p>
            <Pill badge="New">{HERO.pill}</Pill>
          </div>

          <h1
            id="hero-title"
            aria-label={sentence}
            className="mt-7 font-display text-hero font-normal text-ink max-[359px]:text-[38px]"
          >
            <span aria-hidden className="m-focus block" style={lineStyle(0)}>
              {HERO.lines[0]}
            </span>
            <span aria-hidden className="m-focus block" style={lineStyle(1)}>
              {HERO.lines[1]}
            </span>
            <span aria-hidden className="m-focus block" style={lineStyle(2)}>
              {HERO.lines[2]} <em className="ital">{HERO.emphasis}</em>.
            </span>
          </h1>

          <p className="m-rise mt-7 font-mono text-md text-ink-soft" style={{ ["--m-delay" as string]: "0.32s" }}>
            {HERO.age} <span aria-hidden className="text-graphite">·</span> {HERO.gender}{" "}
            <span aria-hidden className="text-graphite">·</span>{" "}
            <span role="img" aria-label={HERO.country}>
              {HERO.flag}
            </span>
          </p>

          <div className="m-rise mt-9 flex flex-wrap items-center gap-3" style={{ ["--m-delay" as string]: "0.4s" }}>
            <Button href="#work" variant="ink" className="min-h-[52px] px-7 text-[16px]">
              {HERO.ctaPrimary}
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Button href="#ask" variant="outline" className="min-h-[52px] px-7 text-[16px]">
              <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {HERO.ctaSecondary}
            </Button>
          </div>
        </div>

        {/* FIG. 1 */}
        <div ref={figRef} className="lg:col-span-5">
          <Figure caption="Fig. 1 — A stock device, taken apart" bodyClassName="flex flex-col items-center gap-5">
            <FigPhone ref={phone} active={active} onActive={pick} />
            <PartitionBench active={active} onPick={pick} onFlash={flash} flashing={flashing} flashed={flashed} />
          </Figure>
        </div>
      </div>
    </section>
  );
}
