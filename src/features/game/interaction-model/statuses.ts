import type { StatusEffectDefinition } from "./types";

export const burnStatus: StatusEffectDefinition = {
  id: "burn",
  sourceType: "fire",
  damagePerSecond: 3,
  durationMs: 2000,
};