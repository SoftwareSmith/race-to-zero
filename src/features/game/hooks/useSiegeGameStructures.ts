import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STRUCTURE_DEFS, STRUCTURE_TIER_THRESHOLDS } from "@config/structureConfig";
import type {
  PlacedStructure,
  StructureId,
  WeaponTier,
} from "@game/types";
import { WeaponTier as Tier } from "@game/types";

const LANTERN_SUPPORT_XP_INTERVAL_MS = 4500;
const STRUCTURE_KILL_XP = 2;

function scheduleInterval(callback: () => void, delay: number): number {
  if (typeof window !== "undefined") {
    return window.setInterval(callback, delay);
  }

  return globalThis.setInterval(callback, delay) as unknown as number;
}

function cancelInterval(intervalId: number): void {
  globalThis.clearInterval(intervalId);
}

function getNextStructureTierXp(
  structureType: StructureId,
  tier: WeaponTier,
): number | null {
  const thresholds = STRUCTURE_TIER_THRESHOLDS[structureType];
  if (tier === Tier.TIER_ONE) {
    return thresholds[0];
  }

  if (tier === Tier.TIER_TWO) {
    return thresholds[1];
  }

  return null;
}

function getStructureTierForXp(
  structureType: StructureId,
  xp: number,
): WeaponTier {
  const [tierTwoThreshold, tierThreeThreshold] = STRUCTURE_TIER_THRESHOLDS[structureType];
  if (xp >= tierThreeThreshold) {
    return Tier.TIER_THREE;
  }

  if (xp >= tierTwoThreshold) {
    return Tier.TIER_TWO;
  }

  return Tier.TIER_ONE;
}

function applyStructureXp(
  structure: PlacedStructure,
  xpGain: number,
  killGain = 0,
): PlacedStructure {
  const xp = structure.xp + xpGain;
  const tier = getStructureTierForXp(structure.structureType, xp);
  return {
    ...structure,
    xp,
    kills: structure.kills + killGain,
    tier,
    nextTierXp: getNextStructureTierXp(structure.structureType, tier),
  };
}

interface UseSiegeGameStructuresOptions {
  interactiveMode: boolean;
  onStructureTierUp?: (payload: {
    structureId: string;
    structureType: StructureId;
    tier: WeaponTier;
  }) => void;
}

export function useSiegeGameStructures({
  interactiveMode,
  onStructureTierUp,
}: UseSiegeGameStructuresOptions) {
  const [placingStructureId, setPlacingStructureId] = useState<StructureId | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const previousStructureTiersRef = useRef<Record<string, WeaponTier>>({});
  const placingStructureIdRef = useRef<StructureId | null>(null);

  useEffect(() => {
    placingStructureIdRef.current = placingStructureId;
  }, [placingStructureId]);

  const resetStructures = useCallback(() => {
    setPlacedStructures([]);
    setPlacingStructureId(null);
  }, []);

  const armStructure = useCallback((id: StructureId) => {
    setPlacingStructureId((prev) => (prev === id ? null : id));
  }, []);

  const cancelStructurePlacement = useCallback(() => {
    setPlacingStructureId(null);
  }, []);

  const placeStructure = useCallback(
    (
      structureType: StructureId,
      viewportX: number,
      viewportY: number,
      canvasX: number,
      canvasY: number,
      structureId?: string,
    ) => {
      const def = STRUCTURE_DEFS.find((entry) => entry.id === structureType);
      const maxPlaced = def?.maxPlaced ?? 2;
      setPlacedStructures((prev) => {
        const ofType = prev.filter((s) => s.structureType === structureType);
        const filtered = ofType.length >= maxPlaced
          ? prev.filter((s) => s.structureType !== structureType || s !== ofType[0])
          : prev;
        return [
          ...filtered,
          {
            id:
              structureId ??
              `${structureType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            structureType,
            tier: Tier.TIER_ONE,
            xp: 0,
            nextTierXp: getNextStructureTierXp(structureType, Tier.TIER_ONE),
            kills: 0,
            x: viewportX,
            y: viewportY,
            canvasX,
            canvasY,
            placedAt: Date.now(),
          },
        ];
      });
      setPlacingStructureId(null);
    },
    [],
  );

  const handleStructureKill = useCallback((structureId: string) => {
    setPlacedStructures((prev) =>
      prev.map((structure) =>
        structure.id === structureId
          ? applyStructureXp(structure, STRUCTURE_KILL_XP, 1)
          : structure,
      ),
    );
  }, []);

  useEffect(() => {
    const nextTiers: Record<string, WeaponTier> = {};

    for (const structure of placedStructures) {
      nextTiers[structure.id] = structure.tier;
      const previousTier = previousStructureTiersRef.current[structure.id];
      if (previousTier != null && structure.tier > previousTier) {
        onStructureTierUp?.({
          structureId: structure.id,
          structureType: structure.structureType,
          tier: structure.tier,
        });
      }
    }

    previousStructureTiersRef.current = nextTiers;
  }, [onStructureTierUp, placedStructures]);

  useEffect(() => {
    if (!interactiveMode) {
      return undefined;
    }

    const intervalId = scheduleInterval(() => {
      setPlacedStructures((prev) =>
        prev.map((structure) =>
          structure.structureType === "lantern"
            ? applyStructureXp(structure, 1)
            : structure,
        ),
      );
    }, LANTERN_SUPPORT_XP_INTERVAL_MS);

    return () => {
      cancelInterval(intervalId);
    };
  }, [interactiveMode]);

  const placedCountByType = useMemo(() => {
    const counts = Object.fromEntries(
      STRUCTURE_DEFS.map((def) => [def.id, 0]),
    ) as Record<StructureId, number>;

    for (const structure of placedStructures) {
      counts[structure.structureType] += 1;
    }

    return counts;
  }, [placedStructures]);

  return {
    armStructure,
    cancelStructurePlacement,
    handleStructureKill,
    placeStructure,
    placedCountByType,
    placedStructures,
    placingStructureId,
    placingStructureIdRef,
    resetStructures,
  };
}