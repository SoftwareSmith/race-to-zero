import { buildLinearWeaponTiers } from "@game/weapons/progression";
import { baseTier } from "./tiers/base";
import { tierFourTier } from "./tiers/tierFour";
import { tierOneTier } from "./tiers/tierOne";
import { tierThreeTier } from "./tiers/tierThree";
import { tierTwoTier } from "./tiers/tierTwo";

export const FORK_BOMB_TIERS = buildLinearWeaponTiers([
  baseTier,
  tierOneTier,
  tierTwoTier,
  tierThreeTier,
  tierFourTier,
]);