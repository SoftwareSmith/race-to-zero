import { WeaponTier, type StructureId } from "../types";

export interface StructureEntry {
  id: string;
  type: StructureId;
  tier: WeaponTier;
  x: number;
  y: number;
  nextCaptureAt: number;
  absorbing: {
    variant: string;
    bugX: number;
    bugY: number;
    pullFromX: number;
    pullFromY: number;
    pullStartedAt: number;
    size: number;
    completesAt: number;
    failChance: number;
  } | null;
}

const MAX_STRUCTURES_PER_TYPE = 2;

export class EngineStructureState {
  private entries: StructureEntry[] = [];

  addStructure(
    x: number,
    y: number,
    type: StructureId,
    elapsedMs: number,
    forcedId?: string,
  ) {
    const existing = this.entries.filter((entry) => entry.type === type);
    if (existing.length >= MAX_STRUCTURES_PER_TYPE) {
      const oldest = existing[0];
      this.entries = this.entries.filter((entry) => entry.id !== oldest.id);
    }

    const id =
      forcedId ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.entries.push({
      absorbing: null,
      id,
      nextCaptureAt: elapsedMs + 1400,
      tier: WeaponTier.TIER_ONE,
      type,
      x,
      y,
    });
    return id;
  }

  updateStructureTier(id: string, tier: WeaponTier) {
    const entry = this.entries.find((structure) => structure.id === id);
    if (entry) {
      entry.tier = tier;
    }
  }

  removeStructure(id: string) {
    this.entries = this.entries.filter((entry) => entry.id !== id);
  }

  getStructures() {
    return this.entries.map(({ id, type, tier, x, y }) => ({
      id,
      type,
      tier,
      x,
      y,
    }));
  }

  getEntries() {
    return this.entries;
  }
}