export type Vec2 = { x: number; y: number };

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
  baseSpeed: 34,
  sizeMultiplier: 1,
  chaseRadius: 160,
  fleeRadius: 84,
  followStrength: 0.18,
  roamTargetMinDistance: 180,
  targetReachRadius: 24,
  turnSpeed: 3.8,
  wallAvoidDistance: 22,
  wallAvoidStrength: 0.32,
  crowdAvoidRadius: 96,
  crowdRepathDelay: 0.2,
  crowdRepathThreshold: 1.05,
  crowdSteerStrength: 1.55,
  crowdTargetPenalty: 68,
};
