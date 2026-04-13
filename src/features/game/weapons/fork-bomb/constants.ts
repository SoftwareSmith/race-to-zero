/**
 * Fork Bomb — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.ForkBomb;

export const EVOLVE_THRESHOLDS: [number, number] = [20, 60];

export const CURSOR = {
  accent: "#38bdf8",
  aura: "0 0 26px rgba(56,189,248,0.35)",
  size: 52,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: "Fork Bomb",
  typeLabel: "Plasma",
  typeHint: "Breaks dense bug packs with overlapping explosive bursts.",
  weaponType: "plasma",
  unlockKills: 110,
  detail:
    "Duplicates the payload on impact: one central blast and 4 satellite bursts detonate around the click point, shredding packed bug clusters without radial beam lines.",
  hitPattern: "area",
  hitRadius: 48,
  damage: 2,
  effectColor: CURSOR.accent,
  cooldownMs: 1100,
  inputMode: "click",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Click into a dense pocket of bugs — the blast forks into 5 clustered detonations",
  tierTitles: ["Fork Bomb", "Process Storm", "Recursive Crash"],
  tierDetails: [
    "One central blast and 4 satellite bursts detonate around the click point, shredding packed clusters.",
    "Each detonation spawns a child process — secondary mini-bursts erupt from each hit bug.",
    "Recursive cascade — explosions keep spawning more explosions in expanding rings until the screen is cleared.",
  ],
  tierHints: [
    "Click into a dense pocket — blast forks into 5 detonations",
    "T2: Each detonation spawns child explosions from hit bugs",
    "T3: Recursive cascade — expanding rings of AoE explosions",
  ],
};
