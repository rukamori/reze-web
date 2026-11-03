import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { cn } from "../utils/cn";
import { NAV_LINKS } from "../lib/data";
import { useIstClock } from "../hooks/useInView";
import { Wordmark } from "./Wordmark";
import { buttonClass } from "./ui";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const clock = useIstClock();
  const menuBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on desktop resize
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = sheetRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuBtn.current?.focus();
      }
      if (e.key === "Tab" && sheetRef.current) {
        const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>("a, button"));
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color] duration-[var(--dur-3)] ease-[var(--ease-out)]",
        scrolled ? "frost border-rule" : "border-transparent bg-transparent"
      )}
    >
      <nav aria-label="Primary" className="page flex h-16 items-center justify-between gap-6">
        <a href="#top" aria-label="v3rsi0n, back to top" className="flex min-h-11 items-center rounded-[var(--radius-sm)]">
          <Wordmark />
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[15px] text-ink-soft transition-colors duration-[var(--dur-2)] hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-6 lg:flex">
          <span className="hidden font-mono text-xs text-graphite tabular xl:inline">IST {clock}</span>
          <a href="#ask" className={buttonClass("ink", "min-h-10 px-5 text-[15px]")}>
            Ask me
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </a>
        </div>

        <button
          ref={menuBtn}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-sheet"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink transition-colors duration-[var(--dur-2)] hover:bg-[#14130f0d] lg:hidden"
        >
          <Menu aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </nav>

    </header>

      {/* Mobile sheet: outside the header, whose backdrop-filter would trap fixed children */}
      <div
        aria-hidden
        data-open={open}
        onClick={close}
        className="scrim fixed inset-0 z-[60] bg-[#14130f59] lg:hidden"
      />
      <div
        id="mobile-sheet"
        ref={sheetRef}
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className="sheet fixed inset-y-0 right-0 z-[70] flex w-[min(320px,88vw)] flex-col border-l border-ink bg-paper lg:hidden"
      >
        <div className="flex h-16 items-center justify-between border-b border-rule px-5">
          <span className="kicker">Menu</span>
          <button
            type="button"
            onClick={() => {
              close();
              menuBtn.current?.focus();
            }}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink transition-colors duration-[var(--dur-2)] hover:bg-[#14130f0d]"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <ul className="flex flex-col px-5 py-4">
          {NAV_LINKS.map((l, i) => (
            <li key={l.href} className="border-b border-rule">
              <a
                href={l.href}
                onClick={close}
                className="flex min-h-14 items-baseline gap-4 py-3 font-display text-page text-ink transition-colors duration-[var(--dur-2)] hover:text-vermilion-ink"
              >
                <span className="font-mono text-xs text-graphite tabular">{String(i + 1).padStart(2, "0")}</span>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-4 border-t border-rule p-5">
          <span className="font-mono text-xs text-graphite tabular">IST {clock}</span>
          <a href="#ask" onClick={close} className={buttonClass("ink", "w-full")}>
            Ask me
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </a>
        </div>
      </div>
    </>
  );
}
