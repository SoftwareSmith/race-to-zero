import type {
  SiegeCombatStats,
  SiegeWeaponId,
  WeaponProgressSnapshot,
} from "@game/types";
import { WEAPON_DEFS, WEAPON_UNLOCK_THRESHOLDS } from "@config/weaponConfig";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import type { StructureId } from "@game/types";

const WEAPON_LABELS: Record<SiegeWeaponId, string> = {
  wrench: "Wrench",
  zapper: "Bug Zapper",
  pulse: "Pulse Cannon",
  pointer: "Debug Pointer",
  freeze: "Freeze Cone",
  chain: "Chain Zap",
  laser: "Directional Laser",
  bomb: "Pixel Bomb",
  shockwave: "Shockwave",
  nullpointer: "Null Pointer",
  flame: "Flamethrower",
  stomp: "Boot Stomp",
  swatter: "Fly Swatter",
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
): WeaponProgressSnapshot[] {
  const stats = getSiegeCombatStats(totalFixed, debugMode);
  const unlockedSet = new Set(stats.unlockedWeapons);

  return WEAPON_DEFS.map((weapon) => {
    const unlocked = unlockedSet.has(weapon.id);
    const remaining = Math.max(0, weapon.unlockKills - totalFixed);
    return {
      id: weapon.id,
      title: weapon.title,
      hint: weapon.hint,
      inputMode: weapon.inputMode,
      cooldownMs: weapon.cooldownMs,
      locked: !unlocked,
      current: weapon.id === selectedId,
      detail: weapon.detail,
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