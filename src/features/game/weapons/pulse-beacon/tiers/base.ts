import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Pulse Beacon",
  detail:
    "Drops a hard-edged signal pulse that marks a cluster for cleanup and gives the lane a clear target.",
  hint: "Click a choke point to mark bugs inside the pulse ring",
  effectColor: "#fbbf24",
  evolveAtKills: 28,
  hitPattern: HitPattern.Area,
  toggles: {
    cooldownMs: 1200,
    markRadius: 120,
    markDurationMs: 3200,
    impactRadius: 30,
    reticleRadius: 44,
    shockwaveRadius: 128,
  },
  vfx: {
    intensity: "basic",
    summary: "Amber ping with a tight utility ring and readable targeting core.",
  },
  behavior: {
    summary: "Tags a pack so the next direct weapon can cash the lane out cleanly.",
  },
};