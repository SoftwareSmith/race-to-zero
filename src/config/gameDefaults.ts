import type { SiegeWeaponId } from "@game/types";

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
  baseSpeed: 24,
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
 * [killsForT2, killsForT3] — tune these to adjust pacing.
 */
export const WEAPON_EVOLVE_THRESHOLDS: Record<SiegeWeaponId, [number, number]> = {
  hammer:       [20, 60],
  zapper:       [25, 70],
  freeze:       [20, 60],
  chain:        [25, 75],
  flame:        [25, 75],
  laser:        [20, 60],
  shockwave:    [15, 50],
  nullpointer:  [20, 60],
  plasma:       [20, 60],
  void:         [15, 50],
};
