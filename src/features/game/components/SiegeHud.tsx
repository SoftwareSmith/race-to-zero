import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import CodexPanel from "@game/components/CodexPanel";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { getSiegeWeaponLabel } from "@game/progression/progression";
import Tooltip from "@shared/components/Tooltip";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { cn } from "@shared/utils/cn";
import type {
  SiegeGameMode,
  SiegeWeaponId,
  StructureId,
  WeaponProgressSnapshot,
} from "@game/types";
import { SIEGE_GAME_MODE_META } from "@game/types";
import {
  getSlotClassName,
  getStructureGlyph,
  getTierBarClassName,
  getTierProgress,
  getTierProgressCompact,
  getWeaponButtonClassName,
  INPUT_MODE_LABEL,
  weaponTooltip,
} from "./siegeHud.helpers";

const HUD_SHELL_CLASS_NAME =
  "relative overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(6,10,14,0.96),rgba(9,12,16,0.88))] backdrop-blur-2xl";

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

function formatElapsedTime(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function HudEventPill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.14em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function HudActionButton({
  active = false,
  children,
  onClick,
  tone = "default",
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger" | "info";
}) {
  const toneClassName = {
    danger: active
      ? "border-red-300/34 bg-red-400/16 text-red-50"
      : "border-red-300/16 bg-black/28 text-red-100/88 hover:border-red-300/28 hover:bg-red-500/[0.12]",
    info: active
      ? "border-cyan-300/34 bg-cyan-400/16 text-cyan-50"
      : "border-cyan-300/16 bg-black/28 text-cyan-100/88 hover:border-cyan-300/28 hover:bg-cyan-500/[0.12]",
    default: active
      ? "border-sky-300/34 bg-sky-400/16 text-sky-50"
      : "border-white/10 bg-black/28 text-stone-200 hover:border-white/18 hover:bg-white/[0.08] hover:text-stone-50",
  }[tone];

  return (
    <button
      data-no-hammer
      data-hud-cursor="pointer"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border text-stone-200 !cursor-pointer transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40",
        toneClassName,
      )}
      onClick={onClick}
      type="button"
    >
      <span className="shrink-0">{children}</span>
    </button>
  );
}

function HudShell({
  children,
  className,
  cursor = "default",
}: {
  children: ReactNode;
  className?: string;
  cursor?: "default" | "pointer";
}) {
  return (
    <div
      data-hud-cursor={cursor}
      className={cn(HUD_SHELL_CLASS_NAME, className)}
    >
      {children}
    </div>
  );
}

