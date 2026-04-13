/**
 * Void Pulse — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.VoidPulse;

export const EVOLVE_THRESHOLDS: [number, number] = [15, 50];

export const CURSOR = {
  accent: "#c084fc",
  aura: "0 0 30px rgba(192,132,252,0.4)",
  size: 56,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: "Void Pulse",
  typeLabel: "Gravity",
  typeHint: "Pulls elite bugs into collapse zones and rewards timing over spam.",
  weaponType: "gravity",
  unlockKills: 130,
  detail:
    "Creates a miniature black hole that grows for 2 s, pulling every bug within 300px inward. Bugs touching the core take 1 dmg/tick. On collapse: 300px shockring deals 2 dmg. One active at a time. 6 s cooldown.",
  hitPattern: "blackhole",
  hitRadius: 300,
  damage: 2,
  blackHoleMode: true,
  blackHoleDurationMs: 2000,
  blackHoleRadius: 300,
  blackHoleCoreRadius: 80,
  instakillLowHp: false,
  appliesKnockback: true,
  effectColor: CURSOR.accent,
  cooldownMs: 6000,
  inputMode: "click",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Click to spawn a black hole — gravity pull 2 s then 300px collapse ring",
  tierTitles: ["Void Pulse", "Singularity", "Event Horizon"],
  tierDetails: [
    "Creates a miniature black hole for 2 s, pulling bugs inward. Core contact: 1 dmg/tick. Collapse: 300px ring for 2 dmg.",
    "Singularity — increased pull strength; active burn DOT applied during the gravity well phase.",
    "Event Horizon — after collapse, leaves a persistent trap zone that instantly destroys any Unstable bugs entering it.",
  ],
  tierHints: [
    "Click to spawn a black hole — gravity pull 2 s then 300px collapse ring",
    "T2: Stronger pull + burn DOT during the well phase",
    "T3: Leaves an Event Horizon trap that destroys Unstable bugs on contact",
  ],
};
