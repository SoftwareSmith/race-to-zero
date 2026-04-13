import { WeaponTier } from "@game/types";
import { buildLinearWeaponTiers } from "@game/weapons/progression";
import { baseTier } from "./tiers/base";
import { tierOneTier } from "./tiers/tierOne";
import { tierTwoTier } from "./tiers/tierTwo";

export const NULL_POINTER_TIERS = buildLinearWeaponTiers([
  baseTier,
  tierOneTier,
  tierTwoTier,
]);

export function canSpreadMarks(tier: WeaponTier): boolean {
  return tier >= WeaponTier.TIER_TWO;
}

export function canTriggerAutoScaler(tier: WeaponTier): boolean {
  return tier >= WeaponTier.TIER_THREE;
}

export function getExecuteHpLimit(tier: WeaponTier): number {
  return canSpreadMarks(tier) ? 2 : 1;
}