import { useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Reveal } from "./Reveal";
import { useScrollVar } from "../hooks/useScrollVar";

/* ---------- Mono label (12px, functional text) ---------- */

export function MonoTag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs", className)}>{children}</span>;
}

/* ---------- Kicker: mono micro label ---------- */

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("kicker", className)}>{children}</span>;
}

/** "§ 0N ── LABEL" — every section opens with this row. */
export function SectionMark({ num, label, className }: { num: string; label: string; className?: string }) {
  // § numerals drift a few px with scroll (shared scroll clock)
  const ref = useRef<HTMLSpanElement>(null);
  useScrollVar(ref);
  return (
    <p className={cn("flex items-center gap-3 font-mono text-micro uppercase tracking-[0.18em]", className)}>
      <span ref={ref} className="sec-num inline-block whitespace-nowrap text-[var(--accent-text)]">§ {num}</span>
      <span aria-hidden className="h-px w-8 bg-[var(--border-strong)]" />
      <span className="text-[var(--text-3)]">{label}</span>
    </p>
  );
}

export function SectionHead({
  num,
  label,
  title,
  lede,
  className,
  titleClassName,
}: {
  num: string;
  label: string;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <Reveal className={className}>
      <SectionMark num={num} label={label} />
      <Reveal as="h2" variant="focus" delay={60} className={cn("mt-6 font-display text-display font-normal text-[var(--text)]", titleClassName)}>
        {title}
      </Reveal>
      {lede && <p className="mt-6 max-w-[60ch] text-lede text-[var(--text-2)]">{lede}</p>}
    </Reveal>
  );
}

/* ---------- Buttons ---------- */

type Variant = "ink" | "outline" | "accent";

const BTN_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full px-6 text-[15px] font-medium leading-none whitespace-nowrap " +
  "transition-[background-color,color,border-color] duration-[var(--dur-2)] ease-[var(--ease-out)] disabled:opacity-50";

const BTN_VARIANT: Record<Variant, string> = {
  ink: "bg-ink text-paper hover:bg-ink-soft",
  outline: "border border-[var(--border-strong)] text-[var(--text)] hover:bg-[#14130f0d] hover:border-[var(--text)]",
  accent: "bg-vermilion text-ink hover:bg-vermilion-deep",
};

export function buttonClass(variant: Variant = "ink", className?: string) {
  return cn(BTN_BASE, BTN_VARIANT[variant], className);
}

export function Button({
  variant = "ink",
  className,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return (
    <a {...rest} className={buttonClass(variant, className)}>
      {children}
    </a>
  );
}

export function ActionButton({
  variant = "ink",
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type={type} {...rest} className={buttonClass(variant, className)}>
      {children}
    </button>
  );
}

/* ---------- Chip: dark mono receipt with a vermilion › ---------- */

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-[var(--radius-xs)] bg-ink px-2.5 py-1.5 font-mono text-xs text-paper",
        className
      )}
    >
      <span aria-hidden className="text-vermilion">›</span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

/* ---------- Pill ---------- */

export function Pill({ children, badge, className }: { children: ReactNode; badge?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-[#ff4a1c4d] bg-vermilion-wash py-1 pl-1 pr-3 font-mono text-xs text-ink",
        !badge && "pl-3",
        className
      )}
    >
      {badge && (
        <span className="rounded-full bg-vermilion px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-ink">
          {badge}
        </span>
      )}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/* ---------- Status: a dot that always comes with a word ---------- */

type Tone = "moss" | "vermilion" | "graphite" | "ok";

const DOT: Record<Tone, string> = {
  moss: "bg-moss",
  vermilion: "bg-vermilion",
  graphite: "bg-graphite",
  ok: "bg-panel-ok",
};

export function StatusDot({
  tone = "moss",
  label,
  className,
  spark = false,
}: {
  tone?: Tone;
  label: ReactNode;
  className?: string;
  spark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-xs text-[var(--text-2)]", className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone], spark && "m-spark")} />
      {label}
    </span>
  );
}

/* ---------- Figure with crop marks + caption ---------- */

export function Figure({
  caption,
  children,
  className,
  bodyClassName,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <figure className={cn("m-0", className)}>
      <div className={cn("crop p-4 sm:p-6", bodyClassName)}>
        <span className="crop-b" aria-hidden />
        {children}
      </div>
      <figcaption className="mt-3 border-t border-[var(--text)] pt-3 font-mono text-xs uppercase tracking-[0.14em] text-[var(--text-3)]">
        {caption}
      </figcaption>
    </figure>
  );
}
