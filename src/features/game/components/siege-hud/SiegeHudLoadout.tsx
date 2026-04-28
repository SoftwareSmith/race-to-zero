import { memo } from "react";
import type { SiegeWeaponId, WeaponProgressSnapshot } from "@game/types";
import {
  getWeaponTierNodeCount,
  getTierBarCoreClassName,
  getTierCopy,
  getTierNodeClassName,
  getTierNodeFillClassName,
  getTierNodeFillWidth,
  getTierNodeOffsetClassName,
  getTierProgressCompact,
} from "../siegeHud.helpers";
import { cn } from "@shared/utils/cn";
import { HudShell } from "./shared";
import WeaponRailSlot from "./WeaponRailSlot";

interface SiegeHudLoadoutProps {
  inline?: boolean;
  justEvolvedWeaponId?: SiegeWeaponId | null;
  justUnlockedWeaponIds: SiegeWeaponId[];
  lastFireTimes?: Partial<Record<SiegeWeaponId, number>>;
  onSelectWeapon: (id: SiegeWeaponId) => void;
  progressExpanded: boolean;
  selectedSnapshot?: WeaponProgressSnapshot;
  selectedWeaponId: SiegeWeaponId;
  setProgressExpanded: (
    value: boolean | ((currentValue: boolean) => boolean),
  ) => void;
  weaponSnapshots: WeaponProgressSnapshot[];
}

const SiegeHudLoadout = memo(function SiegeHudLoadout({
  inline = false,
  justEvolvedWeaponId,
  justUnlockedWeaponIds,
  lastFireTimes,
  onSelectWeapon,
  progressExpanded,
  selectedSnapshot,
  selectedWeaponId,
  setProgressExpanded,
  weaponSnapshots,
}: SiegeHudLoadoutProps) {
  const visibleWeaponSnapshots = weaponSnapshots;
  const weaponCount = visibleWeaponSnapshots.length;
  const weaponSlotRem = 2.35;
  const railGapRem = 0.25;
  const weaponRailWidthRem =
    weaponCount * weaponSlotRem + Math.max(0, weaponCount - 1) * railGapRem;
  const toolbeltWidthRem = Math.max(26, weaponRailWidthRem + 1.5);
  const loadoutContent = (
    <div className={inline ? "flex min-w-0 items-center gap-2" : "relative space-y-2"}>
      {selectedSnapshot ? (
        <button
          aria-expanded={progressExpanded}
          aria-label={
            progressExpanded
              ? "Collapse progress details"
              : "Expand progress details"
          }
          className={cn(
            "relative rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-200 hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.05))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40",
            inline ? "min-w-[8.5rem] max-w-[11rem] px-2.5 py-1.5" : "w-full px-3 py-2",
          )}
          data-no-hammer
          data-testid="siege-current-weapon"
          onClick={() => setProgressExpanded((currentValue) => !currentValue)}
          type="button"
        >
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[0.82rem] leading-none tracking-[-0.04em] text-stone-50 sm:text-[0.9rem]">
                {selectedSnapshot.title}
              </div>
              <div className="mt-1 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-stone-400">
                {`Level ${selectedSnapshot.tier}`}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {!inline ? (
                <div
                  className="grid shrink-0 items-center gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${getWeaponTierNodeCount(selectedSnapshot)}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from(
                    { length: getWeaponTierNodeCount(selectedSnapshot) },
                    (_, index) => (
                      <span
                        key={`selected-tier-node-${index + 1}`}
                        className={cn(
                          getTierNodeOffsetClassName(selectedSnapshot, index + 1),
                          getTierNodeClassName(selectedSnapshot, index + 1, "panel"),
                        )}
                      >
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
                            getTierNodeFillClassName(selectedSnapshot),
                          )}
                          style={{
                            width: getTierNodeFillWidth(selectedSnapshot, index + 1),
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
              ) : null}
              <span className="rounded-full border border-white/10 bg-black/24 px-2 py-1 text-[0.54rem] font-semibold uppercase tracking-[0.12em] text-stone-200">
                {getTierProgressCompact(selectedSnapshot)}
              </span>
              <span
                aria-hidden="true"
                className="text-[0.72rem] text-stone-400 transition-transform duration-200"
                style={{
                  transform: progressExpanded ? "rotate(180deg)" : "rotate(0deg)",
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

      <div className="flex min-w-0 items-center justify-center gap-2 overflow-x-auto">
        <div
          data-testid="weapon-rail"
          data-no-hammer
          className="grid min-w-0 flex-none grid-flow-col auto-cols-[2.35rem] gap-1"
          role="radiogroup"
          aria-label="Select weapon"
          style={{ width: `${weaponRailWidthRem}rem` }}
        >
          {visibleWeaponSnapshots.map((snapshot) => {
            const isSelected = snapshot.id === selectedWeaponId;

            return (
              <WeaponRailSlot
                key={snapshot.id}
                isEvolving={justEvolvedWeaponId === snapshot.id}
                isJustUnlocked={justUnlockedWeaponIds.includes(snapshot.id)}
                isSelected={isSelected}
                lastFiredAt={lastFireTimes?.[snapshot.id]}
                onSelect={onSelectWeapon}
                snapshot={snapshot}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="min-w-0 flex-1" data-testid="siege-hud-loadout">
        {loadoutContent}
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[220] flex justify-center px-3 sm:bottom-4">
      <div
        className="pointer-events-auto relative z-[220] max-w-[calc(100vw-1.5rem)] select-none !cursor-default transition-[width,max-width] duration-200 [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
        style={{ width: `${toolbeltWidthRem}rem` }}
      >
        <HudShell className="px-2.5 py-2 shadow-[0_22px_54px_rgba(0,0,0,0.38)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_48%)]" />

          {loadoutContent}
        </HudShell>
      </div>
    </div>
  );
});

export default SiegeHudLoadout;
