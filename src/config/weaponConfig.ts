/**
 * Static definitions for all player weapons.
 * Unlock thresholds, display text, and descriptive copy live here
 * so that progression.ts and UI components share a single source of truth.
 */

import type { SiegeWeaponId } from "../features/game/types";

export type { SiegeWeaponId };

export interface WeaponDef {
  id: SiegeWeaponId;
  title: string;
  /** Number of bug kills required to unlock. 0 = available immediately. */
  unlockKills: number;
  detail: string;
  /**
   * How the weapon resolves hits when fired.
   * - point: nearest bug within hitRadius of click
   * - area: all bugs within hitRadius of click
   * - line: all bugs on a beam (8-direction snap when snapAngle is true)
   * - cone: all bugs inside a 90° arc aimed toward the cursor
   * - chain: bouncing arc starting from nearest bug up to chainMaxBounces hops
   * - seeking: auto-targets highest-HP bug within seekRadius of click (or whole screen)
   */
  hitPattern: "point" | "line" | "area" | "cone" | "chain" | "seeking";
  /**
   * Primary hit radius in canvas pixels.
   * point → proximity radius; area → blast radius; line → beam half-width;
   * cone → depth; chain → per-hop arc radius; seeking → search radius (Infinity = whole screen)
   */
  hitRadius: number;
  /** Damage dealt per entity hit. Defaults to 1. */
  damage?: number;
  /** For 'line' weapons without snapAngle: explicit beam orientation. */
  hitOrientation?: "horizontal" | "vertical";
  /** When true, the laser beam auto-snaps to the nearest 45° axis relative to screen centre. */
  snapAngle?: boolean;
  /** For 'cone': full opening angle in degrees (e.g. 90). */
  coneArcDeg?: number;
  /** For 'chain': maximum number of bounce hops after the initial hit. */
  chainMaxBounces?: number;
  /** For 'seeking': search radius around click (use Infinity for full-screen). */
  seekRadius?: number;
  /** For 'seeking': secondary blast radius around impact point. */
  splashRadius?: number;
  /** When true, any entity with 1 current HP is instantly defeated (Shockwave). */
  instakillLowHp?: boolean;
  /** When true, all hit entities receive a 3-second 50% speed slow (Freeze Cone). */
  appliesSlow?: boolean;
  /** When true, surviving entities are knocked 40px away from the blast centre (Pulse Cannon). */
  appliesKnockback?: boolean;
  /** How the player activates this weapon. Used in tooltips. */
  inputMode: "click" | "directional" | "seeking" | "hold";
  /** Short one-liner hint shown in the tooltip. */
  hint: string;
  /** CSS hex color used by the on-screen fire animation. */
  effectColor: string;
  /** Minimum milliseconds between player-triggered shots. 0 = unlimited. */
  cooldownMs: number;
}

