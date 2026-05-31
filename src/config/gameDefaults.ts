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
  separationStrength: 0.17,
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
  crowdAvoidRadius: 108,
  crowdRepathDelay: 0.2,
  crowdRepathThreshold: 0.92,
  crowdSteerStrength: 1.95,
  crowdTargetPenalty: 58,
};
