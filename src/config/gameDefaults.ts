import type { SiegeWeaponId } from "@game/types";
import { WEAPON_REGISTRY } from "@game/weapons";
import { getWeaponEvolutionThresholds } from "@game/weapons/progression";

/**
 * Default game-engine simulation parameters.
 * Import DEFAULT_GAME_CONFIG to use the baseline values,
 * or spread and override individual fields for custom scenarios.
 */

export interface GameConfig {
  separationRadius: number;
  separationStrength: number;
  wanderStrength: number;
  baseSpeed: number;
  sizeMultiplier: number;
  chaseRadius: number;
  fleeRadius: number;
  followStrength: number;
  roamTargetMinDistance: number;
  targetReachRadius: number;
  turnSpeed: number;
  wallAvoidDistance: number;
  wallAvoidStrength: number;
  crowdAvoidRadius: number;
  crowdRepathDelay: number;
  crowdRepathThreshold: number;
  crowdSteerStrength: number;
  crowdTargetPenalty: number;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  separationRadius: 28,
  separationStrength: 0.14,
  wanderStrength: 0.2,
  baseSpeed: 20,
  sizeMultiplier: 1,
  chaseRadius: 160,
  fleeRadius: 84,
  followStrength: 0.18,
  roamTargetMinDistance: 180,
  targetReachRadius: 24,
  turnSpeed: 3.8,
  wallAvoidDistance: 28,
  wallAvoidStrength: 0.9,
  crowdAvoidRadius: 96,
  crowdRepathDelay: 0.2,
  crowdRepathThreshold: 1.05,
  crowdSteerStrength: 1.55,
  crowdTargetPenalty: 68,
};

/**
 * Per-weapon kill thresholds for tier evolution.
 * Tier promotion thresholds derived from weapon definitions.
 */
export const WEAPON_EVOLVE_THRESHOLDS: Record<SiegeWeaponId, number[]> =
  Object.fromEntries(
    WEAPON_REGISTRY.map((weapon) => [weapon.id, getWeaponEvolutionThresholds(weapon)]),
  ) as Record<SiegeWeaponId, number[]>;
