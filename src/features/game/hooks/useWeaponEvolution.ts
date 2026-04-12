import { useCallback } from "react";
import { useStoredState } from "../../../hooks/useStoredState";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import type { SiegeWeaponId, WeaponTier, WeaponEvolutionState } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";
import { WEAPON_EVOLVE_THRESHOLDS } from "@config/gameDefaults";

export type EvolutionStatesRecord = Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;

const ALL_IDS: SiegeWeaponId[] = [
  "hammer", "zapper", "freeze", "chain", "flame",
  "laser", "shockwave", "nullpointer", "plasma", "void",
];

function parseEvolutionStates(raw: string): EvolutionStatesRecord | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const result: EvolutionStatesRecord = {};
    for (const id of ALL_IDS) {
      const entry = parsed[id];
      if (entry && typeof entry.tier === "number" && typeof entry.kills === "number") {
        result[id] = { tier: entry.tier as WeaponTier, kills: entry.kills };
      }
    }
    return result;
  } catch {
    return null;
  }
}

function serializeEvolutionStates(value: EvolutionStatesRecord): string {
  return JSON.stringify(value);
}

const DEFAULT_STATES: EvolutionStatesRecord = Object.fromEntries(
  ALL_IDS.map((id) => [id, { tier: 1 as WeaponTier, kills: 0 }]),
) as EvolutionStatesRecord;

export function useWeaponEvolution() {
  const [evolutionStates, setEvolutionStates] = useStoredState<EvolutionStatesRecord>(
    STORAGE_KEYS.weaponEvolutionStates,
    DEFAULT_STATES,
    { parse: parseEvolutionStates, serialize: serializeEvolutionStates },
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
