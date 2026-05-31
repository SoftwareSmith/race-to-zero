import { WEAPON_EVOLVE_THRESHOLDS } from "@config/weaponEvolutionThresholds";
import {
  ALL_WEAPON_IDS,
  type SiegeWeaponId,
  type WeaponEvolutionState,
  WeaponTier,
} from "@game/types";

export class WeaponEvolutionTracker {
  private readonly states: Map<SiegeWeaponId, WeaponEvolutionState>;

  constructor({
    initialEvolutionStates,
    maxWeaponTier,
    onWeaponEvolution,
  }: {
    initialEvolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;
    maxWeaponTier: WeaponTier;
    onWeaponEvolution?: (weaponId: SiegeWeaponId, newTier: WeaponTier) => void;
  }) {
    this.maxWeaponTier = maxWeaponTier;
    this.onWeaponEvolution = onWeaponEvolution;
    this.states = new Map(
      ALL_WEAPON_IDS.map((id) => [
        id,
        {
          kills: initialEvolutionStates?.[id]?.kills ?? 0,
          tier: Math.min(
            initialEvolutionStates?.[id]?.tier ?? WeaponTier.TIER_ONE,
            maxWeaponTier,
          ) as WeaponTier,
        },
      ]),
    );
  }

  private readonly maxWeaponTier: WeaponTier;

  private readonly onWeaponEvolution?: (
    weaponId: SiegeWeaponId,
    newTier: WeaponTier,
  ) => void;

  recordKill(weaponId: SiegeWeaponId | undefined | null): void {
    if (!weaponId) {
      return;
    }

    const state = this.states.get(weaponId);
    if (!state) {
      return;
    }

    state.kills += 1;

    if (state.tier >= this.maxWeaponTier) {
      return;
    }

    this.checkEvolution(weaponId);
  }

  getStates(): Map<SiegeWeaponId, WeaponEvolutionState> {
    return this.states;
  }

  private checkEvolution(weaponId: SiegeWeaponId): void {
    const state = this.states.get(weaponId);
    if (!state || state.tier >= this.maxWeaponTier) {
      return;
    }

    const nextTier = (state.tier + 1) as WeaponTier;
    if (nextTier > this.maxWeaponTier) {
      return;
    }

    const threshold = WEAPON_EVOLVE_THRESHOLDS[weaponId][state.tier - 1];
    if (threshold != null && state.kills >= threshold) {
      state.tier = nextTier;
      this.onWeaponEvolution?.(weaponId, nextTier);
    }
  }
}