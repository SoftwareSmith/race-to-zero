import { useEffect, useMemo, useRef, useState } from "react";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import Tooltip from "@shared/components/Tooltip";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { cn } from "@shared/utils/cn";
import type {
  SiegeWeaponId,
  StructureId,
  WeaponProgressSnapshot,
} from "@game/types";

const INPUT_MODE_LABEL: Record<string, string> = {
  click: "Click",
  directional: "Directional",
  seeking: "Auto-seek",
  hold: "Hold",
};

interface SiegeHudProps {
  className?: string;
  debugMode?: boolean;
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
  onExit: () => void;
  onSelectWeapon: (id: SiegeWeaponId) => void;
  onToggleDebugMode?: () => void;
  placedCountByType?: Partial<Record<StructureId, number>>;
  placingStructureId?: StructureId | null;
  selectedWeaponId: SiegeWeaponId;
  streakMultiplier: number;
  unlockedStructures?: StructureId[];
  weaponEvolutionToast?: string | null;
  weaponSnapshots: WeaponProgressSnapshot[];
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "h-3.5 w-3.5 text-stone-400 transition-transform duration-200",
        open ? "rotate-180" : "rotate-0",
      )}
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M3.5 6 8 10.5 12.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function weaponTooltip(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
): string {
  if (snapshot.locked) {
    return `${snapshot.progressText} — unlocks at ${snapshot.unlockKills} fixes`;
  }

  const mode = INPUT_MODE_LABEL[snapshot.inputMode] ?? snapshot.inputMode;
  const selected = isSelected ? " ✓" : "";
  const progress =
    snapshot.killsToNextTier != null
      ? ` · ${snapshot.killsToNextTier} kills → level ${snapshot.tier + 1}`
      : " · MAX LEVEL";

  return `${snapshot.title} [${mode}]${selected}${progress} — ${snapshot.hint}`;
}

function getSlotClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  return cn(
    "relative h-10 min-w-[2.35rem] overflow-hidden rounded-[10px] border px-0.5 py-1 text-sm text-stone-200 transition duration-200",
    isSelected
      ? "border-sky-300/40 bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(5,10,14,0.92))] shadow-[0_0_18px_rgba(56,189,248,0.16)]"
      : "",
    snapshot.locked
      ? "border-white/8 bg-black/18 opacity-80"
      : "border-white/10 bg-zinc-900/88 hover:border-white/16 hover:bg-zinc-900/96",
  );
}

function getWeaponButtonClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  if (isSelected) {
    return "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-sky-300/45 bg-sky-400/14 text-sky-50 !cursor-pointer shadow-[0_0_14px_rgba(56,189,248,0.14)]";
  }

  if (snapshot.locked) {
    return "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/6 bg-white/4 text-stone-500 opacity-65 !cursor-pointer";
  }

  return "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/10 bg-white/5 text-stone-100 !cursor-pointer transition duration-150 hover:border-sky-400/24 hover:bg-sky-500/8 hover:text-sky-100";
}

function getTierAccentClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "from-white/14 via-white/6 to-transparent";
  }

  if (snapshot.tier === 3) {
    return "from-amber-300/60 via-amber-200/18 to-transparent";
  }

  if (snapshot.tier === 2) {
    return "from-cyan-200/55 via-sky-300/16 to-transparent";
  }

  return "from-sky-300/50 via-sky-300/14 to-transparent";
}

function getTierProgress(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return 0;
  }

  if (snapshot.killsToNextTier == null) {
    return 100;
  }

  const progressWindow = snapshot.weaponKills + snapshot.killsToNextTier;
  if (progressWindow <= 0) {
    return 0;
  }

  return Math.min(100, (snapshot.weaponKills / progressWindow) * 100);
}

function getTierCopy(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return `Unlocks at ${snapshot.unlockKills} fixes`;
  }

  if (snapshot.killsToNextTier == null) {
    return `${snapshot.weaponKills} kills logged · max level online`;
  }

  return `${snapshot.weaponKills} kills logged · ${snapshot.killsToNextTier} to level ${snapshot.tier + 1}`;
}

function getTierProgressSummary(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return `0/${snapshot.unlockKills} to unlock`;
  }

  if (snapshot.killsToNextTier == null) {
    return "Max level reached";
  }

  const tierGoal = snapshot.weaponKills + snapshot.killsToNextTier;
  return `${snapshot.weaponKills}/${tierGoal} till next upgrade`;
}

