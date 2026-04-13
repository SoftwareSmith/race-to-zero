/**
 * Flamethrower — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.Flame;

export const EVOLVE_THRESHOLDS: [number, number] = [25, 75];

export const CURSOR = {
  accent: "#f97316",
  aura: "0 0 24px rgba(249,115,22,0.35)",
  size: 50,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: "Flamethrower",
  typeLabel: "Thermal",
  typeHint: "Ignites flammable bugs and turns clustered lanes into panic zones.",
  weaponType: "thermal",
  unlockKills: 52,
  detail:
    "Spray napalm in a 70° cone. Rapid-fire stacks a hellfire inferno. A ground fire patch lingers at the cone tip for 1.5 s, burning any bug that walks through it. Char marks persist.",
  hitPattern: "cone",
  hitRadius: 150,
  damage: 0,
  coneArcDeg: 70,
  applyBurn: true,
  burnDps: 6,
  burnDurationMs: 1200,
  burnDecayPerSecond: 3.2,
  effectColor: CURSOR.accent,
  cooldownMs: 200,
  inputMode: "hold",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Hold to spray — move to paint a flamethrower trail; ground patch burns trespassers",
  tierTitles: ["Stack Overflow", "Memory Leak", "Kernel Panic"],
  tierDetails: [
    "Spray napalm in a 70° cone. Rapid-fire stacks a hellfire inferno. Ground fire lingers at the cone tip.",
    "Flame spreads — each burning bug ignites a secondary burn patch around itself, chaining fire to neighbours.",
    "Critical heat: burning bugs overload and explode on their next burn tick, dealing AoE splash damage to nearby enemies.",
  ],
  tierHints: [
    "Hold to spray — move to paint a trail; ground patch burns trespassers",
    "T2: Flame spreads to bugs near each burn target",
    "T3: Burning bugs detonate — chain their position toward other bugs",
  ],
};
