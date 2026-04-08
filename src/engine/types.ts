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
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  separationRadius: 28,
  separationStrength: 0.5,
  wanderStrength: 0.06,
  baseSpeed: 0.95,
  sizeMultiplier: 1,
  chaseRadius: 160,
  fleeRadius: 60,
  followStrength: 0.18,
};
