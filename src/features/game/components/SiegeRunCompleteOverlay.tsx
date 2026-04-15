import { memo } from "react";
import { formatElapsedTime } from "@game/components/siege-hud/formatElapsedTime";
import type {
  SiegeCompletionSummary,
  SiegeLeaderboardEntry,
} from "@game/hooks/useSiegeRunCompletion";
import { SIEGE_GAME_MODE_META, type SiegeGameMode } from "@game/types";

interface SiegeRunCompleteOverlayProps {
  completionSummary: SiegeCompletionSummary;
  leaderboard: SiegeLeaderboardEntry[];
  onDoubleBugCount: () => void;
  onExit: () => void;
  onSwitchMode: () => void;
}

interface CompletionActionCardProps {
  description: string;
  label: string;
  onClick: () => void;
  title: string;
  tone: "default" | "sky" | "emerald";
}

const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  color: ["#fbbf24", "#34d399", "#7dd3fc", "#f472b6", "#c084fc"][index % 5],
  delay: `${(index % 7) * 0.12}s`,
  duration: `${4.1 + (index % 4) * 0.45}s`,
  left: `${4 + index * 3.35}%`,
  rotate: `${(index % 6) * 22}deg`,
  size: 8 + (index % 3) * 3,
}));

function CompletionActionCard({
  description,
  label,
  onClick,
  title,
  tone,
}: CompletionActionCardProps) {
  const className = {
    default:
      "border-white/12 bg-white/6 hover:border-white/20 hover:bg-white/10",
    emerald:
      "border-emerald-300/24 bg-emerald-300/10 hover:border-emerald-200/40 hover:bg-emerald-300/16",
    sky:
      "border-sky-300/24 bg-sky-300/10 hover:border-sky-200/40 hover:bg-sky-300/16",
  }[tone];
  const labelClassName = {
    default: "text-stone-400",
    emerald: "text-emerald-100/72",
    sky: "text-sky-100/72",
  }[tone];

  return (
    <button
      className={`rounded-2xl border px-4 py-4 text-left transition ${className}`}
      onClick={onClick}
      type="button"
    >
      <div className={`text-[0.72rem] uppercase tracking-[0.18em] ${labelClassName}`}>
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm leading-5 text-stone-300">{description}</div>
    </button>
  );
}

const SiegeRunCompleteOverlay = memo(function SiegeRunCompleteOverlay({
  completionSummary,
  leaderboard,
  onDoubleBugCount,
  onExit,
  onSwitchMode,
}: SiegeRunCompleteOverlayProps) {
  const alternateMode = completionSummary.mode === "purge" ? "outbreak" : "purge";
  const alternateModeMeta = SIEGE_GAME_MODE_META[alternateMode];
  const modeMeta = SIEGE_GAME_MODE_META[completionSummary.mode];
  const actionCards: CompletionActionCardProps[] = [
    {
      description:
        "Relaunch this mode with a doubled swarm and keep climbing the board.",
      label: "Next challenge",
      onClick: onDoubleBugCount,
      title: "Double bug count",
      tone: "sky",
    },
    {
      description: alternateModeMeta.description,
      label: "Mode swap",
      onClick: onSwitchMode,
      title: `Switch to ${alternateModeMeta.label}`,
      tone: "emerald",
    },
    {
      description: "Leave the arena and return to the reporting view.",
      label: "Wrap up",
      onClick: onExit,
      title: "Back to dashboard",
      tone: "default",
    },
  ];

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[260] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.2),transparent_36%),radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.18),transparent_28%),rgba(2,6,23,0.72)] backdrop-blur-[3px]"
      data-testid="siege-complete-overlay"
    >
      <div className="pointer-events-none absolute inset-0">
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

      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <section className="w-full max-w-5xl rounded-[2rem] border border-white/12 bg-[linear-gradient(155deg,rgba(15,23,42,0.98),rgba(10,15,28,0.94))] p-5 text-stone-100 shadow-[0_32px_120px_rgba(15,23,42,0.48)] [animation:siege-complete-pop_420ms_cubic-bezier(0.22,1,0.36,1)_forwards] sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/24 bg-emerald-300/10 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                {completionSummary.isNewBest ? "New local best" : `Leaderboard rank ${completionSummary.rank}`}
              </div>

              <div className="space-y-2">
                <p className="text-[0.74rem] font-semibold uppercase tracking-[0.28em] text-sky-100/72">
                  Run complete • {modeMeta.shortLabel}
                </p>
                <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                  Swarm cleared. The lane is stable.
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-stone-300 sm:text-[0.95rem]">
                  {completionSummary.bugCount.toLocaleString()} bugs cleared in {formatElapsedTime(completionSummary.elapsedMs)} with {completionSummary.topWeaponLabel} leading the run.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[0.7rem] uppercase tracking-[0.2em] text-stone-400">Bug count</div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                    {completionSummary.bugCount.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[0.7rem] uppercase tracking-[0.2em] text-stone-400">Final time</div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                    {formatElapsedTime(completionSummary.elapsedMs)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[0.7rem] uppercase tracking-[0.2em] text-stone-400">Bugs per second</div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                    {completionSummary.bugsPerSecond.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {actionCards.map((card) => (
                  <CompletionActionCard key={card.title} {...card} />
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-stone-400">
                    Local leaderboard
                  </p>
                  <p className="mt-1 text-sm text-stone-300">
                    Best clears are ranked by bug count first, then by fastest finish.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-stone-300">
                  Top {Math.min(leaderboard.length, 8)}
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-black/18 px-3 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/6 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {entry.bugCount.toLocaleString()} bugs • {formatElapsedTime(entry.elapsedMs)}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">
                        {SIEGE_GAME_MODE_META[entry.mode].shortLabel} • {entry.topWeaponLabel} • {entry.bugsPerSecond.toFixed(2)} bugs/s
                      </div>
                    </div>
                    <div className="text-right text-[0.68rem] uppercase tracking-[0.14em] text-stone-500">
                      {index === 0 ? "Best" : "Run"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default SiegeRunCompleteOverlay;