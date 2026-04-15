import { memo } from "react";
import Tooltip from "@shared/components/Tooltip";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { cn } from "@shared/utils/cn";
import type { SiegeWeaponId, WeaponProgressSnapshot } from "@game/types";
import {
  getSlotClassName,
  getTierBarCoreClassName,
  getTierNodeClassName,
  getTierNodeFillClassName,
  getTierNodeFillWidth,
  getTierNodeOffsetClassName,
  getTierSheenClassName,
  getWeaponButtonClassName,
  isMaxTierSnapshot,
  WEAPON_TIER_NODE_COUNT,
  weaponTooltip,
} from "../siegeHud.helpers";

interface WeaponRailSlotProps {
  isEvolving: boolean;
  isJustUnlocked: boolean;
  isSelected: boolean;
  lastFiredAt?: number;
  onSelect: (id: SiegeWeaponId) => void;
  snapshot: WeaponProgressSnapshot;
}

const WeaponRailSlot = memo(function WeaponRailSlot({
  isEvolving,
  isJustUnlocked,
  isSelected,
  lastFiredAt,
  onSelect,
  snapshot,
}: WeaponRailSlotProps) {
  const tierSheenClassName = getTierSheenClassName(snapshot);
  const upgradeActive = isJustUnlocked || isEvolving;
  const isOverdrive = isMaxTierSnapshot(snapshot);
  const overdriveDecoration =
    isOverdrive && !snapshot.locked ? (
      <>
        <div className="pointer-events-none absolute inset-[-3px] rounded-[11px] border border-white/18 opacity-90 [box-shadow:0_0_0_1px_rgba(255,247,237,0.18),0_0_18px_rgba(239,68,68,0.24)] [animation:overdrive-border-pulse_1300ms_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute inset-[-5px] rounded-[13px] border border-orange-300/30 [animation:overdrive-border-bloom_1500ms_ease-out_infinite]" />
        <div className="pointer-events-none absolute -top-3 left-1.5 h-5 w-2 rounded-[999px_999px_999px_999px/100%_100%_40%_40%] bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(253,186,116,0.92)_18%,rgba(249,115,22,0.84)_44%,rgba(220,38,38,0.0))] opacity-90 blur-[0.5px] [animation:overdrive-border-flame-left_760ms_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute -top-4 left-1/2 h-6 w-3 -translate-x-1/2 rounded-[999px_999px_999px_999px/100%_100%_40%_40%] bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(255,247,237,0.96)_14%,rgba(253,186,116,0.92)_28%,rgba(249,115,22,0.76)_52%,rgba(220,38,38,0.0))] opacity-100 [animation:overdrive-border-flame-top_620ms_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute -right-0.5 -top-3 h-5 w-2 rounded-[999px_999px_999px_999px/100%_100%_40%_40%] bg-[linear-gradient(180deg,rgba(255,237,213,0.96),rgba(251,146,60,0.86)_28%,rgba(220,38,38,0.0))] opacity-90 blur-[0.5px] [animation:overdrive-border-flame-right_820ms_ease-in-out_infinite]" />
      </>
    ) : null;

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
        {upgradeActive ? (
          <>
            <div className="pointer-events-none absolute inset-0 rounded-[12px] bg-[radial-gradient(circle_at_center,rgba(255,247,237,0.4),rgba(255,247,237,0.0)_58%)] [animation:heat-tier-up-flash_420ms_ease-out_forwards]" />
            <div className="pointer-events-none absolute inset-[-3px] rounded-[14px] border border-orange-100/70 [animation:heat-tier-up-ripple_460ms_ease-out_forwards]" />
          </>
        ) : null}

        {!snapshot.locked ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-1 top-0 h-3 rounded-b-full bg-gradient-to-b opacity-90",
              tierSheenClassName,
            )}
          />
        ) : null}

        <div className="relative flex h-full items-center justify-center">
          {snapshot.locked ? (
            <div
              data-hud-cursor="pointer"
              aria-label={`${snapshot.title} weapon (locked)`}
              aria-checked={false}
              role="radio"
              className={getWeaponButtonClassName(snapshot, false)}
            >
              {overdriveDecoration}
              <WeaponGlyph
                className={cn(
                  "relative z-[1] h-4 w-4",
                  isOverdrive
                    ? "drop-shadow-[0_0_10px_rgba(255,247,237,0.62)]"
                    : undefined,
                )}
                id={snapshot.id}
              />
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
              {overdriveDecoration}
              <WeaponGlyph
                className={cn(
                  "relative z-[1] h-4 w-4",
                  isOverdrive
                    ? "drop-shadow-[0_0_10px_rgba(255,247,237,0.62)]"
                    : undefined,
                )}
                id={snapshot.id}
              />
            </button>
          )}
        </div>

        <div className="mt-0.5 px-1">
          <div className="grid grid-cols-3 items-center">
            {Array.from({ length: WEAPON_TIER_NODE_COUNT }, (_, index) => (
              <span
                key={`${snapshot.id}-tier-node-${index + 1}`}
                className={cn(
                  getTierNodeOffsetClassName(snapshot, index + 1),
                  getTierNodeClassName(snapshot, index + 1),
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
                    getTierNodeFillClassName(snapshot),
                    isSelected ||
                      (index + 1 === snapshot.tier && !snapshot.locked)
                      ? undefined
                      : "opacity-84",
                  )}
                  style={{ width: getTierNodeFillWidth(snapshot, index + 1) }}
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 right-0 rounded-full",
                      getTierBarCoreClassName(snapshot),
                    )}
                  />
                </span>
              </span>
            ))}
          </div>
        </div>

        {!snapshot.locked && snapshot.cooldownMs > 0 && lastFiredAt != null ? (
          <div
            key={lastFiredAt}
            className="pointer-events-none absolute inset-[3px] rounded-[10px] border border-sky-200/22 [animation:heat-tier-up-ripple_520ms_ease-out_forwards]"
          />
        ) : null}
      </div>
    </Tooltip>
  );
});

export default WeaponRailSlot;