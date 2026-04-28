import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { DAEMON_LEASH_TIERS } from "./helpers";

export const ID = WeaponId.DaemonLeash;

export const CURSOR = {
  accent: "#34d399",
  aura: "0 0 28px rgba(52,211,153,0.28)",
  size: 50,
  showCrosshair: false,
} as const;

export const BASE_TOGGLES = {
  cooldownMs: 2600,
  seekRadius: 480,
  hitRadius: 480,
  impactRadius: 26,
  reticleRadius: 18,
  shockwaveRadius: 132,
  allyDurationMs: 6000,
  allyCap: 4,
  allyInterceptForce: 2.3,
  allyExpireBurstRadius: 64,
  allyExpireBurstDamage: 1,
  damage: 2,
  splashRadius: 100,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: DAEMON_LEASH_TIERS[0].title,
  typeLabel: "Conversion",
  typeHint: "Hijacks a priority bug and turns it into a moving disruption source.",
  weaponType: "precision",
  unlockKills: 92,
  detail: DAEMON_LEASH_TIERS[0].detail,
  hitPattern: HitPattern.Seeking,
  hitRadius: BASE_TOGGLES.hitRadius,
  cursor: CURSOR,
  overlayEffectDurationMs: 1100,
  damage: BASE_TOGGLES.damage,
  effectColor: CURSOR.accent,
  cooldownMs: BASE_TOGGLES.cooldownMs,
  inputMode: WeaponInputMode.Seeking,
  hint: DAEMON_LEASH_TIERS[0].hint,
  toggles: BASE_TOGGLES,
  tiers: DAEMON_LEASH_TIERS,
};