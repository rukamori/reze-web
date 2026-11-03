import { cn } from "../utils/cn";

/** v3rsi0n wordmark — ink tile with a vermilion spark and the serif name. */
export function Wordmark({ className, spark = true }: { className?: string; spark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span aria-hidden className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-ink">
        <span className="font-mono text-[11px] font-medium leading-none text-paper">v</span>
        <span className={cn("absolute right-[5px] top-[5px] h-[5px] w-[5px] rounded-full bg-vermilion", spark && "m-spark")} />
      </span>
      <span className="font-display text-title leading-none tracking-[-0.01em] text-[var(--text)]">v3rsi0n</span>
    </span>
  );
}
