export type Vec2 = { x: number; y: number };

// GameConfig and DEFAULT_GAME_CONFIG live in src/config/gameDefaults.ts.
// Re-exported here so engine files that import from "./types" continue to work.
export type { GameConfig } from "@config/gameDefaults";
export { DEFAULT_GAME_CONFIG } from "@config/gameDefaults";