export const WEAPON_DEFS: WeaponDef[] = [
  {
    id: "wrench",
    title: "Wrench",
    unlockKills: 0,
    detail: "Precision strike. Deals 2 damage — one-shots Glitchlings and Throttlers on contact.",
    hitPattern: "point",
    hitRadius: 48,
    damage: 2,
    effectColor: "#fbbf24",
    cooldownMs: 400,
    inputMode: "click",
    hint: "Click directly on a bug",
  },
  {
    id: "zapper",
    title: "Bug Zapper",
    unlockKills: 10,
    detail: "Electrostatic burst centred on click. Fries every bug in the blast zone.",
    hitPattern: "area",
    hitRadius: 80,
    effectColor: "#38bdf8",
    cooldownMs: 450,
    inputMode: "click",
    hint: "Click anywhere to zap nearby bugs",
  },
  {
    id: "pulse",
    title: "Pulse Cannon",
    unlockKills: 15,
    detail: "Shockwave that damages all bugs in range and knocks survivors back from the blast centre.",
    hitPattern: "area",
    hitRadius: 130,
    damage: 2,
    appliesKnockback: true,
    effectColor: "#22d3ee",
    cooldownMs: 900,
    inputMode: "click",
    hint: "Click to blast — survivors get knocked back",
  },
  {
    id: "pointer",
    title: "Debug Pointer",
    unlockKills: 20,
    detail: "Auto-targets the highest-HP bug within reach of your click. Deals 2 damage. Misses if nothing is nearby.",
    hitPattern: "seeking",
    hitRadius: 450,
    damage: 2,
    seekRadius: 450,
    effectColor: "#f87171",
    cooldownMs: 800,
    inputMode: "seeking",
    hint: "Click anywhere — auto-targets highest-HP bug nearby",
  },
  {
    id: "freeze",
    title: "Freeze Cone",
    unlockKills: 30,
    detail: "Icy cone spray aimed toward the cursor. Deals 1 damage and slows all hit bugs by 50% for 3 seconds.",
    hitPattern: "cone",
    hitRadius: 180,
    coneArcDeg: 90,
    appliesSlow: true,
    effectColor: "#bfdbfe",
    cooldownMs: 1000,
    inputMode: "directional",
    hint: "Click to fire a cone toward your cursor — slows 50% for 3s",
  },
  {
    id: "chain",
    title: "Chain Zap",
    unlockKills: 40,
    detail: "Click near a bug to start a bouncing arc. Lightning hops up to 3 times to nearby bugs within 90px.",
    hitPattern: "chain",
    hitRadius: 90,
    damage: 2,
    chainMaxBounces: 3,
    effectColor: "#fde68a",
    cooldownMs: 1400,
    inputMode: "click",
    hint: "Click near a bug — lightning bounces up to 3 times",
  },
  {
    id: "laser",
    title: "Directional Laser",
    unlockKills: 55,
    detail: "Full-screen beam that auto-snaps to the nearest 45° axis toward your cursor. Cuts every bug on the line.",
    hitPattern: "line",
    hitRadius: 28,
    snapAngle: true,
    effectColor: "#f87171",
    cooldownMs: 1200,
    inputMode: "directional",
    hint: "Click to fire a full-screen beam — 8-way snap direction",
  },
  {
    id: "bomb",
    title: "Pixel Bomb",
    unlockKills: 65,
    detail: "Massive area detonation. Deals 2 damage to everything in a 200px radius. Long cooldown demands precision.",
    hitPattern: "area",
    hitRadius: 170,
    damage: 2,
    effectColor: "#fb923c",
    cooldownMs: 2200,
    inputMode: "click",
    hint: "Click to detonate — 2 damage in a massive 200px radius",
  },
  {
    id: "shockwave",
    title: "Shockwave",
    unlockKills: 80,
    detail: "Enormous blast. Deals 1 damage in a 260px radius — all 1-HP bugs are instantly vaporised.",
    hitPattern: "area",
    hitRadius: 210,
    instakillLowHp: true,
    effectColor: "#a78bfa",
    cooldownMs: 4000,
    inputMode: "click",
    hint: "Click to shockwave — all 1-HP bugs instantly vaporised",
  },
  {
    id: "nullpointer",
    title: "Null Pointer",
    unlockKills: 100,
    detail: "Homing missile that locks onto the highest-HP bug on screen. Deals 3 damage plus a 60px splash. Never misses.",
    hitPattern: "seeking",
    hitRadius: 500,
    damage: 2,
    seekRadius: 500,
    splashRadius: 40,
    effectColor: "#fb923c",
    cooldownMs: 4500,
    inputMode: "seeking",
    hint: "Click anywhere — locks onto highest-HP bug on screen, never misses",
  },
  {
    id: "flame",
    title: "Flamethrower",
    unlockKills: 110,
    detail: "Spray napalm in a 70° cone. Burns every bug in range for 1 damage per blast. Rapid fire.",
    hitPattern: "cone",
    hitRadius: 90,
    damage: 1,
    coneArcDeg: 70,
    effectColor: "#f97316",
    cooldownMs: 300,
    inputMode: "click",
    hint: "Click to spray flames — 70° cone, rapid fire",
  },
  {
    id: "stomp",
    title: "Boot Stomp",
    unlockKills: 130,
    detail: "A divine boot descends from above. 3 damage to everything in a colossal 180px radius. Long reload.",
    hitPattern: "area",
    hitRadius: 180,
    damage: 3,
    effectColor: "#a3e635",
    cooldownMs: 5000,
    inputMode: "click",
    hint: "Click to stomp — 3 damage in a massive 180px radius",
  },
  {
    id: "swatter",
    title: "Fly Swatter",
    unlockKills: 150,
    detail: "Satisfying wide-arc slap. 2 damage to everything in a 120° sweep. Fast cooldown.",
    hitPattern: "cone",
    hitRadius: 70,
    damage: 2,
    coneArcDeg: 120,
    effectColor: "#fcd34d",
    cooldownMs: 350,
    inputMode: "click",
    hint: "Click to swat — wide 120° arc, 2 damage",
  },
];

/** Convenience lookup: weapon id → kill threshold. */
export const WEAPON_UNLOCK_THRESHOLDS: Record<SiegeWeaponId, number> =
  Object.fromEntries(WEAPON_DEFS.map((w) => [w.id, w.unlockKills])) as Record<
    SiegeWeaponId,
    number
  >;
