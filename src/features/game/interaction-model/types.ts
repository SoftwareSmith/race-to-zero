import type { WeaponMatchupState } from "@game/types";

export type WeaponType = "blunt" | "fire" | "electric";

export type BugTrait = "armored" | "flammable";

export type StatusEffectId = "burn";

export type InteractionStrength = WeaponMatchupState;

export interface StatusEffectDefinition {
  id: StatusEffectId;
  sourceType: WeaponType;
  damagePerSecond: number;
  durationMs: number;
}

export interface WeaponConfig {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  statusesOnHit?: StatusEffectDefinition[];
}

export interface WeaponBehavior {
  hitShape: "single" | "arc" | "area";
  reach: number;
  description: string;
}

export interface WeaponVfx {
  hitEffect: string;
  strongHitEffect: string;
  weakHitEffect: string;
  immuneHitEffect: string;
}

export interface WeaponModule {
  config: WeaponConfig;
  behavior: WeaponBehavior;
  vfx: WeaponVfx;
}

export interface BugDefinition {
  id: string;
  name: string;
  maxHp: number;
  traits: BugTrait[];
  weakTo?: WeaponType[];
  resistantTo?: WeaponType[];
  immuneTo?: WeaponType[];
}

export interface AppliedStatus {
  effect: StatusEffectDefinition;
  reason: string;
}

export interface InteractionResult {
  outcome: InteractionStrength;
  damage: number;
  appliedStatuses: AppliedStatus[];
  blockedStatuses: StatusEffectId[];
  notes: string[];
}