import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { formatElapsedTime } from "@game/components/siege-hud/formatElapsedTime";
import type {
  SiegeCompletionSummary,
  SiegeLeaderboardEntry,
} from "@game/hooks/useSiegeRunCompletion";
import { SIEGE_GAME_MODE_META } from "@game/types";

interface SiegeRunCompleteOverlayProps {
  completionSummary: SiegeCompletionSummary;
  leaderboard: SiegeLeaderboardEntry[];
  onExit: () => void;
  onReplayMode: () => void;
  onSwitchMode: () => void;
}

const TIME_ATTACK_QUIPS = [
  "Now go back to work and fix the actual bugs.",
  "Zero bugs — for the next five minutes, at least.",
  "Clean sweep. The real backlog awaits.",
  "Bugs resolved. Your Linear board is still a disaster.",
  "Victory! Now, about that PR that's been in review for three weeks\u2026",
  "Impressive. Now let's pretend production doesn't exist.",
  "Speedrun complete. QA already found something.",
  "All fixed. Nobody knows how, but it's fixed.",
  "You fixed the bugs. Please don't touch anything else.",
  "Perfect run. Ship it before anyone notices.",
  "Fast fixes deployed. Long-term consequences pending.",
  "Everything works. This is suspicious.",
];

const SURVIVAL_QUIPS = [
  "They won. You deserve a coffee break.",
  "Site overwhelmed \u2014 honestly, same.",
  "Overrun. At least now you know your exact bug count.",
  "Critical failure. Have you tried turning it off and on again?",
  "The bugs are winning\u2026 in production too, probably.",
  "You held longer than that one ticket that's been 'in progress' since Q3.",
  "You lasted longer than the last deployment.",
  "Crash confirmed. Logs are, of course, useless.",
  "Downtime achieved. Accidentally.",
  "Production sends its regards.",
  "It worked locally.",
  "We’ll call it a flaky issue.",
];

function getQuipIndex(runId: string, arrayLength: number): number {
  let hash = 0;
  for (let i = 0; i < runId.length; i++) {
    hash = (hash * 31 + runId.charCodeAt(i)) >>> 0;
  }
  return hash % arrayLength;
}

const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  color: ["#fbbf24", "#34d399", "#7dd3fc", "#f472b6", "#c084fc"][index % 5],
  delay: `${(index % 7) * 0.12}s`,
  duration: `${4.1 + (index % 4) * 0.45}s`,
  left: `${4 + index * 3.35}%`,
  rotate: `${(index % 6) * 22}deg`,
  size: 8 + (index % 3) * 3,
}));