function getTierProgressCompact(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return `0/${snapshot.unlockKills}`;
  }

  if (snapshot.killsToNextTier == null) {
    return "MAX";
  }

  const tierGoal = snapshot.weaponKills + snapshot.killsToNextTier;
  return `${snapshot.weaponKills}/${tierGoal}`;
}

function getStructureGlyph(structureId: StructureId) {
  if (structureId === "lantern") {
    return "🔦";
  }

  if (structureId === "turret") {
    return "🎯";
  }

  return "🤖";
}

export default function SiegeHud({
  className,
  debugMode = false,
  interactiveKills,
  interactivePoints,
  interactiveRemainingBugs,
  justEvolvedWeaponId,
  killStreak,
  lastFireTimes,
  onArmStructure,
  onExit,
  onSelectWeapon,
  onToggleDebugMode,
  placedCountByType,
  placingStructureId,
  selectedWeaponId,
  streakMultiplier,
  unlockedStructures,
  weaponEvolutionToast,
  weaponSnapshots,
}: SiegeHudProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [justUnlockedWeaponIds, setJustUnlockedWeaponIds] = useState<SiegeWeaponId[]>([]);
  const [justUnlockedStructureIds, setJustUnlockedStructureIds] = useState<StructureId[]>([]);
  const previousUnlockedWeaponIdsRef = useRef<Set<SiegeWeaponId>>(new Set());
  const previousUnlockedStructureIdsRef = useRef<Set<StructureId>>(new Set());
  const selectedSnapshot =
    weaponSnapshots.find((snapshot) => snapshot.id === selectedWeaponId) ??
    weaponSnapshots[0];
  const selectedProgress = selectedSnapshot
    ? getTierProgress(selectedSnapshot)
    : 0;
  const unlockedWeaponIds = useMemo(
    () => weaponSnapshots.filter((snapshot) => !snapshot.locked).map((snapshot) => snapshot.id),
    [weaponSnapshots],
  );
  const visibleStructureIds = useMemo(
    () => unlockedStructures ?? [],
    [unlockedStructures],
  );
  const weaponCount = weaponSnapshots.length;
  const structureCount = visibleStructureIds.length;
  const weaponSlotRem = 2.35;
  const structureSlotRem = 2;
  const railGapRem = 0.25;
  const sectionGapRem = 0.5;
  const dividerRem = structureCount > 0 ? 0.75 : 0;
  const weaponRailWidthRem = weaponCount * weaponSlotRem + Math.max(0, weaponCount - 1) * railGapRem;
  const structureRailWidthRem =
    structureCount > 0
      ? structureCount * structureSlotRem + Math.max(0, structureCount - 1) * railGapRem
      : 0;
  const toolbeltWidthRem = Math.max(
    26,
    weaponRailWidthRem + structureRailWidthRem + dividerRem + sectionGapRem + 1.5,
  );

  useEffect(() => {
    const currentUnlockedWeaponIds = new Set(unlockedWeaponIds);
    const previousUnlockedWeaponIds = previousUnlockedWeaponIdsRef.current;
    const newlyUnlockedWeaponIds = unlockedWeaponIds.filter(
      (weaponId) => !previousUnlockedWeaponIds.has(weaponId),
    );

    if (previousUnlockedWeaponIds.size > 0 && newlyUnlockedWeaponIds.length > 0) {
      setJustUnlockedWeaponIds(newlyUnlockedWeaponIds);
      window.setTimeout(() => setJustUnlockedWeaponIds([]), 1400);
    }

    previousUnlockedWeaponIdsRef.current = currentUnlockedWeaponIds;
  }, [unlockedWeaponIds]);

  useEffect(() => {
    const currentUnlockedStructureIds = new Set(visibleStructureIds);
    const previousUnlockedStructureIds = previousUnlockedStructureIdsRef.current;
    const newlyUnlockedStructureIds = visibleStructureIds.filter(
      (structureId) => !previousUnlockedStructureIds.has(structureId),
    );

    if (previousUnlockedStructureIds.size > 0 && newlyUnlockedStructureIds.length > 0) {
      setJustUnlockedStructureIds(newlyUnlockedStructureIds);
      window.setTimeout(() => setJustUnlockedStructureIds([]), 1400);
    }

    previousUnlockedStructureIdsRef.current = currentUnlockedStructureIds;
  }, [visibleStructureIds]);

  return (
    <div data-hud-cursor="default" data-no-hammer className={cn("select-none", className)}>
      <div className="pointer-events-none fixed left-3 top-3 z-[220] sm:left-4 sm:top-4">
        <div
          data-testid="siege-hud"
          data-hud-cursor="default"
          className="pointer-events-auto w-full max-w-[15rem] select-none !cursor-default [animation:hud-notch-arrive_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
        >
          <div className="relative overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(6,10,14,0.96),rgba(9,12,16,0.88))] px-2 py-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.12),transparent_34%),linear-gradient(90deg,rgba(248,113,113,0.04),transparent_38%,rgba(251,191,36,0.04))]" />

            <div className="relative flex items-start justify-between gap-2">
              <div className="grid flex-1 grid-cols-3 gap-1">
                <div className="rounded-[12px] border border-red-300/14 bg-red-500/[0.08] px-1.5 py-1 text-left">
                  <div className="text-[0.42rem] font-semibold uppercase tracking-[0.14em] text-red-100/70">
                  Bugs
                  </div>
                  <strong className="mt-0.5 block text-[0.82rem] font-semibold leading-none text-stone-50">
                    {interactiveRemainingBugs.toLocaleString()}
                  </strong>
                </div>
                <div className="rounded-[12px] border border-white/10 bg-white/[0.04] px-1.5 py-1 text-left">
                  <div className="text-[0.42rem] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Kills
                  </div>
                  <strong className="mt-0.5 block text-[0.82rem] font-semibold leading-none text-stone-50">
                    {interactiveKills.toLocaleString()}
                  </strong>
                </div>
                <div className="rounded-[12px] border border-amber-300/14 bg-amber-400/[0.08] px-1.5 py-1 text-left">
                  <div className="text-[0.42rem] font-semibold uppercase tracking-[0.14em] text-amber-100/70">
                  Pts
                  </div>
                  <strong className="mt-0.5 block text-[0.82rem] font-semibold leading-none text-stone-50">
                    {interactivePoints.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  data-no-hammer
                  data-hud-cursor="pointer"
                  aria-label={
                    debugMode ? "Disable siege debug mode" : "Enable siege debug mode"
                  }
                  aria-pressed={debugMode}
                  className={cn(
                    "inline-flex h-6 items-center justify-center rounded-full border px-1.5 text-[0.48rem] font-semibold uppercase tracking-[0.14em] !cursor-pointer transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40",
                    debugMode
                      ? "border-cyan-300/40 bg-cyan-400/18 text-cyan-100 hover:bg-cyan-400/24"
                      : "border-white/10 bg-white/[0.04] text-stone-400 hover:border-white/16 hover:bg-white/[0.08] hover:text-stone-100",
                  )}
                  onClick={onToggleDebugMode}
                  type="button"
                >
                  DBG
                </button>
                <button
                  data-no-hammer
                  data-hud-cursor="pointer"
                  aria-label="Back to dashboard"
                  className="inline-flex h-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-1.5 text-[0.48rem] font-semibold uppercase tracking-[0.14em] text-stone-200 !cursor-pointer transition duration-150 hover:border-white/16 hover:bg-white/[0.08] hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                  onClick={onExit}
                  type="button"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none mx-auto flex w-full max-w-[1120px] justify-center">
        <div
          className="pointer-events-auto relative z-[220] max-w-[calc(100vw-1.5rem)] select-none !cursor-default transition-[width,max-width] duration-300 [animation:hud-notch-arrive_420ms_cubic-bezier(0.22,1,0.36,1)_forwards] sm:max-w-[calc(100vw-19rem)]"
          style={{ width: `${toolbeltWidthRem}rem` }}
        >
          <div data-hud-cursor="default" className="relative overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(6,10,14,0.96),rgba(9,12,16,0.88))] px-2.5 py-1.5 shadow-[0_22px_54px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_48%)]" />

            <div className="relative">
              <div className="flex items-center gap-2">
                <div
                  data-no-hammer
                  className="grid min-w-0 flex-none grid-flow-col auto-cols-[2.35rem] gap-1"
                  role="radiogroup"
                  aria-label="Select weapon"
                  style={{ width: `${weaponRailWidthRem}rem` }}
                >
                  {weaponSnapshots.map((snapshot) => {
                    const isSelected = snapshot.id === selectedWeaponId;
                    const isEvolving = justEvolvedWeaponId === snapshot.id;
                    const isJustUnlocked = justUnlockedWeaponIds.includes(snapshot.id);
                    const slotProgress = getTierProgress(snapshot);

                    return (
                      <Tooltip
                        key={snapshot.id}
                        content={weaponTooltip(snapshot, isSelected)}
                      >
                        <div
                          data-hud-cursor="pointer"
                          className={getSlotClassName(snapshot, isSelected)}
                          data-current={isSelected ? "true" : "false"}
                          data-locked={snapshot.locked ? "true" : "false"}
                          data-testid={`weapon-${snapshot.id}`}
                          style={
                            isJustUnlocked
                              ? {
                                  animation:
                                    "hud-notch-arrive 420ms cubic-bezier(0.22,1,0.36,1), weapon-evolve 720ms cubic-bezier(0.34,1.56,0.64,1)",
                                }
                              : isEvolving
                              ? {
                                  animation:
                                    "weapon-evolve 720ms cubic-bezier(0.34,1.56,0.64,1) forwards",
                                }
                              : undefined
                          }
                        >
                          <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b opacity-70", getTierAccentClassName(snapshot))} />

                          <div className="relative flex h-full items-center justify-center">
                            {snapshot.locked ? (
                              <div
                                data-hud-cursor="pointer"
                                aria-label={`${snapshot.title} weapon (locked)`}
                                aria-checked={false}
                                role="radio"
                                className={getWeaponButtonClassName(snapshot, false)}
                              >
                                <WeaponGlyph className="h-4 w-4" id={snapshot.id} />
                              </div>
                            ) : (
                              <button
                                data-hud-cursor="pointer"
                                aria-label={`Select ${snapshot.title} weapon`}
                                aria-checked={isSelected}
                                role="radio"
                                type="button"
                                className={getWeaponButtonClassName(snapshot, isSelected)}
                                onClick={() => onSelectWeapon(snapshot.id)}
                              >
                                <WeaponGlyph className="h-4 w-4" id={snapshot.id} />
                              </button>
                            )}
                          </div>

                          <div className="mt-0.5 h-0.5 overflow-hidden rounded-full bg-white/8">
                            <div
                              className={cn(
                                "h-full rounded-full bg-[linear-gradient(90deg,rgba(34,197,94,0.75),rgba(56,189,248,0.95),rgba(251,191,36,0.95))] transition-[width] duration-300",
                                isSelected
                                  ? "[animation:hud-weapon-breathe_1800ms_ease-in-out_infinite]"
                                  : undefined,
                              )}
                              style={{ width: `${slotProgress}%` }}
                            />
                          </div>

                          {!snapshot.locked &&
                          snapshot.cooldownMs > 0 &&
                          lastFireTimes?.[snapshot.id] != null ? (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-[12px]">
                              <div
                                key={lastFireTimes[snapshot.id]}
                                className="h-full bg-sky-300/80"
                                style={{
                                  animation: `reload-drain ${snapshot.cooldownMs}ms linear forwards`,
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>

                {unlockedStructures && unlockedStructures.length > 0 ? (
                  <>
                    <div className="h-8 w-px shrink-0 bg-white/8" />
                    <div
                      data-no-hammer
                      className="flex shrink-0 items-center gap-1"
                      style={{ width: `${structureRailWidthRem}rem` }}
                    >
                      {STRUCTURE_DEFS.filter((s) => visibleStructureIds.includes(s.id)).map(
                        (structure) => {
                          const isArming = placingStructureId === structure.id;
                          const isJustUnlocked = justUnlockedStructureIds.includes(structure.id);
                          const placedCount = placedCountByType?.[structure.id] ?? 0;

                          return (
                            <Tooltip
                              key={structure.id}
                              content={`${structure.title} — ${structure.hint} (${placedCount}/${structure.maxPlaced} placed)`}
                            >
                              <button
                                data-hud-cursor="pointer"
                                aria-label={`${isArming ? "Cancel" : "Arm"} ${structure.title}`}
                                aria-pressed={isArming}
                                type="button"
                                className={cn(
                                  "relative inline-flex h-8 w-8 items-center justify-center rounded-[10px] border text-[0.72rem] !cursor-pointer transition duration-300 [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)]",
                                  isArming
                                    ? "border-amber-300/50 bg-amber-400/20 text-amber-100"
                                    : "border-amber-400/20 bg-amber-500/8 text-amber-100 hover:border-amber-400/40 hover:bg-amber-500/16",
                                )}
                                style={
                                  isJustUnlocked
                                    ? {
                                        animation:
                                          "hud-notch-arrive 420ms cubic-bezier(0.22,1,0.36,1), weapon-evolve 720ms cubic-bezier(0.34,1.56,0.64,1)",
                                      }
                                    : undefined
                                }
                                onClick={() => onArmStructure?.(structure.id)}
                              >
                                <span>{getStructureGlyph(structure.id)}</span>
                                {placedCount > 0 ? (
                                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[0.46rem] font-bold text-zinc-900">
                                    {placedCount}
                                  </span>
                                ) : null}
                              </button>
                            </Tooltip>
                          );
                        },
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {killStreak >= 3 || weaponEvolutionToast ? (
            <div className="pointer-events-none mt-2 flex justify-center">
              <div className="pointer-events-auto flex max-w-[24rem] items-center justify-center gap-2 rounded-[18px] border border-amber-300/24 bg-[linear-gradient(180deg,rgba(36,24,10,0.94),rgba(18,12,4,0.9))] px-3 py-1.5 text-center shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl">
                {killStreak >= 3 ? (
                  <span className="px-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-amber-100">
                    {`Streak x${streakMultiplier.toFixed(1)}`}
                  </span>
                ) : null}
                {weaponEvolutionToast ? (
                  <span className="text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-amber-200 [animation:evolve-toast_2600ms_ease_forwards]">
                    {weaponEvolutionToast}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selectedSnapshot ? (
        <div className="pointer-events-none fixed right-3 top-3 z-[220] w-[min(16.5rem,calc(100vw-1.5rem))] sm:right-4 sm:top-4">
          <div
            data-hud-cursor="default"
            className={cn(
              "pointer-events-auto relative overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,10,14,0.96),rgba(9,12,16,0.9))] p-2 select-none !cursor-default shadow-[0_20px_56px_rgba(0,0,0,0.34)] backdrop-blur-2xl",
              justEvolvedWeaponId === selectedSnapshot.id
                ? "[animation:hud-weapon-breathe_960ms_ease-out_1]"
                : "",
            )}
          >
            <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b opacity-85", getTierAccentClassName(selectedSnapshot))} />

            <button
              data-no-hammer
              data-hud-cursor="pointer"
              aria-expanded={detailsOpen}
              aria-label={detailsOpen ? "Collapse progress details" : "Expand progress details"}
              className="relative flex w-full items-center justify-between gap-2 rounded-[14px] bg-white/[0.04] px-2 py-1.5 text-left !cursor-pointer transition duration-150 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
              onClick={() => setDetailsOpen((value) => !value)}
              type="button"
            >
              <div className="min-w-0">
                <div className="text-[0.44rem] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Progress
                </div>
                <div className="mt-0.5 truncate font-display text-[0.9rem] leading-none tracking-[-0.04em] text-stone-50">
                  {selectedSnapshot.title}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[0.48rem] font-semibold uppercase tracking-[0.12em] text-stone-200">
                  {`Level ${selectedSnapshot.tier}`}
                </span>
                <span className="rounded-full border border-sky-300/18 bg-sky-400/[0.08] px-1.5 py-0.5 text-[0.48rem] font-semibold uppercase tracking-[0.12em] text-sky-100">
                  {getTierProgressCompact(selectedSnapshot)}
                </span>
                <ChevronIcon open={detailsOpen} />
              </div>
            </button>

            {detailsOpen ? (
              <div className="relative mt-2 space-y-2">
                <div className="text-[0.52rem] font-medium uppercase tracking-[0.12em] text-stone-400">
                  {getTierProgressSummary(selectedSnapshot)}
                </div>
                <div className="text-[0.52rem] uppercase tracking-[0.14em] text-stone-500">
                  {selectedSnapshot.typeLabel} · {INPUT_MODE_LABEL[selectedSnapshot.inputMode] ?? selectedSnapshot.inputMode}
                </div>

                <p className="text-[0.62rem] leading-4 text-stone-300">
                  {selectedSnapshot.hint}
                </p>

                <div className="rounded-[14px] border border-white/8 bg-black/22 p-2">
                  <div className="flex items-center justify-between gap-3 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-stone-500">
                    <span>Upgrade Progress</span>
                    <span>
                      {selectedSnapshot.killsToNextTier == null
                        ? "Max"
                        : `${selectedSnapshot.killsToNextTier} to next upgrade`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="relative h-full rounded-full bg-[linear-gradient(90deg,rgba(34,197,94,0.8),rgba(56,189,248,0.95),rgba(251,191,36,0.92))] transition-[width] duration-500"
                      style={{ width: `${selectedProgress}%` }}
                    >
                      <div className="absolute inset-y-0 left-0 w-8 bg-white/30 [animation:hud-progress-scan_1400ms_linear_infinite]" />
                    </div>
                  </div>
                  <div className="mt-1.5 text-[0.6rem] text-stone-300">
                    {getTierCopy(selectedSnapshot)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
