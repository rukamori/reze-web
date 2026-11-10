import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { GAMES, QUIZ, type Game } from "../lib/data";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Gauge, Gamepad2, HelpCircle, Play as PlayIcon, Timer, X, type LucideIcon } from "lucide-react";
import { MonoTag, StatusDot } from "./ui";

/* ================= Snake ================= */

const SNAKE_N = 15;
const SNAKE_CELL = 20;

function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("reze_snake_best") ?? 0));
  const [dead, setDead] = useState(false);
  // Still board until the visitor presses Play or uses a control
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
  }, []);
  const state = useRef({
    snake: [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }],
    dir: { x: 1, y: 0 },
    next: { x: 1, y: 0 },
    food: { x: 11, y: 7 },
    over: false,
  });

  const placeFood = useCallback(() => {
    const s = state.current;
    do {
      s.food = { x: Math.floor(Math.random() * SNAKE_N), y: Math.floor(Math.random() * SNAKE_N) };
    } while (s.snake.some((c) => c.x === s.food.x && c.y === s.food.y));
  }, []);

  const reset = () => {
    state.current = {
      snake: [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }],
      dir: { x: 1, y: 0 },
      next: { x: 1, y: 0 },
      food: { x: 11, y: 7 },
      over: false,
    };
    setScore(0);
    setDead(false);
  };

  const turn = useCallback((dx: number, dy: number) => {
    start();
    const s = state.current;
    if (s.dir.x === -dx && s.dir.y === -dy) return;
    s.next = { x: dx, y: dy };
  }, [start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) e.preventDefault();
      if (k === "arrowup" || k === "w") turn(0, -1);
      if (k === "arrowdown" || k === "s") turn(0, 1);
      if (k === "arrowleft" || k === "a") turn(-1, 0);
      if (k === "arrowright" || k === "d") turn(1, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const s = state.current;
      ctx.fillStyle = "#fbf9f4";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "#e9e3d5";
      ctx.lineWidth = 1;
      for (let i = 1; i < SNAKE_N; i++) {
        ctx.beginPath();
        ctx.moveTo(i * SNAKE_CELL + 0.5, 0);
        ctx.lineTo(i * SNAKE_CELL + 0.5, cv.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * SNAKE_CELL + 0.5);
        ctx.lineTo(cv.width, i * SNAKE_CELL + 0.5);
        ctx.stroke();
      }
      ctx.fillStyle = "#ff4a1c";
      ctx.fillRect(s.food.x * SNAKE_CELL + 5, s.food.y * SNAKE_CELL + 5, SNAKE_CELL - 10, SNAKE_CELL - 10);
      s.snake.forEach((c, i) => {
        ctx.fillStyle = i === 0 ? "#14130f" : "#3a372f";
        ctx.fillRect(c.x * SNAKE_CELL + 2, c.y * SNAKE_CELL + 2, SNAKE_CELL - 4, SNAKE_CELL - 4);
      });
    };

    const iv = setInterval(() => {
      const s = state.current;
      if (s.over || !startedRef.current) return;
      s.dir = s.next;
      const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= SNAKE_N || head.y >= SNAKE_N || s.snake.some((c) => c.x === head.x && c.y === head.y)) {
        s.over = true;
        setDead(true);
        setBest((b) => {
          const nb = Math.max(b, s.snake.length - 3);
          localStorage.setItem("reze_snake_best", String(nb));
          return nb;
        });
        return;
      }
      s.snake.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) {
        setScore(s.snake.length - 3);
        placeFood();
      } else {
        s.snake.pop();
      }
      draw();
    }, 110);

    draw();
    return () => clearInterval(iv);
  }, [placeFood]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full items-center justify-between pb-4">
        <MonoTag className="text-ink-soft tabular">Score {String(score).padStart(2, "0")}</MonoTag>
        <MonoTag className="text-graphite tabular">Best {String(best).padStart(2, "0")}</MonoTag>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={SNAKE_N * SNAKE_CELL} height={SNAKE_N * SNAKE_CELL} className="block h-auto max-w-full rounded-[var(--radius-sm)] border border-rule-strong" />
        {!started && !dead && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-composer/90 px-4 text-center">
            <button
              type="button"
              onClick={start}
              aria-label="Start Snake"
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-vermilion text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep"
            >
              <PlayIcon aria-hidden className="h-5 w-5 translate-x-px fill-current" strokeWidth={1.5} />
            </button>
            <MonoTag className="text-ink-soft">Tap Play, or use arrows / WASD / the pad</MonoTag>
          </div>
        )}
        {dead && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-composer/90">
            <MonoTag className="text-vermilion-ink">Signal lost — self-sabotage confirmed</MonoTag>
            <button onClick={reset} className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-paper transition-colors duration-[var(--dur-2)] hover:bg-ink-soft">
              Restart
            </button>
          </div>
        )}
      </div>
      {/* D-pad for touch */}
      <div className="mt-4 grid grid-cols-3 gap-1.5 sm:hidden">
        <span />
        <button aria-label="Up" onClick={() => turn(0, -1)} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-rule-strong font-mono text-xs text-ink"><ChevronUp aria-hidden className="h-4 w-4" /></button>
        <span />
        <button aria-label="Left" onClick={() => turn(-1, 0)} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-rule-strong font-mono text-xs text-ink"><ChevronLeft aria-hidden className="h-4 w-4" /></button>
        <button aria-label="Down" onClick={() => turn(0, 1)} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-rule-strong font-mono text-xs text-ink"><ChevronDown aria-hidden className="h-4 w-4" /></button>
        <button aria-label="Right" onClick={() => turn(1, 0)} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-rule-strong font-mono text-xs text-ink"><ChevronRight aria-hidden className="h-4 w-4" /></button>
      </div>
      <MonoTag className="mt-4 hidden text-graphite sm:block">Arrows / WASD to steer</MonoTag>
    </div>
  );
}

