import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Orbit Lock",
  detail:
    "The beacon tears open a local event horizon so marked bugs keep collapsing back into the click point.",
  hint: "T3: the pulse leaves a short gravity lock at the target point",
  effectColor: "#fbbf24",
  evolveAtKills: 104,
  toggles: {
    secondaryRadius: 156,
    secondaryDurationMs: 2400,
    shockwaveRadius: 144,
  },
  vfx: {
    intensity: "amplified",
    summary: "Adds a dense orbital drag field under the beacon pulse.",
  },
  behavior: {
    summary: "Converts a click into a short-lived pull trap for clustered swarms.",
  },
};