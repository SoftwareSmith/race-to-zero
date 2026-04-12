import type {
  SiegeCombatStats,
  SiegeWeaponId,
  WeaponProgressSnapshot,
  WeaponEvolutionState,
  WeaponTier,
} from "@game/types";
import { WEAPON_DEFS, WEAPON_UNLOCK_THRESHOLDS } from "@config/weaponConfig";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { WEAPON_EVOLVE_THRESHOLDS } from "@config/gameDefaults";
import type { StructureId } from "@game/types";

const WEAPON_LABELS: Record<SiegeWeaponId, string> = {
  hammer: "Hammer",
  zapper: "Bug Zapper",
  freeze: "Freeze Cone",
  chain: "Chain Zap",
  flame: "Flamethrower",
  laser: "Directional Laser",
  shockwave: "Shockwave",
  nullpointer: "Null Pointer",
  plasma: "Plasma Arc",
  void: "Void Pulse",
};

export function getSiegeCombatStats(
  totalFixed: number,
  debugMode = false,
): SiegeCombatStats {
  const unlockedWeapons: SiegeWeaponId[] = WEAPON_DEFS.filter(
    (w) => debugMode || totalFixed >= w.unlockKills,
  ).map((w) => w.id);

  const unlockedStructures: StructureId[] = STRUCTURE_DEFS.filter(
    (s) => debugMode || totalFixed >= s.unlockKills,
  ).map((s) => s.id);

  const currentToolLabel =
    WEAPON_LABELS[unlockedWeapons[unlockedWeapons.length - 1]];

  return { unlockedWeapons, currentToolLabel, unlockedStructures };
}

export function getSiegeWeaponSnapshots(
  totalFixed: number,
  selectedId: SiegeWeaponId,
  debugMode = false,
  evolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>,
): WeaponProgressSnapshot[] {
  const stats = getSiegeCombatStats(totalFixed, debugMode);
  const unlockedSet = new Set(stats.unlockedWeapons);

  return WEAPON_DEFS.map((weapon) => {
    const unlocked = unlockedSet.has(weapon.id);
    const remaining = Math.max(0, weapon.unlockKills - totalFixed);
    const evo = evolutionStates?.[weapon.id];
    const tier: WeaponTier = evo?.tier ?? 1;
    const weaponKills = evo?.kills ?? 0;
    const thresholds = WEAPON_EVOLVE_THRESHOLDS[weapon.id];
    const killsToNextTier: number | null =
      tier === 3
        ? null
        : tier === 2
          ? Math.max(0, thresholds[1] - weaponKills)
          : Math.max(0, thresholds[0] - weaponKills);

    // Use tier-appropriate title
    const tierTitle =
      weapon.tierTitles?.[tier - 1] ?? weapon.title;

    return {
      id: weapon.id,
      title: tierTitle,
      hint: weapon.tierHints?.[tier - 1] ?? weapon.hint,
      inputMode: weapon.inputMode,
      cooldownMs: weapon.cooldownMs,
      locked: !unlocked,
      current: weapon.id === selectedId,
      detail: weapon.tierDetails?.[tier - 1] ?? weapon.detail,
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