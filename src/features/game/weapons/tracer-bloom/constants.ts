/**
 * Tracer Bloom — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.TracerBloom;

export const EVOLVE_THRESHOLDS: [number, number] = [20, 60];

export const CURSOR = {
  accent: "#f87171",
  aura: "0 0 24px rgba(248,113,113,0.28)",
  size: 48,
  showCrosshair: true,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: "Tracer Bloom",
  typeLabel: "Precision",
  typeHint: "Picks apart priority targets and scales hardest off existing status effects.",
  weaponType: "precision",
  unlockKills: 68,
  detail:
    "Paints a route from the core to your click, detonating 4 pulse blooms along the way. Each bloom clips nearby bugs without using bounce-line logic.",
  hitPattern: "line",
  hitRadius: 38,
  effectColor: CURSOR.accent,
  cooldownMs: 900,
  inputMode: "click",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Click to lay a bloom route — 4 bursts detonate between the core and target",
  tierTitles: ["Debug Trace", "Deep Trace", "Full Profiling"],
  tierDetails: [
    "Paints a route from the core to your click, detonating 4 pulse blooms along the way.",
    "Deep inspection — each bloom deals +2 bonus damage to Charged or Marked bugs caught in the blast.",
    "Full profiling — all bloom charges deal +3 bonus to status-afflicted bugs; overlay maps all active bugs.",
  ],
  tierHints: [
    "Click to lay a bloom route — 4 bursts detonate between core and target",
    "T2: +2 bonus damage to Charged or Marked bugs",
    "T3: +3 bonus to any status-afflicted bug; full coverage",
  ],
};