/* ================= Ping Pong ================= */

function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scores, setScores] = useState({ you: 0, ai: 0 });
  const [winner, setWinner] = useState<null | "you" | "ai">(null);
  // Frozen court until Play or a tap on it (hovering never starts it)
  const [started, setStarted] = useState(false);
  const s = useRef({ py: 80, ay: 80, bx: 150, by: 110, vx: 3.2, vy: 2.1, pyTarget: 80, you: 0, ai: 0, paused: true });
  const start = useCallback(() => {
    if (!s.current.paused || winnerRef.current) return;
    s.current.paused = false;
    setStarted(true);
  }, []);
  const winnerRef = useRef<null | "you" | "ai">(null);
  winnerRef.current = winner;

  const reset = (full: boolean) => {
    const st = s.current;
    st.bx = 150;
    st.by = 110;
    st.vx = (Math.random() > 0.5 ? 1 : -1) * 3.2;
    st.vy = (Math.random() - 0.5) * 4;
    if (full) {
      st.you = 0;
      st.ai = 0;
      st.paused = false;
      setScores({ you: 0, ai: 0 });
      setWinner(null);
    }
  };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      s.current.pyTarget = ((e.clientY - r.top) / r.height) * 220 - 30;
    };
    cv.addEventListener("pointermove", onMove);
    const onDown = () => start();
    cv.addEventListener("pointerdown", onDown);

    let raf = 0;
    const loop = () => {
      const st = s.current;
      if (!st.paused) {
        st.py += (st.pyTarget - st.py) * 0.25;
        st.py = Math.max(0, Math.min(160, st.py));
        st.ay += (st.by - 30 - st.ay) * 0.09;
        st.ay = Math.max(0, Math.min(160, st.ay));
        st.bx += st.vx;
        st.by += st.vy;
        if (st.by <= 4 || st.by >= 216) st.vy *= -1;
        if (st.bx <= 18 && st.bx >= 10 && st.by >= st.py && st.by <= st.py + 60) st.vx = Math.abs(st.vx) * 1.03;
        if (st.bx >= 282 && st.bx <= 290 && st.by >= st.ay && st.by <= st.ay + 60) st.vx = -Math.abs(st.vx) * 1.03;
        if (st.bx < -8) {
          st.ai += 1;
          setScores({ you: st.you, ai: st.ai });
          if (st.ai >= 5) { st.paused = true; setWinner("ai"); } else reset(false);
        }
        if (st.bx > 308) {
          st.you += 1;
          setScores({ you: st.you, ai: st.ai });
          if (st.you >= 5) { st.paused = true; setWinner("you"); } else reset(false);
        }
      }

      ctx.fillStyle = "#fbf9f4";
      ctx.fillRect(0, 0, 300, 220);
      ctx.strokeStyle = "#d8d0bf";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(150.5, 0);
      ctx.lineTo(150.5, 220);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#14130f";
      ctx.fillRect(10, st.py, 5, 60);
      ctx.fillRect(285, st.ay, 5, 60);
      ctx.fillStyle = "#ff4a1c";
      ctx.fillRect(st.bx - 3, st.by - 3, 6, 6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full items-center justify-between pb-4">
        <MonoTag className="text-ink-soft tabular">You {scores.you}</MonoTag>
        <MonoTag className="text-graphite">First to 5</MonoTag>
        <MonoTag className="text-vermilion-ink tabular">AI {scores.ai}</MonoTag>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={300} height={220} className="block h-auto max-w-full cursor-none touch-none rounded-[var(--radius-sm)] border border-rule-strong" />
        {!started && !winner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-composer/90 px-4 text-center">
            <button
              type="button"
              onClick={start}
              aria-label="Start Ping Pong"
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-vermilion text-ink transition-colors duration-[var(--dur-2)] hover:bg-vermilion-deep"
            >
              <PlayIcon aria-hidden className="h-5 w-5 translate-x-px fill-current" strokeWidth={1.5} />
            </button>
            <MonoTag className="text-ink-soft">Tap Play or tap the court, then steer with the pointer</MonoTag>
          </div>
        )}
        {winner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-composer/90">
            <MonoTag className={winner === "you" ? "text-moss-ink" : "text-vermilion-ink"}>
              {winner === "you" ? "Match — you win" : "Match — the machine wins"}
            </MonoTag>
            <button onClick={() => reset(true)} className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-paper transition-colors duration-[var(--dur-2)] hover:bg-ink-soft">
              Rematch
            </button>
          </div>
        )}
      </div>
      <MonoTag className="mt-4 text-graphite">Move pointer over the court to steer</MonoTag>
    </div>
  );
}

