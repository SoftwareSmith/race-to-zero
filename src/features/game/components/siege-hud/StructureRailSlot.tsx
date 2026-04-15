import { memo } from "react";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import Tooltip from "@shared/components/Tooltip";
import { cn } from "@shared/utils/cn";
import type { StructureId } from "@game/types";
import { getStructureGlyph } from "../siegeHud.helpers";

interface StructureRailSlotProps {
  isArming: boolean;
  isJustUnlocked: boolean;
  onArm: (id: StructureId) => void;
  placedCount: number;
  structure: (typeof STRUCTURE_DEFS)[number];
}

const StructureRailSlot = memo(function StructureRailSlot({
  isArming,
  isJustUnlocked,
  onArm,
  placedCount,
  structure,
}: StructureRailSlotProps) {
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
});

export default StructureRailSlot;
