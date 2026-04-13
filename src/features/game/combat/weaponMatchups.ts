import { WeaponMatchup } from "@game/types";
import type {
  SiegeWeaponId,
  WeaponMatchupState,
  WeaponMatchupSummaryItem,
} from "@game/types";
import { getCodex } from "@game/engine/bugCodex";
import type { BugVariant } from "../../../types/dashboard";

const BUG_VARIANT_ORDER: BugVariant[] = ["low", "medium", "high", "urgent"];

export function getBugWeaponMatchup(
  variant: BugVariant,
  weaponId: SiegeWeaponId,
): WeaponMatchupState {
  const entry = getCodex()[variant];
  return entry?.weaponMatchups?.[weaponId]?.state ?? WeaponMatchup.Steady;
}

export function getWeaponMatchupSummary(
  weaponId: SiegeWeaponId,
): WeaponMatchupSummaryItem[] {
  return BUG_VARIANT_ORDER.map((variant) => ({
    variant,
    state: getBugWeaponMatchup(variant, weaponId),
  }));
}

export function applyMatchupDamage(
  damage: number,
  matchup: WeaponMatchupState,
): number {
  if (damage <= 0) {
    return 0;
  }
  if (matchup === WeaponMatchup.Immune) {
    return 0;
  }
  if (matchup === WeaponMatchup.Favored) {
    return Math.max(1, Math.round(damage * 1.5));
  }
  if (matchup === WeaponMatchup.Risky) {
    return Math.max(0, Math.floor(damage * 0.5));
  }
  return damage;
}

export function getMatchupFeedbackTone(matchup: WeaponMatchupState) {
  if (matchup === WeaponMatchup.Favored) return "effective" as const;
  if (matchup === WeaponMatchup.Risky) return "weak" as const;
  return "normal" as const;
}