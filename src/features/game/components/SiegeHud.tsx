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
import SiegeHudStats from "./siege-hud/SiegeHudStats";
import { HudEventPill } from "./siege-hud/shared";
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
  interactivePoints,
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
  const bugsLabel = gameMode === "outbreak" ? "Infection" : "Bugs";

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

  return (
    <div
      data-hud-cursor="default"
      data-no-hammer
      className={cn("pointer-events-none fixed inset-0 select-none", className)}
    >
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

      <SiegeHudStats
        bugsLabel={bugsLabel}
        gameMode={gameMode}
        interactiveKills={interactiveKills}
        interactivePoints={interactivePoints}
        interactiveRemainingBugs={interactiveRemainingBugs}
        timerValue={timerValue}
      />

      {killStreak >= 3 || unlockToast || upgradeToast ? (
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
