/**
 * Chain Zap — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { CHAIN_ZAP_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.ChainZap;

export const CURSOR = {
  accent: "#6ee7b7",
  aura: "0 0 24px rgba(110,231,183,0.28)",
  size: 48,
  showCrosshair: false,
  /** Pulsing ring animation class applied to the outer cursor ring. */
  ringClassName: "[animation:laser-cursor-breathe_2s_ease-in-out_infinite]",
} as const;

export const BASE_TOGGLES = {
  damage: 2,
  hitRadius: 90,
  cooldownMs: 950,
  chainRadius: 90,
  chainMaxBounces: 3,
  secondaryDamage: 1,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: CHAIN_ZAP_TIERS[0].title,
  typeLabel: "Electric",
  typeHint: "Jumps between clustered targets and rewards charged setups.",
  weaponType: "electric",
  unlockKills: 42,
  detail: CHAIN_ZAP_TIERS[0].detail,
  hitPattern: HitPattern.Chain,
  hitRadius: 90,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  damage: BASE_TOGGLES.damage,
  chainMaxBounces: BASE_TOGGLES.chainMaxBounces,
  effectColor: CURSOR.accent,
  cooldownMs: BASE_TOGGLES.cooldownMs,
  inputMode: WeaponInputMode.Click,
  hint: CHAIN_ZAP_TIERS[0].hint,
  toggles: BASE_TOGGLES,
  tiers: CHAIN_ZAP_TIERS,
};
