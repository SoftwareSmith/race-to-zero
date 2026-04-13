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

export const def: WeaponDef = {
  id: ID,
  title: CHAIN_ZAP_TIERS[0].title,
  typeLabel: "Electric",
  typeHint: "Jumps between clustered targets and rewards charged setups.",
  weaponType: "electric",
  unlockKills: 38,
  detail: CHAIN_ZAP_TIERS[0].detail,
  hitPattern: HitPattern.Chain,
  hitRadius: 90,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  damage: 2,
  chainMaxBounces: 3,
  effectColor: CURSOR.accent,
  cooldownMs: 950,
  inputMode: WeaponInputMode.Click,
  hint: CHAIN_ZAP_TIERS[0].hint,
  tiers: CHAIN_ZAP_TIERS,
};
