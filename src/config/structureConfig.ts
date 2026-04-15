/**
 * Static definitions for all placeable structures.
 * Structures are persistent objects placed on the battlefield that passively
 * interact with bugs each engine tick.
 */

import type { StructureId } from "../features/game/types";

export interface StructureDef {
  id: StructureId;
  title: string;
  /** Kill threshold required to unlock this structure. */
  unlockKills: number;
  detail: string;
  /** Short placement hint shown in the tooltip. */
  hint: string;
  /** Maximum number of this structure that may be placed simultaneously. */
  maxPlaced: number;
  /**
   * Radius within which the structure affects bugs each tick.
   * Lantern: attraction pull radius.
   * Agent: capture sweep radius.
   */
  effectRadius: number;
  /** How the structure interacts with bugs. */
  effectType: "attract" | "capture";
  /** CSS hex colour used by the StructureLayer renderer. */
  accentColor: string;
  /** XP thresholds for T2 and T3 structure upgrades. */
  tierThresholds: readonly [number, number];
}

export const STRUCTURE_DEFS: StructureDef[] = [
  {
    id: "lantern",
    title: "Bug Lantern",
    unlockKills: 48,
    detail:
      "Projects a rich amber trap field that drags nearby bugs into a tighter orbit and bunches lanes for cleanup.",
    hint: "Click to arm, then click the field to place (max 2)",
    maxPlaced: 2,
    effectRadius: 320,
    effectType: "attract",
    accentColor: "#fbbf24",
    tierThresholds: [2, 5],
  },
  {
    id: "agent",
    title: "Bug Agent",
    unlockKills: 92,
    detail:
      "Deploys a covert cleanup specialist that hooks a priority bug, reels it in, and processes it off-screen before the swarm can react.",
    hint: "Click to arm, then click the field to place (max 2)",
    maxPlaced: 2,
    effectRadius: 110,
    effectType: "capture",
    accentColor: "#34d399",
    tierThresholds: [2, 4],
  },
];

export const STRUCTURE_UNLOCK_THRESHOLDS: Record<StructureId, number> =
  Object.fromEntries(STRUCTURE_DEFS.map((s) => [s.id, s.unlockKills])) as Record<
    StructureId,
    number
  >;

export const STRUCTURE_TIER_THRESHOLDS: Record<StructureId, readonly [number, number]> =
  Object.fromEntries(
    STRUCTURE_DEFS.map((structure) => [structure.id, structure.tierThresholds]),
  ) as Record<StructureId, readonly [number, number]>;
