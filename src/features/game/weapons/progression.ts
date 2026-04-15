import { WeaponTier, type WeaponEvolutionState } from "@game/types";
import type { WeaponDef, WeaponTierDefinition } from "@game/weapons/types";

function getTierIndex(tier: WeaponTier): number {
  return tier - 1;
}

export function buildLinearWeaponTiers(
  tiers: readonly Omit<WeaponTierDefinition, "evolution">[],
): readonly WeaponTierDefinition[] {
  const linked = tiers.map((tier) => ({ ...tier })) as WeaponTierDefinition[];
  for (let index = 0; index < linked.length - 1; index += 1) {
    linked[index].evolution = linked[index + 1];
  }
  return linked;
}

export function getWeaponTiers(def: WeaponDef): readonly WeaponTierDefinition[] {
  return def.tiers;
}

export function getWeaponTierDefinition(
  def: WeaponDef,
  tier: WeaponTier,
): WeaponTierDefinition {
  const tiers = getWeaponTiers(def);
  return tiers[getTierIndex(tier)] ?? tiers[tiers.length - 1];
}

export function getWeaponMaxTier(def: WeaponDef): WeaponTier {
  const tiers = getWeaponTiers(def);
  return (tiers[tiers.length - 1]?.tier ?? WeaponTier.TIER_ONE) as WeaponTier;
}

export function getNextWeaponTierDefinition(
  def: WeaponDef,
  tier: WeaponTier,
): WeaponTierDefinition | null {
  const tiers = getWeaponTiers(def);
  return tiers[getTierIndex(tier) + 1] ?? null;
}

export function getCurrentWeaponTierStartKills(
  def: WeaponDef,
  tier: WeaponTier,
): number {
  const tiers = getWeaponTiers(def);
  return tiers[getTierIndex(tier) - 1]?.evolveAtKills ?? 0;
}

export function getCurrentWeaponTierGoalKills(
  def: WeaponDef,
  tier: WeaponTier,
): number | null {
  return getWeaponTierDefinition(def, tier).evolveAtKills ?? null;
}

export function isWeaponEvolutionMaxed(
  def: WeaponDef,
  state: WeaponEvolutionState | undefined,
): boolean {
  return (
    getNextWeaponTierDefinition(def, state?.tier ?? WeaponTier.TIER_ONE) == null
  );
}

export function getWeaponTierTitle(def: WeaponDef, tier: WeaponTier): string {
  return getWeaponTierDefinition(def, tier).title;
}

export function getWeaponTierHint(def: WeaponDef, tier: WeaponTier): string {
  return getWeaponTierDefinition(def, tier).hint;
}

export function getWeaponTierDetail(def: WeaponDef, tier: WeaponTier): string {
  return getWeaponTierDefinition(def, tier).detail;
}

export function getWeaponEvolutionThresholds(def: WeaponDef): [number, number] {
  const tiers = getWeaponTiers(def);
  return [
    tiers[0]?.evolveAtKills ?? 0,
    tiers[1]?.evolveAtKills ?? Number.MAX_SAFE_INTEGER,
  ];
}

export function getKillsToNextTier(
  def: WeaponDef,
  state: WeaponEvolutionState | undefined,
): number | null {
  const currentTier = getWeaponTierDefinition(
    def,
    state?.tier ?? WeaponTier.TIER_ONE,
  );

  if (!currentTier.evolution) {
    return null;
  }

  return Math.max(0, (currentTier.evolveAtKills ?? 0) - (state?.kills ?? 0));
}