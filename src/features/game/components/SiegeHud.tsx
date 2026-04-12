import Tooltip from "@shared/components/Tooltip";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { STRUCTURE_DEFS } from "@config/structureConfig";
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

function weaponTooltip(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
): string {
  if (snapshot.locked) {
    return snapshot.progressText;
  }
  const mode = INPUT_MODE_LABEL[snapshot.inputMode] ?? snapshot.inputMode;
  const selected = isSelected ? " ✓" : "";
  const tierLabel = snapshot.tier >= 2 ? ` [T${snapshot.tier}]` : "";
  const progress =
    snapshot.killsToNextTier != null
      ? ` · ${snapshot.killsToNextTier} kills → T${snapshot.tier + 1}`
      : " · MAX TIER";
  return `${snapshot.title} [${mode}]${tierLabel}${selected}${progress} — ${snapshot.hint}`;
}

interface SiegeHudProps {
  className?: string;
  debugMode?: boolean;
  interactiveKills: number;
  interactivePoints: number;
  interactiveRemainingBugs: number;
  /** Weapon ID that just evolved — drives the wiggle+burst animation. */
  justEvolvedWeaponId?: SiegeWeaponId | null;
  lastFireTimes?: Partial<Record<SiegeWeaponId, number>>;
  onArmStructure?: (id: StructureId) => void;
  onExit: () => void;
  onSelectWeapon: (id: SiegeWeaponId) => void;
  onToggleDebugMode?: () => void;
  placedCountByType?: Partial<Record<StructureId, number>>;
  placingStructureId?: StructureId | null;
  selectedWeaponId: SiegeWeaponId;
  unlockedStructures?: StructureId[];
  weaponSnapshots: WeaponProgressSnapshot[];
}

/** Outer slot wrapper — colour-coded by tier (bronze/silver/gold). */
function getTierSlotClassName(snapshot: WeaponProgressSnapshot) {
  const base = "relative rounded-[14px] border p-1.5 text-sm text-stone-200";
  if (!snapshot.locked) {
    if (snapshot.tier >= 3) {
      // Gold  — T3
      return cn(
        base,
        "border-amber-400/48 bg-[linear-gradient(135deg,rgba(180,83,9,0.24),rgba(24,24,27,0.92))] shadow-[0_0_18px_rgba(251,191,36,0.18)]",
      );
    }
    if (snapshot.tier >= 2) {
      // Silver — T2
      return cn(
        base,
        "border-slate-300/48 bg-[linear-gradient(135deg,rgba(148,163,184,0.2),rgba(24,24,27,0.92))] shadow-[0_0_14px_rgba(148,163,184,0.14)]",
      );
    }

    // Bronze — T1
    return cn(
      base,
      "border-orange-400/38 bg-[linear-gradient(135deg,rgba(154,52,18,0.2),rgba(24,24,27,0.92))] shadow-[0_0_12px_rgba(249,115,22,0.12)]",
    );
  }

  // Locked weapons stay neutral.
  return cn(base, "border-white/8 bg-black/18");
}

function getWeaponButtonClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  if (isSelected) {
    return "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-300/40 bg-sky-400/16 text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.18)]";
  }

  if (snapshot.locked) {
    return "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/6 bg-white/4 text-stone-500 opacity-65";
  }

  return "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-stone-100 transition-colors duration-150 hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-sky-100";
}

