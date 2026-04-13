/**
 * Tracer Bloom — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { TRACER_BLOOM_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.TracerBloom;

export const CURSOR = {
  accent: "#f87171",
  aura: "0 0 24px rgba(248,113,113,0.28)",
  size: 48,
  showCrosshair: true,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: TRACER_BLOOM_TIERS[0].title,
  typeLabel: "Precision",
  typeHint: "Picks apart priority targets and scales hardest off existing status effects.",
  weaponType: "precision",
  unlockKills: 68,
  detail: TRACER_BLOOM_TIERS[0].detail,
  hitPattern: HitPattern.Line,
  hitRadius: 38,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  effectColor: CURSOR.accent,
  cooldownMs: 900,
  inputMode: WeaponInputMode.Click,
  hint: TRACER_BLOOM_TIERS[0].hint,
  tiers: TRACER_BLOOM_TIERS,
};
