import type {
  SiegeCombatStats,
  SiegeWeaponId,
  WeaponProgressSnapshot,
  WeaponEvolutionState,
  WeaponTier,
} from "@game/types";
import { WeaponTier as WeaponTierEnum } from "@game/types";
import { WEAPON_DEFS, WEAPON_UNLOCK_THRESHOLDS } from "@config/weaponConfig";
import { getWeaponMatchupSummary } from "@game/combat/weaponMatchups";
import {
  getCurrentWeaponTierGoalKills,
  getCurrentWeaponTierStartKills,
  getKillsToNextTier,
  getWeaponMaxTier,
  getWeaponTierDetail,
  getWeaponTierHint,
  getWeaponTierTitle,
} from "@game/weapons/progression";

const WEAPON_LABELS: Record<SiegeWeaponId, string> = {
  hammer: "Hammer",
  nullpointer: "Garbage Collector",
  chain: "Lightning",
  plasma: "Fork Bomb",
  zapper: "Bug Spray",
  void: "Void Pulse",
  beacon: "Pulse Beacon",
  daemon: "Daemon Leash",
};

export function getSiegeWeaponLabel(weaponId: SiegeWeaponId): string {
  return WEAPON_LABELS[weaponId];
}

export function getSiegeCombatStats(
  totalFixed: number,
  debugMode = false,
): SiegeCombatStats {
  const unlockedWeapons: SiegeWeaponId[] = WEAPON_DEFS.filter(
    (w) => debugMode || totalFixed >= w.unlockKills,
  ).map((w) => w.id);

  const currentToolLabel = getSiegeWeaponLabel(
    unlockedWeapons[unlockedWeapons.length - 1],
  );

  return { unlockedWeapons, currentToolLabel };
}

export function getNextWeaponUnlock(totalFixed: number, debugMode = false) {
  if (debugMode) {
    return null;
  }

  const nextWeapon = WEAPON_DEFS.find((weapon) => totalFixed < weapon.unlockKills);
  if (!nextWeapon) {
    return null;
  }

  return {
    current: totalFixed,
    remaining: Math.max(0, nextWeapon.unlockKills - totalFixed),
    unlockKills: nextWeapon.unlockKills,
    weaponId: nextWeapon.id,
    weaponTitle: nextWeapon.title,
  };
}

export function getSiegeWeaponSnapshots(
  totalFixed: number,
  selectedId: SiegeWeaponId,
  debugMode = false,
  evolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>,
  maxWeaponTier = WeaponTierEnum.TIER_THREE,
): WeaponProgressSnapshot[] {
  const stats = getSiegeCombatStats(totalFixed, debugMode);
  const unlockedSet = new Set(stats.unlockedWeapons);

  return WEAPON_DEFS.map((weapon) => {
    const unlocked = unlockedSet.has(weapon.id);
    const remaining = Math.max(0, weapon.unlockKills - totalFixed);
    const evo = evolutionStates?.[weapon.id];
    const maxTier = Math.min(getWeaponMaxTier(weapon), maxWeaponTier) as WeaponTier;
    const tier = Math.min(evo?.tier ?? WeaponTierEnum.TIER_ONE, maxTier) as WeaponTier;
    const weaponKills = evo?.kills ?? 0;
    const cappedEvolutionState: WeaponEvolutionState = { kills: weaponKills, tier };
    const killsToNextTier = getKillsToNextTier(weapon, cappedEvolutionState, maxTier);
    const currentTierStartKills = getCurrentWeaponTierStartKills(weapon, tier);
    const nextTierGoalKills =
      tier >= maxTier ? null : getCurrentWeaponTierGoalKills(weapon, tier);

    return {
      id: weapon.id,
      title: getWeaponTierTitle(weapon, tier),
      hint: getWeaponTierHint(weapon, tier),
      currentTierStartKills,
      typeLabel: weapon.typeLabel,
      typeHint: weapon.typeHint,
      inputMode: weapon.inputMode,
      cooldownMs: weapon.cooldownMs,
      locked: !unlocked,
      current: weapon.id === selectedId,
      detail: getWeaponTierDetail(weapon, tier),
      maxTier,
      nextTierGoalKills,
      unlockKills: weapon.unlockKills,
      matchupSummary: getWeaponMatchupSummary(weapon.id),
      tier,
      weaponKills,
      killsToNextTier,
      progressText:
        weapon.unlockKills === 0
          ? "Online from first click"
          : debugMode
            ? "Debug mode override"
          : unlocked
            ? `Unlocked at ${weapon.unlockKills} bugs fixed`
            : `${remaining} fixes to unlock`,
    };
  });
}

export { WEAPON_UNLOCK_THRESHOLDS as SIEGE_UNLOCK_THRESHOLDS };