import { memo } from "react";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import type {
  SiegeWeaponId,
  StructureId,
  WeaponProgressSnapshot,
} from "@game/types";
import {
  getTierBarCoreClassName,
  getTierCopy,
  getTierNodeClassName,
  getTierNodeFillClassName,
  getTierNodeFillWidth,
  getTierNodeOffsetClassName,
  getTierProgressCompact,
  WEAPON_TIER_NODE_COUNT,
} from "../siegeHud.helpers";
import { cn } from "@shared/utils/cn";
import { HudShell } from "./shared";
import StructureRailSlot from "./StructureRailSlot";
import WeaponRailSlot from "./WeaponRailSlot";

interface SiegeHudLoadoutProps {
  justEvolvedWeaponId?: SiegeWeaponId | null;
  justUnlockedStructureIds: StructureId[];
  justUnlockedWeaponIds: SiegeWeaponId[];
  lastFireTimes?: Partial<Record<SiegeWeaponId, number>>;
  onArmStructure?: (id: StructureId) => void;
  onSelectWeapon: (id: SiegeWeaponId) => void;
  placedCountByType?: Partial<Record<StructureId, number>>;
  placingStructureId?: StructureId | null;
  progressExpanded: boolean;
  selectedSnapshot?: WeaponProgressSnapshot;
  selectedWeaponId: SiegeWeaponId;
  setProgressExpanded: (
    value: boolean | ((currentValue: boolean) => boolean),
  ) => void;
  unlockedStructures?: StructureId[];
  weaponSnapshots: WeaponProgressSnapshot[];
}

const SiegeHudLoadout = memo(function SiegeHudLoadout({
  justEvolvedWeaponId,
  justUnlockedStructureIds,
  justUnlockedWeaponIds,
  lastFireTimes,
  onArmStructure,
  onSelectWeapon,
  placedCountByType,
  placingStructureId,
  progressExpanded,
  selectedSnapshot,
  selectedWeaponId,
  setProgressExpanded,
  unlockedStructures,
  weaponSnapshots,
}: SiegeHudLoadoutProps) {
  const visibleStructureIds = unlockedStructures ?? [];
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

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[220] flex justify-center px-3 sm:bottom-4">
      <div
        className="pointer-events-auto relative z-[220] max-w-[calc(100vw-1.5rem)] select-none !cursor-default transition-[width,max-width] duration-200 [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
        style={{ width: `${toolbeltWidthRem}rem` }}
      >
        <HudShell className="px-2.5 py-2 shadow-[0_22px_54px_rgba(0,0,0,0.38)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_48%)]" />

          <div className="relative space-y-2">
            {selectedSnapshot ? (
              <button
                aria-expanded={progressExpanded}
                aria-label={
                  progressExpanded
                    ? "Collapse progress details"
                    : "Expand progress details"
                }
                className="relative w-full rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-200 hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.05))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                data-no-hammer
                onClick={() =>
                  setProgressExpanded((currentValue) => !currentValue)
                }
                type="button"
              >
                <div className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[0.92rem] leading-none tracking-[-0.04em] text-stone-50">
                      {selectedSnapshot.title}
                    </div>
                    <div className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-stone-400">
                      {`Level ${selectedSnapshot.tier}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="grid shrink-0 grid-cols-2 items-center gap-1">
                      {Array.from(
                        { length: WEAPON_TIER_NODE_COUNT },
                        (_, index) => (
                          <span
                            key={`selected-tier-node-${index + 1}`}
                            className={cn(
                              getTierNodeOffsetClassName(
                                selectedSnapshot,
                                index + 1,
                              ),
                              getTierNodeClassName(
                                selectedSnapshot,
                                index + 1,
                                "panel",
                              ),
                            )}
                          >
                            <span
                              className={cn(
                                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
                                getTierNodeFillClassName(selectedSnapshot),
                              )}
                              style={{
                                width: getTierNodeFillWidth(
                                  selectedSnapshot,
                                  index + 1,
                                ),
                              }}
                            >
                              <span
                                className={cn(
                                  "absolute inset-y-0 left-0 right-0 rounded-full",
                                  getTierBarCoreClassName(selectedSnapshot),
                                )}
                              />
                            </span>
                          </span>
                        ),
                      )}
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/24 px-2 py-1 text-[0.54rem] font-semibold uppercase tracking-[0.12em] text-stone-200">
                      {getTierProgressCompact(selectedSnapshot)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[0.72rem] text-stone-400 transition-transform duration-200"
                      style={{
                        transform: progressExpanded
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      ▾
                    </span>
                  </div>
                </div>

                {progressExpanded ? (
                  <div className="mt-2 border-t border-white/8 pt-2 text-[0.72rem] leading-5 text-stone-300">
                    {getTierCopy(selectedSnapshot)}
                  </div>
                ) : null}
              </button>
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

              {visibleStructureIds.length > 0 ? (
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
                      const isJustUnlocked = justUnlockedStructureIds.includes(
                        structure.id,
                      );
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
  );
});

export default SiegeHudLoadout;