/* ================= Reaction ================= */

function ReactionGame() {
  const [phase, setPhase] = useState<"idle" | "armed" | "go" | "result">("idle");
  const [ms, setMs] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("reze_reaction_best") ?? 0));
  const timer = useRef<number>(0);
  const t0 = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const arm = () => {
    setPhase("armed");
    timer.current = window.setTimeout(() => {
      t0.current = performance.now();
      setPhase("go");
    }, 1400 + Math.random() * 2200);
  };

  const click = () => {
    if (phase === "idle" || phase === "result") return arm();
    if (phase === "armed") {
      clearTimeout(timer.current);
      setMs(-1);
      setPhase("result");
      return;
    }
    if (phase === "go") {
      const dt = Math.round(performance.now() - t0.current);
      setMs(dt);
      setBest((b) => {
        const nb = b === 0 ? dt : Math.min(b, dt);
        localStorage.setItem("reze_reaction_best", String(nb));
        return nb;
      });
      setPhase("result");
    }
  };

  return (
    <div className="flex flex-col">
      <button
        onClick={click}
        className={cn(
          "flex h-56 w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border transition-colors duration-[var(--dur-2)]",
          phase === "go" ? "border-moss bg-[#4f7a3a26]" : phase === "armed" ? "border-vermilion bg-vermilion-wash" : "border-rule-strong bg-card hover:border-ink"
        )}
      >
        {phase === "idle" && <MonoTag className="text-ink-soft">Click to arm</MonoTag>}
        {phase === "armed" && <MonoTag className="rounded-full px-2 py-1 text-vermilion-ink">Wait for green…</MonoTag>}
        {phase === "go" && <span className="font-display text-display text-moss-ink">Click</span>}
        {phase === "result" && ms === -1 && (
          <>
            <MonoTag className="text-vermilion-ink">False start — too eager</MonoTag>
            <MonoTag className="text-graphite">Click to re-arm</MonoTag>
          </>
        )}
        {phase === "result" && ms > 0 && (
          <>
            <span className="font-display text-display text-ink tabular">{ms}&nbsp;ms</span>
            <MonoTag className="text-graphite">Click to run again</MonoTag>
          </>
        )}
      </button>
      <MonoTag className="mt-4 text-center text-graphite tabular">
        Personal best: {best > 0 ? `${best} ms` : "—"}
      </MonoTag>
    </div>
  );
}

/* ================= Roast Quiz ================= */