export default function SiegeHud({
  className,
  debugMode = false,
  interactiveKills,
  interactivePoints,
  interactiveRemainingBugs,
  justEvolvedWeaponId,
  lastFireTimes,
  onArmStructure,
  onExit,
  onSelectWeapon,
  onToggleDebugMode,
  placedCountByType,
  placingStructureId,
  selectedWeaponId,
  unlockedStructures,
  weaponSnapshots,
}: SiegeHudProps) {
  return (
    <div data-no-hammer data-testid="siege-hud" className={className}>
      <div className="grid gap-2 rounded-[20px] border border-white/12 bg-zinc-950/92 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex items-stretch gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-4 gap-2">
            <div className="rounded-[16px] border border-red-300/14 bg-[linear-gradient(135deg,rgba(127,29,29,0.26),rgba(24,24,27,0.92))] px-3 py-2.5">
              <div className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-red-200/75">
                Bugs
              </div>
              <strong className="mt-1 block text-lg font-semibold leading-none text-stone-50">
                {interactiveRemainingBugs.toLocaleString()}
              </strong>
            </div>

            <div className="rounded-[16px] border border-white/8 bg-black/28 px-3 py-2.5">
              <div className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Kills
              </div>
              <strong className="mt-1 block text-lg font-semibold leading-none text-stone-50">
                {interactiveKills.toLocaleString()}
              </strong>
            </div>

            <div className="rounded-[16px] border border-amber-300/14 bg-[linear-gradient(135deg,rgba(120,80,0,0.22),rgba(24,24,27,0.92))] px-3 py-2.5">
              <div className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-amber-200/75">
                Pts
              </div>
              <strong className="mt-1 block text-lg font-semibold leading-none text-stone-50">
                {interactivePoints.toLocaleString()}
              </strong>
            </div>

            <div className="grid min-h-full grid-cols-2 gap-1">
              <button
                data-no-hammer
                aria-label="Back to dashboard"
                className="inline-flex min-h-full items-center justify-center rounded-[16px] border border-white/10 bg-zinc-900/90 px-3 text-sm font-medium text-stone-200 transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                onClick={onExit}
                type="button"
              >
                Back
              </button>
              <button
                data-no-hammer
                aria-label={
                  debugMode
                    ? "Disable siege debug mode"
                    : "Enable siege debug mode"
                }
                aria-pressed={debugMode}
                className={
                  debugMode
                    ? "inline-flex min-h-full items-center justify-center rounded-[16px] border border-cyan-300/35 bg-cyan-400/20 px-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-400/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
                    : "inline-flex min-h-full items-center justify-center rounded-[16px] border border-white/10 bg-zinc-900/90 px-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-stone-400 transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                }
                onClick={onToggleDebugMode}
                type="button"
              >
                DBG
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[16px] border border-white/8 bg-black/20 px-2.5 py-2.5">
          <div className="mb-2 px-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Weapons
          </div>
          <div
            data-no-hammer
            className="flex flex-wrap items-center gap-2"
            role="radiogroup"
            aria-label="Select weapon"
          >
            {weaponSnapshots.map((snapshot) => {
              const isSelected = snapshot.id === selectedWeaponId;
              const isEvolving = justEvolvedWeaponId === snapshot.id;
              return (
                <Tooltip
                  key={snapshot.id}
                  content={weaponTooltip(snapshot, isSelected)}
                >
                  <div
                    className={getTierSlotClassName(snapshot)}
                    data-current={isSelected ? "true" : "false"}
                    data-locked={snapshot.locked ? "true" : "false"}
                    data-testid={`weapon-${snapshot.id}`}
                    style={
                      isEvolving
                        ? {
                            animation:
                              "weapon-evolve 720ms cubic-bezier(0.34,1.56,0.64,1) forwards",
                          }
                        : undefined
                    }
                  >
                    {/* Evolution ring burst — expands outward and fades */}
                    {isEvolving && (
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-[-3px] z-20 rounded-[17px] border-2 [animation:weapon-evolve-ring_650ms_ease-out_forwards]",
                          snapshot.tier >= 3
                            ? "border-amber-400/90"
                            : "border-slate-300/90",
                        )}
                      />
                    )}

                    {snapshot.locked ? (
                      <div
                        aria-label={`${snapshot.title} weapon (locked)`}
                        aria-checked={false}
                        role="radio"
                        className={getWeaponButtonClassName(snapshot, false)}
                      >
                        <WeaponGlyph className="h-5 w-5" id={snapshot.id} />
                      </div>
                    ) : (
                      <button
                        aria-label={`Select ${snapshot.title} weapon`}
                        aria-checked={isSelected}
                        role="radio"
                        type="button"
                        className={getWeaponButtonClassName(
                          snapshot,
                          isSelected,
                        )}
                        onClick={() => onSelectWeapon(snapshot.id)}
                      >
                        <WeaponGlyph className="h-5 w-5" id={snapshot.id} />
                      </button>
                    )}

                    {/* Tier pip badge — silver (T2) or gold (T3) corner medallion */}
                    {!snapshot.locked && snapshot.tier >= 2 ? (
                      <div className="absolute -right-1 -top-1 z-10">
                        {snapshot.tier >= 3 ? (
                          <span
                            className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/90 text-[0.4rem] font-black leading-none text-amber-100"
                            style={{
                              animation:
                                "tier-pip-shimmer-gold 2.4s ease-in-out infinite",
                            }}
                            aria-label="Tier 3"
                          >
                            III
                          </span>
                        ) : (
                          <span
                            className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-slate-400/55 bg-slate-500/90 text-[0.4rem] font-black leading-none text-slate-100"
                            style={{
                              animation:
                                "tier-pip-shimmer 2.8s ease-in-out infinite",
                            }}
                            aria-label="Tier 2"
                          >
                            II
                          </span>
                        )}
                      </div>
                    ) : null}

                    {/* Reload bar: drains from full (right) to empty over cooldownMs */}
                    {!snapshot.locked &&
                    snapshot.cooldownMs > 0 &&
                    lastFireTimes?.[snapshot.id] != null ? (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-[14px]">
                        <div
                          key={lastFireTimes[snapshot.id]}
                          className={cn(
                            "h-full",
                            snapshot.tier >= 3
                              ? "bg-amber-400/80"
                              : snapshot.tier >= 2
                                ? "bg-slate-300/80"
                                : "bg-orange-300/80",
                          )}
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
        </div>

        {unlockedStructures && unlockedStructures.length > 0 && (
          <div className="rounded-[16px] border border-amber-400/14 bg-black/20 px-2.5 py-2.5">
            <div className="mb-2 px-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-amber-400/70">
              Structures
            </div>
            <div data-no-hammer className="flex flex-wrap items-center gap-2">
              {STRUCTURE_DEFS.filter((s) =>
                unlockedStructures.includes(s.id),
              ).map((structure) => {
                const isArming = placingStructureId === structure.id;
                const placedCount = placedCountByType?.[structure.id] ?? 0;
                const tooltipText = `${structure.title} — ${structure.hint} (${placedCount}/${structure.maxPlaced} placed)`;
                return (
                  <Tooltip key={structure.id} content={tooltipText}>
                    <div className="relative rounded-[14px] border border-white/8 bg-black/18 p-1.5">
                      <button
                        aria-label={`${isArming ? "Cancel" : "Arm"} ${structure.title}`}
                        aria-pressed={isArming}
                        type="button"
                        className={
                          isArming
                            ? "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/50 bg-amber-400/20 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.3)]"
                            : "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/8 text-amber-100 transition-colors duration-150 hover:border-amber-400/40 hover:bg-amber-500/16"
                        }
                        onClick={() => onArmStructure?.(structure.id)}
                      >
                        <span className="text-base leading-none">
                          {structure.id === "lantern"
                            ? "🔦"
                            : structure.id === "turret"
                              ? "🎯"
                              : "🤖"}
                        </span>
                      </button>
                      {placedCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[0.5rem] font-bold text-zinc-900">
                          {placedCount}
                        </span>
                      )}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
