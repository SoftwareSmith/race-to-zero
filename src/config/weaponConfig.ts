/**
 * Static definitions for all player weapons.
 * 10 weapons with world-class VFX and distinct mechanics.
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
  // ── 1. Wrench ─────────────────────────────────────────────
  {
    id: "wrench",
    title: "Wrench",
    unlockKills: 0,
    detail:
      "Precision strike. Deals 2 damage — one-shots Glitchlings on contact. Leaves fractal cracks that glow and persist on the field.",
    hitPattern: "point",
    hitRadius: 48,
    damage: 2,
    effectColor: "#fbbf24",
    cooldownMs: 300,
    inputMode: "click",
    hint: "Click directly on a bug",
  },
  // ── 2. Bug Zapper ──────────────────────────────────────────
  {
    id: "zapper",
    title: "Bug Zapper",
    unlockKills: 12,
    detail:
      "Plasma EMP burst centred on click. 60 electric arcs radiate outward and fry every bug in an 80px blast zone.",
    hitPattern: "area",
    hitRadius: 80,
    effectColor: "#fde047",
    cooldownMs: 700,
    inputMode: "click",
    hint: "Click anywhere to EMP nearby bugs",
  },

  // ── 3. Freeze Cone ─────────────────────────────────────────
  {
    id: "freeze",
    title: "Freeze Cone",
    unlockKills: 25,
    detail:
      "Icy cone spray aimed toward the cursor. Deals 1 damage and slows all hit bugs by 65% for 3.5 seconds. Leaves frost crystals at impact sites.",
    hitPattern: "cone",
    hitRadius: 180,
    coneArcDeg: 90,
    appliesSlow: true,
    effectColor: "#bfdbfe",
    cooldownMs: 820,
    inputMode: "directional",
    hint: "Click to fire a cone toward your cursor — slows 65% for 3.5s",
  },

  // ── 4. Chain Zap ───────────────────────────────────────────
  {
    id: "chain",
    title: "Chain Zap",
    unlockKills: 38,
    detail:
      "Click near a bug to start a 3-strand plasma arc. Lightning hops up to 3 times to nearby bugs within 90px — each node pulses and emits sparks.",
    hitPattern: "chain",
    hitRadius: 90,
    damage: 2,
    chainMaxBounces: 3,
    effectColor: "#6ee7b7",
    cooldownMs: 950,
    inputMode: "click",
    hint: "Click near a bug — lightning bounces up to 3 times",
  },

  // ── 5. Flamethrower ────────────────────────────────────────
  {
    id: "flame",
    title: "Flamethrower",
    unlockKills: 52,
    detail:
      "Spray napalm in a 70° cone. Real fire stacks on screen — rapid-fire builds a hellfire inferno. Char marks persist on the field for 6 seconds.",
    hitPattern: "cone",
    hitRadius: 90,
    damage: 1,
    coneArcDeg: 70,
    effectColor: "#f97316",
    cooldownMs: 200,
    inputMode: "click",
    hint: "Click to spray flames — rapid-fire stacks fire on screen",
  },

  // ── 6. Laser Cutter ────────────────────────────────────────
  {
    id: "laser",
    title: "Laser Cutter",
    unlockKills: 68,
    detail:
      "Full-screen beam that auto-snaps to the nearest 45° axis. Wind-up charge, blinding white core, and a 2-second glowing burn scar along the beam path.",
    hitPattern: "line",
    hitRadius: 28,
    snapAngle: true,
    effectColor: "#f87171",
    cooldownMs: 1100,
    inputMode: "directional",
    hint: "Click to fire a full-screen beam — 8-way snap direction",
  },

  // ── 7. Shockwave ───────────────────────────────────────────
  {
    id: "shockwave",
    title: "Shockwave",
    unlockKills: 82,
    detail:
      "Enormous blast. Deals 1 damage in a 210px radius — all 1-HP bugs instantly vaporised. Ground rupture cracks radiate outward. Screen shakes.",
    hitPattern: "area",
    hitRadius: 210,
    instakillLowHp: true,
    effectColor: "#a78bfa",
    cooldownMs: 2600,
    inputMode: "click",
    hint: "Click to shockwave — all 1-HP bugs vaporised, screen shakes",
  },

  // ── 8. Null Pointer ────────────────────────────────────────
  {
    id: "nullpointer",
    title: "Null Pointer",
    unlockKills: 95,
    detail:
      "Homing missile that locks onto the highest-HP bug on screen. Deals 3 damage + 60px splash. Target-lock animation, missile trail, and massive crater impact.",
    hitPattern: "seeking",
    hitRadius: 500,
    damage: 3,
    seekRadius: 500,
    splashRadius: 60,
    effectColor: "#fb7185",
    cooldownMs: 3000,
    inputMode: "seeking",
    hint: "Click anywhere — locks onto highest-HP bug, never misses",
  },

  // ── 9. Plasma Bomb ─────────────────────────────────────────
  {
    id: "plasma",
    title: "Plasma Bomb",
    unlockKills: 110,
    detail:
      "A charged plasma orb detonates on click. 2 damage in a 170px radius. Orb builds charge, travels to target, erupts with a plasma fountain.",
    hitPattern: "area",
    hitRadius: 170,
    damage: 2,
    effectColor: "#38bdf8",
    cooldownMs: 1500,
    inputMode: "click",
    hint: "Click to detonate — orb charges then plasma detonation",
  },

  // ── 10. Void Pulse ─────────────────────────────────────────
  {
    id: "void",
    title: "Void Pulse",
    unlockKills: 130,
    detail:
      "Reality distortion ultimate. Pulls all bugs inward before the nova erupts. 2 damage + instakill 1-HP in 220px. Chromatic aberration. Max screen shake.",
    hitPattern: "area",
    hitRadius: 220,
    damage: 2,
    instakillLowHp: true,
    appliesKnockback: true,
    effectColor: "#c084fc",
    cooldownMs: 4200,
    inputMode: "click",
    hint: "Click for reality nova — gravity pull then 220px obliteration",
  },
];
/** Convenience lookup: weapon id → kill threshold. */
export const WEAPON_UNLOCK_THRESHOLDS: Record<SiegeWeaponId, number> =
  Object.fromEntries(WEAPON_DEFS.map((w) => [w.id, w.unlockKills])) as Record<
    SiegeWeaponId,
    number
  >;
