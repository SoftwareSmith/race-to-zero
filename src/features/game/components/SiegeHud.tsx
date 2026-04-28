import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getSiegeWeaponLabel } from "@game/progression/progression";
import { cn } from "@shared/utils/cn";
import type {
  SiegeGameMode,
  SiegeWeaponId,
  WeaponProgressSnapshot,
} from "@game/types";
import SiegeHudControls from "./siege-hud/SiegeHudControls";
import SiegeHudLoadout from "./siege-hud/SiegeHudLoadout";
import { HudEventPill, HudShell } from "./siege-hud/shared";
import { formatElapsedTime } from "./siege-hud/formatElapsedTime";

interface SiegeHudProps {
  className?: string;
  codexMenuRef?: RefObject<HTMLDivElement | null>;
  codexOpen?: boolean;
  debugMode?: boolean;
  elapsedMs?: number;
  gameMode: SiegeGameMode;
  interactiveKills: number;
  interactivePoints: number;
  interactiveRemainingBugs: number;
  justEvolvedWeaponId?: SiegeWeaponId | null;
  killStreak: number;
  lastFireTimes?: Partial<Record<SiegeWeaponId, number>>;
  nextWeaponUnlock?: {
    current: number;
    remaining: number;
    unlockKills: number;
    weaponId: SiegeWeaponId;
    weaponTitle: string;
  } | null;
  onChangeGameMode?: (mode: SiegeGameMode) => void;
  onExit: () => void;
  onKillAllBugs?: () => void;
  onToggleCodex?: () => void;
  onSelectWeapon: (id: SiegeWeaponId) => void;
  onToggleDebugMode?: () => void;
  selectedWeaponId: SiegeWeaponId;
  streakMultiplier: number;
  survivalStatus?: {
    focusLabel: string;
    pressurePercent: number;
    runtimeSpeedMultiplier: number;
    secondsUntilNextWave: number | null;
    secondsUntilOffline: number | null;
    siteIntegrity: number;
    spawnRatePerSecond: number;
    tacticLabel: string;
    wave: number;
  };
  upgradeToast?: string | null;
  weaponSnapshots: WeaponProgressSnapshot[];
}

