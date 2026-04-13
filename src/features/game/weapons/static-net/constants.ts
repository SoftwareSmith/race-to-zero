/**
 * Static Net — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.StaticNet;

export const EVOLVE_THRESHOLDS: [number, number] = [15, 50];

export const CURSOR = {
  accent: "#a78bfa",
  aura: "0 0 26px rgba(167,139,250,0.3)",
  size: 54,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: "Static Net",
  typeLabel: "Electric",
  typeHint: "Locks enemies in place so follow-up hits feel guaranteed.",
  weaponType: "electric",
  unlockKills: 82,
  detail:
    "Expands a wire-mesh net to 200px over 0.4 s. All bugs inside are Ensnared — completely immobilised for 3 s. Click any ensnared bug for an instant kill. Net dissolves with a scatter burst. 4 s cooldown.",
  hitPattern: "area",
  hitRadius: 200,
  damage: 0,
  applyEnsnare: true,
  ensnareDurationMs: 3000,
  effectColor: "#e2e8f0",
  cooldownMs: 4000,
  inputMode: "click",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Click to cast a net — ensnared bugs are frozen; click them to instakill",
  tierTitles: ["Thread Lock", "Mutex", "Deadlock Cluster"],
  tierDetails: [
    "Expands a wire-mesh net to 200px. All bugs inside are Ensnared for 3 s. Click any ensnared bug to instakill.",
    "Mutex contention — ensnared bugs are also pushed apart by knockback, breaking their cluster formation.",
    "Deadlock — bugs are pulled together toward a single centroid point, crushing the cluster.",
  ],
  tierHints: [
    "Click to cast a net — ensnared bugs are frozen; click them to instakill",
    "T2: Ensnared bugs get knockback — scattered apart",
    "T3: Deadlock pulls all bugs to one point instead",
  ],
};
