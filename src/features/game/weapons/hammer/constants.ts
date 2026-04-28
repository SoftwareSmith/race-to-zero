/**
 * Hammer — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { HAMMER_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.Hammer;

export const CURSOR = {
  accent: "#f8fafc",
  aura: "0 0 22px rgba(248,250,252,0.28)",
  size: 48,
  showCrosshair: false,
} as const;

export const DAMAGE = 2;
export const SEARCH_RADIUS = 48;
export const T3_ALLY_DURATION_MS = 6500;
export const T3_ALLY_CAP = 5;
export const T3_ALLY_INTERCEPT_FORCE = 2.5;
export const T3_ALLY_EXPIRE_BURST_RADIUS = 54;
export const T3_ALLY_EXPIRE_BURST_DAMAGE = 1;

export const BASE_TOGGLES = {
  damage: DAMAGE,
  hitRadius: SEARCH_RADIUS,
  cooldownMs: 300,
  allyDurationMs: 0,
  allyCap: 0,
  allyInterceptForce: 0,
  allyExpireBurstRadius: 0,
  allyExpireBurstDamage: 0,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: HAMMER_TIERS[0].title,
  typeLabel: "Blunt",
  typeHint: "Crushes armored targets and stays reliable when precision is tight.",
  weaponType: "blunt",
  unlockKills: 0,
  detail: HAMMER_TIERS[0].detail,
  hitPattern: HitPattern.Single,
  hitRadius: SEARCH_RADIUS,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  damage: BASE_TOGGLES.damage,
  effectColor: CURSOR.accent,
  cooldownMs: BASE_TOGGLES.cooldownMs,
  inputMode: WeaponInputMode.Click,
  hint: HAMMER_TIERS[0].hint,
  toggles: BASE_TOGGLES,
  tiers: HAMMER_TIERS,
};
