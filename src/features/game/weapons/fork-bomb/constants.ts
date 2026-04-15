/**
 * Fork Bomb — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { FORK_BOMB_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.ForkBomb;

export const CURSOR = {
  accent: "#38bdf8",
  aura: "0 0 26px rgba(56,189,248,0.35)",
  size: 52,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: FORK_BOMB_TIERS[0].title,
  typeLabel: "Plasma",
  typeHint: "Breaks dense bug packs with overlapping explosive bursts.",
  weaponType: "plasma",
  unlockKills: 70,
  detail: FORK_BOMB_TIERS[0].detail,
  hitPattern: HitPattern.Area,
  hitRadius: 48,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  damage: 2,
  effectColor: CURSOR.accent,
  cooldownMs: 1100,
  inputMode: WeaponInputMode.Click,
  hint: FORK_BOMB_TIERS[0].hint,
  tiers: FORK_BOMB_TIERS,
};