export default function SiegeHud({
  className,
  codexMenuRef,
  codexOpen = false,
  debugMode = false,
  elapsedMs = 0,
  gameMode,
  interactiveKills,
  interactiveRemainingBugs,
  justEvolvedWeaponId,
  killStreak,
  lastFireTimes,
  onChangeGameMode,
  onExit,
  onKillAllBugs,
  onToggleCodex,
  onSelectWeapon,
  onToggleDebugMode,
  selectedWeaponId,
  streakMultiplier,
  survivalStatus,
  upgradeToast,
  weaponSnapshots,
}: SiegeHudProps) {
  const [justUnlockedWeaponIds, setJustUnlockedWeaponIds] = useState<
    SiegeWeaponId[]
  >([]);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const previousUnlockedWeaponIdsRef = useRef<Set<SiegeWeaponId>>(new Set());
  const selectedSnapshot =
    weaponSnapshots.find((snapshot) => snapshot.id === selectedWeaponId) ??
    weaponSnapshots[0];
  const unlockedWeaponIds = useMemo(
    () =>
      weaponSnapshots
        .filter((snapshot) => !snapshot.locked)
        .map((snapshot) => snapshot.id),
    [weaponSnapshots],
  );
  const unlockToast = useMemo(() => {
    if (justUnlockedWeaponIds.length === 0) {
      return null;
    }

    return `New ${getSiegeWeaponLabel(
      justUnlockedWeaponIds[justUnlockedWeaponIds.length - 1],
    )} weapon unlocked`;
  }, [justUnlockedWeaponIds]);
  const timerValue = formatElapsedTime(elapsedMs);
  const bugsPerSecond =
    elapsedMs > 0
      ? Number(((interactiveKills * 1000) / elapsedMs).toFixed(1))
      : 0;
  const isSurvival = gameMode === "outbreak";
  const [survivalWaveToast, setSurvivalWaveToast] = useState<string | null>(
    null,
  );
  const survivalIntegrityPercent = Math.max(
    0,
    Math.min(100, Math.round(survivalStatus?.siteIntegrity ?? 100)),
  );
  const spawnRateLabel = `${(survivalStatus?.spawnRatePerSecond ?? 0).toFixed(1)}/s`;
  const waveLabel = `${survivalStatus?.wave ?? 1}`;
  const previousSurvivalWaveRef = useRef<number | null>(null);
  const survivalWarningLabel =
    isSurvival &&
    survivalStatus?.secondsUntilOffline != null &&
    survivalStatus.secondsUntilOffline <= 12 &&
    survivalIntegrityPercent > 0
      ? `Site critical • ${survivalStatus.secondsUntilOffline}s to offline`
      : null;

  useEffect(() => {
    return () => {
      document.body.classList.remove("hud-system-cursor-active");
    };
  }, []);

  const showSystemCursor = () => {
    document.body.classList.add("hud-system-cursor-active");
  };

  const hideSystemCursor = () => {
    document.body.classList.remove("hud-system-cursor-active");
  };

  useEffect(() => {
    const currentUnlockedWeaponIds = new Set(unlockedWeaponIds);
    const previousUnlockedWeaponIds = previousUnlockedWeaponIdsRef.current;
    const newlyUnlockedWeaponIds = unlockedWeaponIds.filter(
      (weaponId) => !previousUnlockedWeaponIds.has(weaponId),
    );

    if (
      previousUnlockedWeaponIds.size > 0 &&
      newlyUnlockedWeaponIds.length > 0
    ) {
      setJustUnlockedWeaponIds(newlyUnlockedWeaponIds);
      window.setTimeout(() => setJustUnlockedWeaponIds([]), 1400);
    }

    previousUnlockedWeaponIdsRef.current = currentUnlockedWeaponIds;
  }, [unlockedWeaponIds]);

  useEffect(() => {
    if (!isSurvival) {
      previousSurvivalWaveRef.current = null;
      return undefined;
    }

    const nextWave = survivalStatus?.wave ?? 1;
    if (previousSurvivalWaveRef.current === nextWave) {
      return undefined;
    }

    previousSurvivalWaveRef.current = nextWave;
    const nextToast = [
      `Wave ${nextWave}`,
      survivalStatus?.tacticLabel,
      survivalStatus?.focusLabel,
    ]
      .filter(Boolean)
      .join(" • ");
    const showTimeoutId = window.setTimeout(() => {
      setSurvivalWaveToast(nextToast);
    }, 0);
    const timeoutId = window.setTimeout(() => {
      setSurvivalWaveToast((current) =>
        current === nextToast ? null : current,
      );
    }, 2200);

    return () => {
      window.clearTimeout(showTimeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [
    isSurvival,
    survivalStatus?.focusLabel,
    survivalStatus?.tacticLabel,
    survivalStatus?.wave,
  ]);

  return (
    <div
      data-hud-cursor="default"
      data-no-hammer
      className={cn("pointer-events-none fixed inset-0 select-none", className)}
    >
      {isSurvival ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[220] flex justify-start px-3 sm:top-4">
          <HudShell className="pointer-events-auto border-transparent bg-[linear-gradient(180deg,rgba(8,11,16,0.88),rgba(9,12,16,0.68))] overflow-visible px-1.5 py-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.34)] [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
            <div className="grid min-w-0 grid-cols-[4.2rem_4.8rem_minmax(0,7.8rem)] gap-1">
              <div
                className="rounded-full border border-emerald-300/12 bg-emerald-400/[0.08] px-2 py-1.5"
                data-testid="siege-wave-stat"
              >
                <span className="block text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-emerald-100/65">
                  Wave
                </span>
                <strong className="mt-1 block font-display text-[0.88rem] leading-none tracking-[-0.04em] text-stone-50">
                  {waveLabel}
                </strong>
              </div>

              <div
                className="rounded-full border border-amber-300/12 bg-amber-400/[0.08] px-2 py-1.5"
                data-testid="siege-spawn-rate-stat"
              >
                <span className="block text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-amber-100/65">
                  Rate
                </span>
                <strong className="mt-1 block font-display text-[0.88rem] leading-none tracking-[-0.04em] text-stone-50">
                  {spawnRateLabel}
                </strong>
              </div>

              <div
                className="rounded-full border border-white/10 bg-black/22 px-2 py-1.5"
                data-testid="siege-offline-pressure"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    Site online
                  </span>
                  <strong className="font-display text-[0.76rem] leading-none tracking-[-0.04em] text-stone-50">
                    {survivalStatus?.secondsUntilOffline != null
                      ? `${survivalStatus.secondsUntilOffline}s`
                      : `${survivalIntegrityPercent}%`}
                  </strong>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-red-950/60">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#7dd3fc)] transition-[width] duration-300"
                    style={{ width: `${survivalIntegrityPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </HudShell>
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 top-3 z-[220] flex justify-end px-3 sm:top-4">
        <HudShell className="pointer-events-auto overflow-visible px-2.5 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.34)] [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
          <SiegeHudControls
            codexMenuRef={codexMenuRef}
            codexOpen={codexOpen}
            debugMode={debugMode}
            gameMode={gameMode}
            onChangeGameMode={onChangeGameMode}
            onExit={onExit}
            onKillAllBugs={onKillAllBugs}
            onToggleCodex={onToggleCodex}
            onToggleDebugMode={onToggleDebugMode}
            onPointerEnterHud={showSystemCursor}
            onPointerLeaveHud={hideSystemCursor}
          />
        </HudShell>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-[4.65rem] z-[220] flex justify-center px-3 sm:top-4">
        <HudShell
          className={cn(
            "pointer-events-auto border-transparent bg-[linear-gradient(180deg,rgba(8,11,16,0.88),rgba(9,12,16,0.68))] overflow-visible px-1.5 py-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.38)] [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]",
            isSurvival ? "w-full max-w-[25.25rem]" : "w-full max-w-[32rem]",
          )}
          data-testid="siege-hud"
          onPointerEnter={showSystemCursor}
          onPointerLeave={hideSystemCursor}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.09),transparent_34%),linear-gradient(90deg,rgba(248,113,113,0.04),transparent_34%,rgba(251,191,36,0.04))]" />

          <div className="relative">
            <div
              className={cn(
                "grid min-w-0 gap-1",
                isSurvival
                  ? "grid-cols-[5.4rem_5.4rem_6.9rem]"
                  : "grid-cols-[5.4rem_5.4rem_6.9rem_6.25rem]",
              )}
            >
              <div
                className="flex min-w-0 flex-col justify-center rounded-full px-2 py-1.5"
                data-testid="siege-remaining-stat"
              >
                <span className="block text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-red-100/65">
                  {gameMode === "outbreak" ? "Alive" : "Left"}
                </span>
                <strong className="mt-1 block font-display text-[0.88rem] leading-none tracking-[-0.04em] text-stone-50">
                  {interactiveRemainingBugs.toLocaleString()}
                </strong>
              </div>

              <div
                className="flex min-w-0 flex-col justify-center rounded-full border-l border-white/6 px-2 py-1.5"
                data-testid="siege-kills-stat"
              >
                <span className="block text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Kills
                </span>
                <strong className="mt-1 block font-display text-[0.88rem] leading-none tracking-[-0.04em] text-stone-50">
                  {interactiveKills.toLocaleString()}
                </strong>
              </div>

              <div
                className={cn(
                  "rounded-full px-2 py-1.5",
                  isSurvival
                    ? "border-l border-white/6"
                    : "border border-cyan-300/12 bg-cyan-500/[0.08]",
                )}
                data-testid="siege-time-stat"
              >
                <span className="block text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-cyan-100/65">
                  Time
                </span>
                <strong className="mt-1 block font-display text-[0.88rem] leading-none tracking-[-0.05em] tabular-nums text-stone-50">
                  {timerValue}
                </strong>
              </div>

              {!isSurvival ? (
                <div
                  className="rounded-full border border-amber-300/12 bg-amber-400/[0.08] px-2 py-1.5"
                  data-testid="siege-kill-rate-stat"
                >
                  <span className="block text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-amber-100/65">
                    Bugs/s
                  </span>
                  <strong className="mt-1 block font-display text-[0.88rem] leading-none tracking-[-0.04em] text-stone-50">
                    {bugsPerSecond.toFixed(1)}
                  </strong>
                </div>
              ) : null}
            </div>
          </div>
        </HudShell>
      </div>

      {killStreak >= 3 ||
      unlockToast ||
      upgradeToast ||
      survivalWaveToast ||
      survivalWarningLabel ? (
        <div className="pointer-events-none fixed inset-x-0 top-[7.15rem] z-[220] flex justify-center px-3 sm:top-[5.95rem]">
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1 text-center">
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
      ) : null}

      <SiegeHudLoadout
        justEvolvedWeaponId={justEvolvedWeaponId}
        justUnlockedWeaponIds={justUnlockedWeaponIds}
        lastFireTimes={lastFireTimes}
        onSelectWeapon={onSelectWeapon}
        progressExpanded={progressExpanded}
        selectedSnapshot={selectedSnapshot}
        selectedWeaponId={selectedWeaponId}
        setProgressExpanded={setProgressExpanded}
        weaponSnapshots={weaponSnapshots}
      />
    </div>
  );
}
