import { useCallback, useState } from "react";
import { ALL_WEAPON_IDS, WeaponTier } from "@game/types";
import type { SiegeWeaponId, WeaponEvolutionState } from "@game/types";
import { WEAPON_DEFS } from "@config/weaponConfig";
import type { WeaponDef } from "@game/weapons/types";
import {
  getKillsToNextTier as getNextTierKillDelta,
  getWeaponTierTitle,
} from "@game/weapons/progression";

export type EvolutionStatesRecord = Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;

const DEFAULT_STATES: EvolutionStatesRecord = Object.fromEntries(
  ALL_WEAPON_IDS.map((id) => [id, { tier: WeaponTier.TIER_ONE, kills: 0 }]),
) as EvolutionStatesRecord;

export function useWeaponEvolution() {
  const [evolutionStates, setEvolutionStates] = useState<EvolutionStatesRecord>(
    DEFAULT_STATES,
  );

  /** Called by the Engine's onWeaponEvolution callback — syncs localStorage. */
  const onEvolution = useCallback(
    (weaponId: SiegeWeaponId, newTier: WeaponTier) => {
      setEvolutionStates((prev: EvolutionStatesRecord) => ({
        ...prev,
        [weaponId]: { ...prev[weaponId], tier: newTier },
      }));
    },
    [setEvolutionStates],
  );

  /** Sync the full evolution state map from Engine after kills accumulate. */
  const syncFromEngine = useCallback(
    (states: Map<SiegeWeaponId, WeaponEvolutionState>) => {
      const record: EvolutionStatesRecord = {};
      for (const [id, state] of states) {
        record[id] = state;
      }
      setEvolutionStates(record);
    },
    [setEvolutionStates],
  );

  /** Get the current tier for a weapon. */
  const getWeaponTier = useCallback(
    (id: SiegeWeaponId): WeaponTier => {
      return evolutionStates[id]?.tier ?? WeaponTier.TIER_ONE;
    },
    [evolutionStates],
  );

  /** Get the tier-appropriate display title for a weapon. */
  const getWeaponTitle = useCallback(
    (id: SiegeWeaponId, weaponDef: WeaponDef): string => {
      const tier = evolutionStates[id]?.tier ?? WeaponTier.TIER_ONE;
      return getWeaponTierTitle(weaponDef, tier);
    },
    [evolutionStates],
  );

  /** Get kills-to-next-tier info. Returns null if already T3. */
  const getKillsToNextTier = useCallback(
    (id: SiegeWeaponId): { kills: number; needed: number } | null => {
      const state = evolutionStates[id];
      if (!state) return null;
      const needed = getNextTierKillDelta(weaponDefById[id], state);
      if (needed == null) return null;
      return { kills: state.kills, needed };
    },
    [evolutionStates],
  );

  /** Reset all weapons to T1 (useful for testing). */
  const resetEvolution = useCallback(() => {
    setEvolutionStates(DEFAULT_STATES);
  }, [setEvolutionStates]);

  return {
    evolutionStates,
    onEvolution,
    syncFromEngine,
    getWeaponTier,
    getWeaponTitle,
    getKillsToNextTier,
    resetEvolution,
  };
}

const weaponDefById = Object.fromEntries(
  WEAPON_DEFS.map((weapon) => [weapon.id, weapon]),
) as Record<SiegeWeaponId, WeaponDef>;
