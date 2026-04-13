/**
 * Hammer — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { HAMMER_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.Hammer;

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
  damage: DAMAGE,
  effectColor: CURSOR.accent,
  cooldownMs: 300,
  inputMode: WeaponInputMode.Click,
  hint: HAMMER_TIERS[0].hint,
  tiers: HAMMER_TIERS,
};