function QuizGame() {
  const [step, setStep] = useState(0);
  const [roasts, setRoasts] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const r = QUIZ[step].roasts[i];
    setTimeout(() => {
      setRoasts((prev) => [...prev, r]);
      setPicked(null);
      setStep((s) => s + 1);
    }, 1100);
  };

  if (step >= QUIZ.length) {
    return (
      <div className="flex flex-col gap-4">
        <MonoTag className="text-moss-ink">Diagnosis complete</MonoTag>
        <ul className="space-y-2 border-y border-rule py-4">
          {roasts.map((r, i) => (
            <li key={i} className="font-mono text-sm text-ink-soft">
              <span aria-hidden className="mr-2 text-vermilion-ink">›</span>
              {r}
            </li>
          ))}
        </ul>
        <button
          onClick={() => { setStep(0); setRoasts([]); }}
          className="self-start inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-paper transition-colors duration-[var(--dur-2)] hover:bg-ink-soft"
        >
          Run it back
        </button>
      </div>
    );
  }

  const q = QUIZ[step];
  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <MonoTag className="text-graphite tabular">Question {step + 1} / {QUIZ.length}</MonoTag>
        <MonoTag className="text-vermilion-ink">Roast mode</MonoTag>
      </div>
      <p className="font-display text-title text-ink">{q.q}</p>
      <div className="mt-5 flex flex-col gap-2.5">
        {q.opts.map((opt, i) => (
          <button
            key={opt}
            onClick={() => pick(i)}
            className={cn(
              "min-h-11 rounded-[var(--radius-sm)] border px-4 py-3 text-left text-md transition-colors duration-[var(--dur-2)]",
              picked === i ? "border-vermilion bg-vermilion-wash text-ink" : "border-rule-strong text-ink-soft hover:border-ink hover:text-ink"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {picked !== null && <MonoTag className="m-swap mt-4 block text-vermilion-ink">{q.roasts[picked]}</MonoTag>}
    </div>
  );
}

/* ================= Modal shell + grid ================= */

function GameShell({ game, onClose }: { game: Game; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#14130f8c] p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${game.name} game`}
    >
      <div
        className="m-settle max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-ink bg-composer shadow-[var(--shadow-ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusDot tone="graphite" label="Ready" className="shrink-0" />
            <MonoTag className="truncate text-graphite">{game.name.toLowerCase().replace(/\s/g, "-")} — play.exe</MonoTag>
          </div>
          <button onClick={onClose} aria-label="Close game" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-2)] hover:bg-[#14130f0d] hover:text-ink">
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="p-5 sm:p-6">
          {game.id === "snake" && <SnakeGame />}
          {game.id === "pong" && <PongGame />}
          {game.id === "reaction" && <ReactionGame />}
          {game.id === "quiz" && <QuizGame />}
        </div>
        <div className="border-t border-rule px-5 py-3">
          <MonoTag className="text-graphite">ESC to eject · scores persist locally</MonoTag>
        </div>
      </div>
    </div>
  );
}

const GAME_ICONS: Record<Game["icon"], LucideIcon> = {
  snake: Gamepad2,
  pong: Gauge,
  quiz: HelpCircle,
  reaction: Timer,
};

/** The playground — game rows inside the § 04 "Play" tab. Game logic is unchanged. */
export function Play() {
  const [active, setActive] = useState<Game | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setActive(null);
    opener.current?.focus();
  }, []);

  return (
    <div>
      <ul className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-rule bg-rule sm:grid-cols-2">
        {GAMES.map((game) => {
          const Icon = GAME_ICONS[game.icon];
          return (
            <li key={game.id} className="bg-card">
              <button
                type="button"
                disabled={!game.playable}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setActive(game);
                }}
                className="group flex h-full min-h-[88px] w-full items-start gap-4 p-4 text-left transition-colors duration-[var(--dur-2)] enabled:hover:bg-composer disabled:cursor-not-allowed"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--dur-2)]",
                    game.playable ? "border-ink text-ink group-hover:bg-vermilion" : "border-rule-strong text-graphite"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-md font-semibold", game.playable ? "text-ink" : "text-ink-soft")}>{game.name}</span>
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">{game.desc}</span>
                </span>
                {game.playable && <MonoTag className="hidden shrink-0 pt-0.5 text-vermilion-ink sm:inline">Play</MonoTag>}
              </button>
            </li>
          );
        })}
      </ul>

      {active && <GameShell game={active} onClose={close} />}
    </div>
  );
}
