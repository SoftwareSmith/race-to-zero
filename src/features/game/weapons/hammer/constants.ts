/**
 * Hammer — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.Hammer;

export const EVOLVE_THRESHOLDS: [number, number] = [20, 60];

export const CURSOR = {
  accent: "#fbbf24",
  aura: "0 0 22px rgba(251,191,36,0.32)",
  size: 48,
  showCrosshair: false,
} as const;

export const DAMAGE = 2;
export const SEARCH_RADIUS = 48;
export const T3_ALLY_DURATION_MS = 8000;

export const def: WeaponDef = {
  id: ID,
  title: "Hammer",
  typeLabel: "Blunt",
  typeHint: "Crushes armored targets and stays reliable when precision is tight.",
  weaponType: "blunt",
  unlockKills: 0,
  detail:
    "Heavy impact strike. Deals 2 damage — one-shots Glitchlings on contact and leaves a persistent crack at the hit point.",
  hitPattern: "point",
  hitRadius: SEARCH_RADIUS,
  damage: DAMAGE,
  effectColor: CURSOR.accent,
  cooldownMs: 300,
  inputMode: "click",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Click directly on a bug to smash it",
  tierTitles: ["Hammer", "Refactor Tool", "Rewrite Engine"],
  tierDetails: [
    "Heavy impact strike. Deals 2 damage — one-shots Glitchlings on contact and leaves a crack decal.",
    "Refactor — if the target is above 50% HP, it splits into two half-HP bugs (divide and conquer).",
    "Rewrite from scratch — converts the hit bug to an ally for 8 s; it stops targeting the player base.",
  ],
  tierHints: [
    "Click directly on a bug to smash it",
    "T2: High-HP bugs split into two half-HP clones",
    "T3: Convert the hit bug to an ally for 8 seconds",
  ],
};
