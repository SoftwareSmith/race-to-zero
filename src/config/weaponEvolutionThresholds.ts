import type { SiegeWeaponId } from "@game/types";
import { WEAPON_REGISTRY } from "@game/weapons";
import { getWeaponEvolutionThresholds } from "@game/weapons/progression";

export const WEAPON_EVOLVE_THRESHOLDS: Record<SiegeWeaponId, number[]> =
  Object.fromEntries(
    WEAPON_REGISTRY.map((weapon) => [
      weapon.id,
      getWeaponEvolutionThresholds(weapon),
    ]),
  ) as Record<SiegeWeaponId, number[]>;