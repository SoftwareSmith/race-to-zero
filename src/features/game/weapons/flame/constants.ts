/**
 * Flamethrower — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { FLAME_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.Flame;

export const CURSOR = {
  accent: "#f97316",
  aura: "0 0 24px rgba(249,115,22,0.35)",
  size: 50,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: FLAME_TIERS[0].title,
  typeLabel: "Thermal",
  typeHint: "Ignites flammable bugs and turns clustered lanes into panic zones.",
  weaponType: "thermal",
  unlockKills: 52,
  detail: FLAME_TIERS[0].detail,
  hitPattern: HitPattern.Cone,
  hitRadius: 150,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  damage: 0,
  coneArcDeg: 70,
  applyBurn: true,
  burnDps: 6,
  burnDurationMs: 1200,
  burnDecayPerSecond: 3.2,
  effectColor: CURSOR.accent,
  cooldownMs: 200,
  inputMode: WeaponInputMode.Hold,
  hint: FLAME_TIERS[0].hint,
  tiers: FLAME_TIERS,
};
