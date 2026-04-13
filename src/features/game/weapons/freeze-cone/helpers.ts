import { buildLinearWeaponTiers } from "@game/weapons/progression";
import { baseTier } from "./tiers/base";
import { tierOneTier } from "./tiers/tierOne";
import { tierTwoTier } from "./tiers/tierTwo";

export const FREEZE_CONE_TIERS = buildLinearWeaponTiers([
  baseTier,
  tierOneTier,
  tierTwoTier,
]);