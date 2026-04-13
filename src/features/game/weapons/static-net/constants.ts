/**
 * Static Net — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { STATIC_NET_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.StaticNet;

export const CURSOR = {
  accent: "#a78bfa",
  aura: "0 0 26px rgba(167,139,250,0.3)",
  size: 54,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: STATIC_NET_TIERS[0].title,
  typeLabel: "Electric",
  typeHint: "Locks enemies in place so follow-up hits feel guaranteed.",
  weaponType: "electric",
  unlockKills: 82,
  detail: STATIC_NET_TIERS[0].detail,
  hitPattern: HitPattern.Area,
  hitRadius: 200,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  damage: 0,
  applyEnsnare: true,
  ensnareDurationMs: 3000,
  effectColor: "#e2e8f0",
  cooldownMs: 4000,
  inputMode: WeaponInputMode.Click,
  hint: STATIC_NET_TIERS[0].hint,
  tiers: STATIC_NET_TIERS,
};
