/**
 * Bug Spray — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { BUG_SPRAY_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.BugSpray;

export const CURSOR = {
  accent: "#fde047",
  aura: "0 0 22px rgba(253,224,71,0.3)",
  size: 48,
  showCrosshair: false,
} as const;

export const BASE_TOGGLES = {
  hitRadius: 128,
  cooldownMs: 120,
  coneArcDeg: 80,
  poisonDps: 0.65,
  poisonDurationMs: 450,
  cloudRadius: 96,
  cloudDurationMs: 2400,
  cloudIntervalMs: 400,
  secondaryRadius: 56,
  secondaryDurationMs: 800,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: BUG_SPRAY_TIERS[0].title,
  typeLabel: "Toxin",
  typeHint: "Poisons swarms and rewards area denial over burst damage.",
  weaponType: "toxin",
  unlockKills: 98,
  detail: BUG_SPRAY_TIERS[0].detail,
  hitPattern: HitPattern.Cone,
  hitRadius: 128,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  coneArcDeg: 80,
  damage: 0,
  applyPoison: true,
  poisonDps: BASE_TOGGLES.poisonDps,
  poisonDurationMs: BASE_TOGGLES.poisonDurationMs,
  effectColor: CURSOR.accent,
  cooldownMs: BASE_TOGGLES.cooldownMs,
  inputMode: WeaponInputMode.Hold,
  hint: BUG_SPRAY_TIERS[0].hint,
  toggles: BASE_TOGGLES,
  tiers: BUG_SPRAY_TIERS,
};
