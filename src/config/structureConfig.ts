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
  /**
   * Inner kill radius — bugs that enter this zone are instantly destroyed.
   * Only relevant for the Lantern.
   */
  killRadius?: number;
  /** How the structure interacts with bugs. */
  effectType: "attract" | "capture" | "shoot";
  /** CSS hex colour used by the StructureLayer renderer. */
  accentColor: string;
}

export const STRUCTURE_DEFS: StructureDef[] = [
  {
    id: "lantern",
    title: "Bug Lantern",
    unlockKills: 45,
    detail:
      "Emits an irresistible glow that pulls bugs into a mesmerising orbit. Bugs spiral in and circle the flame — pick them off while they\'re circling.",
    hint: "Click to arm, then click the field to place (max 3)",
    maxPlaced: 3,
    effectRadius: 280,
    effectType: "attract",
    accentColor: "#fbbf24",
  },
  {
    id: "agent",
    title: "Bug Agent",
    unlockKills: 60,
    detail:
      "A silent code sentinel. Every 2 seconds it extends a capture arm and eliminates the nearest bug within reach.",
    hint: "Click to arm, then click the field to place (max 3)",
    maxPlaced: 3,
    effectRadius: 80,
    effectType: "capture",
    accentColor: "#34d399",
  },
  {
    id: "turret",
    title: "Debug Turret",
    unlockKills: 75,
    detail:
      "Auto-firing sentry gun. Locks onto the nearest bug within 150px and fires every 2 seconds. Deals 1 damage per shot.",
    hint: "Click to arm, then click the field to place (max 2)",
    maxPlaced: 2,
    effectRadius: 150,
    effectType: "shoot",
    accentColor: "#22d3ee",
  },
  {
    id: "tesla",
    title: "Tesla Coil",
    unlockKills: 95,
    detail:
      "Auto-firing chain lightning coil. Every 3 seconds it unleashes a plasma arc that bounces between 2 nearby bugs within 120px. Deals 1 damage per hop.",
    hint: "Click to arm, then click the field to place (max 2)",
    maxPlaced: 2,
    effectRadius: 120,
    effectType: "shoot",
    accentColor: "#c084fc",
  },
  {
    id: "firewall",
    title: "Firewall",
    unlockKills: 120,
    detail:
      "Places a 200px horizontal burn zone. Any bug that crosses it takes 1 damage per tick for 10 seconds. Fire renders continuously with VFX.",
    hint: "Click to arm, then click the field to place (max 2)",
    maxPlaced: 2,
    effectRadius: 20,
    effectType: "capture",
    accentColor: "#f97316",
  },
];

export const STRUCTURE_UNLOCK_THRESHOLDS: Record<StructureId, number> =
  Object.fromEntries(STRUCTURE_DEFS.map((s) => [s.id, s.unlockKills])) as Record<
    StructureId,
    number
  >;
