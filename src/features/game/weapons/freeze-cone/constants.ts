/**
 * Freeze Cone — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { FREEZE_CONE_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.Freeze;

export const CURSOR = {
  accent: "#bfdbfe",
  aura: "0 0 22px rgba(191,219,254,0.32)",
  size: 50,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: FREEZE_CONE_TIERS[0].title,
  typeLabel: "Cryo",
  typeHint: "Controls space by slowing or pinning fast threats in place.",
  weaponType: "cryo",
  unlockKills: 25,
  detail: FREEZE_CONE_TIERS[0].detail,
  hitPattern: HitPattern.Area,
  hitRadius: 180,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  appliesSlow: true,
  effectColor: CURSOR.accent,
  cooldownMs: 820,
  inputMode: WeaponInputMode.Click,
  hint: FREEZE_CONE_TIERS[0].hint,
  tiers: FREEZE_CONE_TIERS,
};