const SiegeRunCompleteOverlay = memo(function SiegeRunCompleteOverlay({
  completionSummary,
  leaderboard,
  onExit,
  onReplayMode,
  onSwitchMode,
}: SiegeRunCompleteOverlayProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [sortBy, setSortBy] = useState<"primary" | "secondary">("primary");
  const alternateMode =
    completionSummary.mode === "purge" ? "outbreak" : "purge";
  const alternateModeMeta = SIEGE_GAME_MODE_META[alternateMode];
  const modeMeta = SIEGE_GAME_MODE_META[completionSummary.mode];
  const isSurvival = completionSummary.mode === "outbreak";
  const isSurvivalOverrun = completionSummary.outcome === "survivalOverrun";
  const backdropClassName = isSurvivalOverrun
    ? "bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.22),transparent_34%),radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.16),transparent_28%),rgba(2,6,23,0.76)]"
    : "bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.2),transparent_36%),radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.18),transparent_28%),rgba(2,6,23,0.72)]";
  const quipPool = isSurvivalOverrun ? SURVIVAL_QUIPS : TIME_ATTACK_QUIPS;
  const quip = quipPool[getQuipIndex(completionSummary.id, quipPool.length)];
  const title = isSurvivalOverrun ? "Site overrun." : "Swarm cleared.";
  const sortOptions: Array<{ key: "primary" | "secondary"; label: string }> = [
    { key: "primary", label: isSurvival ? "Wave" : "Time" },
    { key: "secondary", label: isSurvival ? "Survived" : "Speed" },
  ];

  const sortedLeaderboard = useMemo(() => {
    if (sortBy === "primary") return leaderboard;
    const entries = [...leaderboard];
    if (isSurvival) {
      entries.sort((a, b) => (b.survivedMs ?? 0) - (a.survivedMs ?? 0));
    } else {
      entries.sort((a, b) => b.bugsPerSecond - a.bugsPerSecond);
    }
    return entries;
  }, [isSurvival, leaderboard, sortBy]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const previousActiveElement =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    const focusTarget = dialogRef.current?.querySelector<HTMLElement>(
      '[data-testid="siege-complete-replay"]',
    );
    focusTarget?.focus();
    return () => {
      previousActiveElement?.focus?.();
    };
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onExit();
      return;
    }
    if (event.key !== "Tab") return;
    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.offsetParent !== null);
    if (focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className={`pointer-events-auto fixed inset-0 z-[260] overflow-hidden ${backdropClassName} backdrop-blur-[3px]`}
      data-hud-cursor="default"
      data-no-hammer="true"
      data-testid="siege-complete-overlay"
    >
      {!prefersReducedMotion && !isSurvivalOverrun ? (
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          {CONFETTI.map((piece) => (
            <span
              key={`${piece.left}-${piece.delay}`}
              className="absolute top-[-10%] block rounded-sm opacity-90"
              style={{
                left: piece.left,
                width: piece.size,
                height: piece.size * 1.8,
                background: piece.color,
                transform: `rotate(${piece.rotate})`,
                animation: `siege-confetti-fall ${piece.duration} linear ${piece.delay} infinite`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <section
          aria-modal="true"
          aria-describedby="siege-complete-summary"
          aria-labelledby="siege-complete-title"
          className={`w-full max-w-5xl rounded-[2rem] border border-white/12 bg-[linear-gradient(155deg,rgba(15,23,42,0.98),rgba(10,15,28,0.94))] p-6 text-stone-100 shadow-[0_32px_120px_rgba(15,23,42,0.48)] sm:p-8 ${prefersReducedMotion ? "" : "[animation:siege-complete-pop_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]"}`}
          onKeyDown={handleDialogKeyDown}
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            {/* ── LEFT ── */}
            <div className="flex flex-col gap-5">
              {/* eyebrow */}
              <p className="text-[0.67rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
                {modeMeta.shortLabel}
              </p>

              {/* headline + quip */}
              <div>
                <h2
                  className="text-4xl font-bold tracking-[-0.04em] text-white sm:text-[3.5rem] sm:leading-[1.08]"
                  id="siege-complete-title"
                  data-testid="siege-complete-title"
                >
                  {title}
                </h2>
                <p
                  className="mt-3 text-lg italic leading-snug text-stone-300 sm:text-xl"
                  data-testid="siege-complete-quip"
                  id="siege-complete-summary"
                >
                  &ldquo;{quip}&rdquo;
                </p>
              </div>

              {/* stats — borderless strip */}
              <div className="flex items-start gap-6 border-t border-white/8 pt-5">
                <div>
                  <div className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-stone-500">
                    {isSurvival ? "Wave" : "Time"}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-white">
                    {isSurvival
                      ? completionSummary.waveReached.toLocaleString()
                      : formatElapsedTime(completionSummary.elapsedMs)}
                  </div>
                </div>
                <div className="mt-1 h-8 w-px shrink-0 bg-white/10" />
                <div>
                  <div className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-stone-500">
                    {isSurvival ? "Survived" : "Bugs"}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-white">
                    {isSurvival
                      ? formatElapsedTime(completionSummary.survivedMs)
                      : completionSummary.bugCount.toLocaleString()}
                  </div>
                </div>
                <div className="mt-1 h-8 w-px shrink-0 bg-white/10" />
                <div>
                  <div className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-stone-500">
                    {isSurvival ? "Status" : "Bugs/s"}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-white">
                    {isSurvival
                      ? "Offline"
                      : completionSummary.bugsPerSecond.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* actions — pill buttons */}
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/8 pt-5">
                <button
                  className="rounded-full border border-emerald-400/30 bg-emerald-500/[0.16] px-4 py-1.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/25 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
                  data-testid="siege-complete-replay"
                  onClick={onReplayMode}
                  type="button"
                >
                  Play {modeMeta.shortLabel} Again
                </button>
                <button
                  className="rounded-full border border-white/12 px-4 py-1.5 text-sm font-semibold text-stone-400 transition hover:border-white/22 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  data-testid="siege-complete-switch-mode"
                  onClick={onSwitchMode}
                  type="button"
                >
                  {alternateModeMeta.switchActionLabel}
                </button>
                <button
                  className="rounded-full border border-white/12 px-4 py-1.5 text-sm font-semibold text-stone-400 transition hover:border-white/22 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  data-testid="siege-complete-back-dashboard"
                  onClick={onExit}
                  type="button"
                >
                  Back to dashboard
                </button>
              </div>
            </div>

            {/* ── RIGHT — leaderboard ── */}
            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.67rem] font-semibold uppercase tracking-[0.22em] text-stone-400">
                  Leaderboard
                </p>
                <div className="flex gap-0.5 rounded-full border border-white/10 bg-black/24 p-0.5">
                  {sortOptions.map(({ key, label }) => (
                    <button
                      key={key}
                      className={`rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] transition ${
                        sortBy === key
                          ? "bg-white/12 text-white"
                          : "text-stone-500 hover:text-stone-300"
                      }`}
                      onClick={() => setSortBy(key)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 max-h-[320px] space-y-0.5 overflow-y-auto">
                {sortedLeaderboard.map((entry, index) => {
                  const isCurrent = entry.id === completionSummary.id;
                  return (
                    <div
                      key={entry.id}
                      className={`grid grid-cols-[1.75rem_1fr] items-start gap-2 rounded-xl px-2.5 py-2 ${
                        isCurrent
                          ? "bg-emerald-300/8 ring-1 ring-inset ring-emerald-300/20"
                          : "hover:bg-white/4"
                      }`}
                      data-current-run={isCurrent ? "true" : "false"}
                    >
                      <div
                        className={`pt-0.5 text-sm font-semibold tabular-nums ${
                          isCurrent ? "text-emerald-400" : "text-stone-500"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-xs font-semibold text-white">
                            {entry.mode === "outbreak"
                              ? `Wave ${entry.waveReached} · ${formatElapsedTime(entry.survivedMs)}`
                              : `${formatElapsedTime(entry.elapsedMs)} · ${entry.bugCount.toLocaleString()} bugs`}
                          </div>
                          {isCurrent ? (
                            <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-emerald-400/80">
                              You
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[0.63rem] text-stone-500">
                          {entry.topWeaponLabel}
                          {!isSurvival
                            ? ` · ${entry.bugsPerSecond.toFixed(2)} bugs/s`
                            : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default SiegeRunCompleteOverlay;