function WeaponRailSlot({
  isEvolving,
  isJustUnlocked,
  isSelected,
  lastFiredAt,
  onSelect,
  snapshot,
}: {
  isEvolving: boolean;
  isJustUnlocked: boolean;
  isSelected: boolean;
  lastFiredAt?: number;
  onSelect: (id: SiegeWeaponId) => void;
  snapshot: WeaponProgressSnapshot;
}) {
  const slotProgress = getTierProgress(snapshot);
  const tierBarClassName = getTierBarClassName(snapshot);

  return (
    <Tooltip content={weaponTooltip(snapshot, isSelected)}>
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
              onClick={() => onSelect(snapshot.id)}
            >
              <WeaponGlyph className="h-4 w-4" id={snapshot.id} />
            </button>
          )}
        </div>

        <div
          className={cn(
            "mt-0.5 h-0.5 overflow-hidden rounded-full transition duration-200",
            isSelected ? "bg-white/14" : "bg-white/8",
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              tierBarClassName,
              isSelected
                ? "[animation:hud-weapon-breathe_1800ms_ease-in-out_infinite]"
                : "opacity-72",
            )}
            style={{ width: `${slotProgress}%` }}
          />
        </div>

        {!snapshot.locked && snapshot.cooldownMs > 0 && lastFiredAt != null ? (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-[12px]">
            <div
              key={lastFiredAt}
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
}

function StructureRailSlot({
  isArming,
  isJustUnlocked,
  onArm,
  placedCount,
  structure,
}: {
  isArming: boolean;
  isJustUnlocked: boolean;
  onArm: (id: StructureId) => void;
  placedCount: number;
  structure: (typeof STRUCTURE_DEFS)[number];
}) {
  return (
    <Tooltip
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
        onClick={() => onArm(structure.id)}
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
  const previousUnlockedWeaponIdsRef = useRef<Set<SiegeWeaponId>>(new Set());
  const previousUnlockedStructureIdsRef = useRef<Set<StructureId>>(new Set());
  const selectedSnapshot =
    weaponSnapshots.find((snapshot) => snapshot.id === selectedWeaponId) ??
    weaponSnapshots[0];
  const selectedProgress = selectedSnapshot
    ? getTierProgress(selectedSnapshot)
    : 0;
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
  const toolbeltWidthRem = Math.max(
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
      className={cn("select-none", className)}
    >
      <div className="pointer-events-none fixed left-3 top-3 z-[220] sm:left-4 sm:top-4">
        <div
          data-testid="siege-hud-controls"
          data-hud-cursor="default"
          className="pointer-events-auto w-full max-w-[26rem] select-none !cursor-default [animation:hud-notch-arrive_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div
              aria-label="Siege mode"
              className="inline-flex rounded-full border border-white/8 bg-black/28 p-0.5 shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl"
              role="tablist"
            >
              {(["purge", "outbreak"] as const).map((mode) => {
                const meta = SIEGE_GAME_MODE_META[mode];
                const selected = mode === gameMode;

                return (
                  <Tooltip key={mode} content={meta.description}>
                    <button
                      aria-selected={selected}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[0.74rem] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40",
                        selected
                          ? "bg-sky-400/8 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]"
                          : "text-stone-400 hover:bg-white/4 hover:text-stone-100",
                      )}
                      onClick={() => onChangeGameMode?.(mode)}
                      role="tab"
                      type="button"
                    >
                      {meta.shortLabel}
                    </button>
                  </Tooltip>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              {codexMenuRef && onToggleCodex ? (
                <CodexPanel
                  containerRef={codexMenuRef}
                  onMenuToggle={onToggleCodex}
                  open={codexOpen}
                  trigger={
                    <Tooltip content="Open codex">
                      <HudActionButton
                        active={codexOpen}
                        onClick={onToggleCodex}
                      >
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.7"
                          viewBox="0 0 24 24"
                        >
                          <path d="M5.5 5.5A2.5 2.5 0 0 1 8 3h10.5v15.5A2.5 2.5 0 0 0 16 16H5.5Z" />
                          <path d="M8 3.5v12.3A2.2 2.2 0 0 0 10.2 18H18" />
                          <path d="M10.1 7.2h5.8M10.1 10.4h5.8" />
                        </svg>
                      </HudActionButton>
                    </Tooltip>
                  }
                />
              ) : null}

              {onToggleDebugMode ? (
                <Tooltip content="Toggle debug overlay">
                  <HudActionButton
                    active={debugMode}
                    onClick={onToggleDebugMode}
                    tone="info"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <rect x="6" y="7" width="12" height="11" rx="2" />
                      <path d="M9 7V5a3 3 0 0 1 6 0v2M4 11h2m12 0h2" />
                    </svg>
                  </HudActionButton>
                </Tooltip>
              ) : null}

              <Tooltip content="Exit siege">
                <HudActionButton onClick={onExit} tone="danger">
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path d="M15 18 9 12l6-6" />
                    <path d="M9 12h10" />
                  </svg>
                </HudActionButton>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-[4.65rem] z-[220] flex justify-center px-3 sm:top-4">
        <div className="pointer-events-auto w-full max-w-[28rem] select-none !cursor-default [animation:hud-notch-arrive_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
          <HudShell className="px-2 py-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.11),transparent_30%),linear-gradient(90deg,rgba(248,113,113,0.05),transparent_34%,rgba(251,191,36,0.05))]" />

            <div className="relative space-y-1.5">
              <div className="flex items-stretch rounded-full border border-white/8 bg-black/18 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="grid min-w-0 flex-1 grid-cols-4 gap-1">
                  <div className="flex min-w-0 items-center gap-2 rounded-full px-2 py-1.5">
                    <span className="text-[0.43rem] font-semibold uppercase tracking-[0.14em] text-red-100/65">
                      {bugsLabel}
                    </span>
                    <strong className="truncate font-display text-[0.9rem] leading-none tracking-[-0.04em] text-stone-50">
                      {interactiveRemainingBugs.toLocaleString()}
                    </strong>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 rounded-full border-l border-white/6 px-2 py-1.5">
                    <span className="text-[0.43rem] font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Kills
                    </span>
                    <strong className="truncate font-display text-[0.9rem] leading-none tracking-[-0.04em] text-stone-50">
                      {interactiveKills.toLocaleString()}
                    </strong>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 rounded-full border-l border-white/6 px-2 py-1.5">
                    <span className="text-[0.43rem] font-semibold uppercase tracking-[0.14em] text-amber-100/65">
                      Points
                    </span>
                    <strong className="truncate font-display text-[0.9rem] leading-none tracking-[-0.04em] text-stone-50">
                      {interactivePoints.toLocaleString()}
                    </strong>
                  </div>
                  <Tooltip
                    content={
                      gameMode === "purge"
                        ? "Elapsed clear time."
                        : "Elapsed survival time."
                    }
                  >
                    <div className="flex min-w-0 items-center justify-center gap-2 rounded-full border border-cyan-300/12 bg-cyan-500/[0.08] px-2 py-1.5 text-center">
                      <span className="text-[0.43rem] font-semibold uppercase tracking-[0.14em] text-cyan-100/65">
                        Time
                      </span>
                      <strong className="font-display text-[0.94rem] leading-none tracking-[-0.05em] text-stone-50">
                        {timerValue}
                      </strong>
                    </div>
                  </Tooltip>
                </div>
              </div>

              {killStreak >= 3 || unlockToast || upgradeToast ? (
                <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5 text-center">
                  {killStreak >= 3 ? (
                    <HudEventPill className="border-amber-300/24 bg-amber-400/10 text-amber-100">
                      {`Streak x${streakMultiplier.toFixed(1)}`}
                    </HudEventPill>
                  ) : null}
                  {unlockToast ? (
                    <HudEventPill className="border-emerald-300/24 bg-emerald-400/10 text-emerald-100 [animation:evolve-toast_2600ms_ease_forwards]">
                      {unlockToast}
                    </HudEventPill>
                  ) : null}
                  {upgradeToast ? (
                    <HudEventPill className="border-sky-300/24 bg-sky-400/10 text-sky-100 [animation:evolve-toast_2600ms_ease_forwards]">
                      {upgradeToast}
                    </HudEventPill>
                  ) : null}
                </div>
              ) : null}
            </div>
          </HudShell>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[220] flex justify-center px-3 sm:bottom-4">
        <div
          className="pointer-events-auto relative z-[220] max-w-[calc(100vw-1.5rem)] select-none !cursor-default transition-[width,max-width] duration-300 [animation:hud-notch-arrive_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
          style={{ width: `${toolbeltWidthRem}rem` }}
        >
          <HudShell className="px-2.5 py-2 shadow-[0_22px_54px_rgba(0,0,0,0.38)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_48%)]" />

            <div className="relative space-y-2">
              {selectedSnapshot ? (
                <div className="flex items-start justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.05] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[0.96rem] leading-none tracking-[-0.04em] text-stone-50">
                      {selectedSnapshot.title}
                    </div>
                    <div className="mt-1 text-[0.52rem] uppercase tracking-[0.14em] text-stone-500">
                      {selectedSnapshot.typeLabel} ·{" "}
                      {INPUT_MODE_LABEL[selectedSnapshot.inputMode] ??
                        selectedSnapshot.inputMode}
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className={cn(
                          "relative h-full rounded-full transition-[width] duration-500",
                          getTierBarClassName(selectedSnapshot),
                        )}
                        style={{ width: `${selectedProgress}%` }}
                      >
                        <div className="absolute inset-y-0 left-0 w-8 bg-white/30 [animation:hud-progress-scan_1400ms_linear_infinite]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <span className="rounded-full border border-white/10 bg-black/22 px-1.5 py-0.5 text-[0.48rem] font-semibold uppercase tracking-[0.12em] text-stone-200">
                      {`Level ${selectedSnapshot.tier}`}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[0.48rem] font-semibold uppercase tracking-[0.12em] text-stone-100">
                      {getTierProgressCompact(selectedSnapshot)}
                    </span>
                  </div>
                </div>
              ) : null}

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

                    return (
                      <WeaponRailSlot
                        key={snapshot.id}
                        isEvolving={justEvolvedWeaponId === snapshot.id}
                        isJustUnlocked={justUnlockedWeaponIds.includes(
                          snapshot.id,
                        )}
                        isSelected={isSelected}
                        lastFiredAt={lastFireTimes?.[snapshot.id]}
                        onSelect={onSelectWeapon}
                        snapshot={snapshot}
                      />
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
                      {STRUCTURE_DEFS.filter((structure) =>
                        visibleStructureIds.includes(structure.id),
                      ).map((structure) => {
                        const isArming = placingStructureId === structure.id;
                        const isJustUnlocked =
                          justUnlockedStructureIds.includes(structure.id);
                        const placedCount =
                          placedCountByType?.[structure.id] ?? 0;

                        return onArmStructure ? (
                          <StructureRailSlot
                            key={structure.id}
                            isArming={isArming}
                            isJustUnlocked={isJustUnlocked}
                            onArm={onArmStructure}
                            placedCount={placedCount}
                            structure={structure}
                          />
                        ) : null;
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </HudShell>
        </div>
      </div>
    </div>
  );
}
