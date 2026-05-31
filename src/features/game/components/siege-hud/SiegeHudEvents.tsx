import { HudEventPill } from "./shared";

interface SiegeHudEventsProps {
  killStreak: number;
  streakMultiplier: number;
  survivalWarningLabel?: string | null;
  survivalWaveToast?: string | null;
  unlockToast?: string | null;
  upgradeToast?: string | null;
}

export default function SiegeHudEvents({
  killStreak,
  streakMultiplier,
  survivalWarningLabel,
  survivalWaveToast,
  unlockToast,
  upgradeToast,
}: SiegeHudEventsProps) {
  if (
    killStreak < 3 &&
    !unlockToast &&
    !upgradeToast &&
    !survivalWaveToast &&
    !survivalWarningLabel
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[6.05rem] z-[220] flex justify-center px-3 sm:top-[4.95rem]">
      <div className="mt-0.25 flex flex-wrap items-center justify-center gap-1.25 text-center">
        {killStreak >= 3 ? (
          <HudEventPill className="border-amber-300/24 bg-amber-400/10 text-amber-100">
            {`Streak x${streakMultiplier.toFixed(1)}`}
          </HudEventPill>
        ) : null}
        {unlockToast ? (
          <HudEventPill className="border-emerald-300/24 bg-emerald-400/10 text-emerald-100 [animation:evolve-toast_2200ms_ease_forwards]">
            {unlockToast}
          </HudEventPill>
        ) : null}
        {upgradeToast ? (
          <HudEventPill className="border-orange-300/24 bg-red-500/10 text-orange-100 [animation:evolve-toast_2200ms_ease_forwards]">
            {upgradeToast}
          </HudEventPill>
        ) : null}
        {survivalWaveToast ? (
          <HudEventPill className="border-sky-300/24 bg-sky-300/10 text-sky-100">
            <span data-testid="siege-wave-toast">{survivalWaveToast}</span>
          </HudEventPill>
        ) : null}
        {survivalWarningLabel ? (
          <HudEventPill className="border-red-300/24 bg-red-500/10 text-red-100 [animation:heat-tier-pulse_1400ms_ease-in-out_infinite]">
            <span data-testid="siege-offline-warning">
              {survivalWarningLabel}
            </span>
          </HudEventPill>
        ) : null}
      </div>
    </div>
  );
}
