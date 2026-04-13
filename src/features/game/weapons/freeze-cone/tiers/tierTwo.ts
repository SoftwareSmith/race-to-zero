import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { FREEZE_CONE_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Segment Fault",
  detail:
    "Escalates the freeze pulse into a global board-wide stall that catches every active bug at once.",
  hint: "T3: Global freeze — slows every active bug on the entire field",
  effectColor: "#bfdbfe",
  config: {
    hitRadius: 600,
  },
  vfx: FREEZE_CONE_TIER_VFX.tierTwo,
  behavior: {
    summary: "Converts a local control tool into a full-screen tempo reset.",
  },
};