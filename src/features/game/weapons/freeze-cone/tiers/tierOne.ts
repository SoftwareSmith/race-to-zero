import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { FREEZE_CONE_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "System Fault",
  detail:
    "Replaces the slow with full ensnare, setting up instant-kill follow-up clicks on frozen bugs.",
  hint: "T2: Full ensnare instead of slow — click ensnared bugs to instakill",
  effectColor: "#bfdbfe",
  evolveAtKills: 60,
  config: {
    applyEnsnare: true,
  },
  vfx: FREEZE_CONE_TIER_VFX.tierOne,
  behavior: {
    summary: "Pushes the cryo plan from slowdown into full capture and execution setup.",
  },
};