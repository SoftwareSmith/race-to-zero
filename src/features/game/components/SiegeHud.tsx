import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getSiegeWeaponLabel } from "@game/progression/progression";
import { cn } from "@shared/utils/cn";
import type {
  SiegeGameMode,
  SiegeWeaponId,
  StructureId,
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
  onArmStructure?: (id: StructureId) => void;
  onChangeGameMode?: (mode: SiegeGameMode) => void;
  onExit: () => void;
  onKillAllBugs?: () => void;
  onToggleCodex?: () => void;
  onSelectWeapon: (id: SiegeWeaponId) => void;
  onToggleDebugMode?: () => void;
  placedCountByType?: Partial<Record<StructureId, number>>;
  placingStructureId?: StructureId | null;
  selectedWeaponId: SiegeWeaponId;
  streakMultiplier: number;
  upgradeToast?: string | null;
  unlockedStructures?: StructureId[];
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
  onArmStructure,
  onChangeGameMode,
  onExit,
  onKillAllBugs,
  onToggleCodex,
  onSelectWeapon,
  onToggleDebugMode,
  placedCountByType,
  placingStructureId,
  selectedWeaponId,
  streakMultiplier,
  upgradeToast,
  unlockedStructures,
  weaponSnapshots,
}: SiegeHudProps) {
  const [justUnlockedWeaponIds, setJustUnlockedWeaponIds] = useState<
    SiegeWeaponId[]
  >([]);
  const [justUnlockedStructureIds, setJustUnlockedStructureIds] = useState<
    StructureId[]
  >([]);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const previousUnlockedWeaponIdsRef = useRef<Set<SiegeWeaponId>>(new Set());
  const previousUnlockedStructureIdsRef = useRef<Set<StructureId>>(new Set());
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
  const visibleStructureIds = useMemo(
    () => unlockedStructures ?? [],
    [unlockedStructures],
  );
  const unlockToast = useMemo(() => {
    if (justUnlockedWeaponIds.length === 0) {
      return null;
    }

    return `New ${getSiegeWeaponLabel(
      justUnlockedWeaponIds[justUnlockedWeaponIds.length - 1],
    )} weapon unlocked`;
  }, [justUnlockedWeaponIds]);
  const weaponCount = weaponSnapshots.length;
  const structureCount = visibleStructureIds.length;
  const weaponSlotRem = 2.35;
  const structureSlotRem = 2;
  const railGapRem = 0.25;
  const sectionGapRem = 0.5;
  const dividerRem = structureCount > 0 ? 0.75 : 0;
  const weaponRailWidthRem =
    weaponCount * weaponSlotRem + Math.max(0, weaponCount - 1) * railGapRem;
  const structureRailWidthRem =
    structureCount > 0
      ? structureCount * structureSlotRem +
        Math.max(0, structureCount - 1) * railGapRem
      : 0;
  const _toolbeltWidthRem = Math.max(
    26,
    weaponRailWidthRem +
      structureRailWidthRem +
      dividerRem +
      sectionGapRem +
      1.5,
  );
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

  useEffect(() => {
    const currentUnlockedStructureIds = new Set(visibleStructureIds);
    const previousUnlockedStructureIds =
      previousUnlockedStructureIdsRef.current;
    const newlyUnlockedStructureIds = visibleStructureIds.filter(
      (structureId) => !previousUnlockedStructureIds.has(structureId),
    );

    if (
      previousUnlockedStructureIds.size > 0 &&
      newlyUnlockedStructureIds.length > 0
    ) {
      setJustUnlockedStructureIds(newlyUnlockedStructureIds);
      window.setTimeout(() => setJustUnlockedStructureIds([]), 1400);
    }

    previousUnlockedStructureIdsRef.current = currentUnlockedStructureIds;
  }, [visibleStructureIds]);

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
        justUnlockedStructureIds={justUnlockedStructureIds}
        justUnlockedWeaponIds={justUnlockedWeaponIds}
        lastFireTimes={lastFireTimes}
        onArmStructure={onArmStructure}
        onSelectWeapon={onSelectWeapon}
        placedCountByType={placedCountByType}
        placingStructureId={placingStructureId}
        progressExpanded={progressExpanded}
        selectedSnapshot={selectedSnapshot}
        selectedWeaponId={selectedWeaponId}
        setProgressExpanded={setProgressExpanded}
        unlockedStructures={unlockedStructures}
        weaponSnapshots={weaponSnapshots}
      />
    </div>
  );
}
