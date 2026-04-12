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
  return entry?.weaponMatchups?.[weaponId]?.state ?? "steady";
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
  if (matchup === "immune") {
    return 0;
  }
  if (matchup === "favored") {
    return Math.max(1, Math.round(damage * 1.5));
  }
  if (matchup === "risky") {
    return Math.max(0, Math.floor(damage * 0.5));
  }
  return damage;
}

export function getMatchupFeedbackTone(matchup: WeaponMatchupState) {
  if (matchup === "favored") return "effective" as const;
  if (matchup === "risky") return "weak" as const;
  return "normal" as const;
}