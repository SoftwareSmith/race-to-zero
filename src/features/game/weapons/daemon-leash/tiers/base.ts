import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Daemon Leash",
  detail:
    "Hooks the nearest priority bug and flips it into a temporary ally that starts peeling pressure off the lane.",
  hint: "Click near a threat to hijack it into a short-lived interceptor",
  effectColor: "#34d399",
  evolveAtKills: 34,
  hitPattern: HitPattern.Seeking,
  toggles: {
    cooldownMs: 2600,
    seekRadius: 480,
    impactRadius: 26,
    reticleRadius: 18,
    shockwaveRadius: 132,
    allyDurationMs: 6000,
    allyCap: 4,
    allyInterceptForce: 2.3,
    allyExpireBurstRadius: 64,
    allyExpireBurstDamage: 1,
  },
  vfx: {
    intensity: "basic",
    summary: "Emerald tether and pulse burst make the conversion read immediately.",
  },
  behavior: {
    summary: "Converts one threat into breathing room without turning into a passive turret.",
  },
};