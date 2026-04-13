import { useCallback, useState } from "react";
import type { SiegeWeaponId, WeaponTier, WeaponEvolutionState } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";
import { WEAPON_EVOLVE_THRESHOLDS } from "@config/gameDefaults";

export type EvolutionStatesRecord = Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;

const ALL_IDS: SiegeWeaponId[] = [
  "hammer", "zapper", "freeze", "chain", "flame",
  "laser", "shockwave", "nullpointer", "plasma", "void",
];

const DEFAULT_STATES: EvolutionStatesRecord = Object.fromEntries(
  ALL_IDS.map((id) => [id, { tier: 1 as WeaponTier, kills: 0 }]),
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
      return (evolutionStates[id]?.tier ?? 1) as WeaponTier;
    },
    [evolutionStates],
  );

  /** Get the tier-appropriate display title for a weapon. */
  const getWeaponTitle = useCallback(
    (id: SiegeWeaponId, weaponDef: WeaponDef): string => {
      const tier = evolutionStates[id]?.tier ?? 1;
      return weaponDef.tierTitles?.[tier - 1] ?? weaponDef.title;
    },
    [evolutionStates],
  );

  /** Get kills-to-next-tier info. Returns null if already T3. */
  const getKillsToNextTier = useCallback(
    (id: SiegeWeaponId): { kills: number; needed: number } | null => {
      const state = evolutionStates[id];
      if (!state || state.tier >= 3) return null;
      const thresholds = WEAPON_EVOLVE_THRESHOLDS[id];
      const needed = state.tier === 1 ? thresholds[0] : thresholds[1];
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
