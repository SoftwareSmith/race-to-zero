import { WeaponTier } from "@game/types";
import { buildLinearWeaponTiers } from "@game/weapons/progression";
import type { BugSnapshot, GameEngine } from "@game/weapons/runtime/types";
import { baseTier } from "./tiers/base";
import { tierFourTier } from "./tiers/tierFour";
import { tierOneTier } from "./tiers/tierOne";
import { tierThreeTier } from "./tiers/tierThree";
import { tierTwoTier } from "./tiers/tierTwo";

export const NULL_POINTER_TIERS = buildLinearWeaponTiers([
  baseTier,
  tierOneTier,
  tierTwoTier,
  tierThreeTier,
  tierFourTier,
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

export function getPriorityTargets(
  engine: GameEngine,
  x: number,
  y: number,
  searchRadius: number,
  targetCount: number,
): Array<{ bug: BugSnapshot; index: number }> {
  return engine
    .getAllBugs()
    .map((bug, index) => ({
      bug,
      distance: Math.hypot(bug.x - x, bug.y - y),
      hp: bug.hp ?? 1,
      index,
    }))
    .filter((candidate) => candidate.distance <= searchRadius)
    .sort((left, right) => {
      if (right.hp !== left.hp) {
        return right.hp - left.hp;
      }
      return left.distance - right.distance;
    })
    .slice(0, Math.max(1, targetCount))
    .map(({ bug, index }) => ({ bug, index }));
}