import { WeaponTier } from "@game/types";

export type WeaponHeatStage = "warm" | "hot" | "overdrive";

export interface WeaponHeatProfile {
  accent: string;
  badgeText: string;
  burstScale: number;
  core: string;
  glow: string;
  label: string;
  stage: WeaponHeatStage;
}

export function getWeaponHeatStage(
  tier: WeaponTier | number,
  isMaxed = false,
): WeaponHeatStage {
  if (tier >= WeaponTier.TIER_FOUR || isMaxed) {
    return "overdrive";
  }

  if (tier >= WeaponTier.TIER_TWO) {
    return "hot";
  }

  return "warm";
}

export function getWeaponHeatProfile(
  tier: WeaponTier | number,
  isMaxed = false,
): WeaponHeatProfile {
  const stage = getWeaponHeatStage(tier, isMaxed);

  if (stage === "overdrive") {
    return {
      accent: "#fb923c",
      badgeText: "#fff4e5",
      burstScale: 1.42,
      core: "#fff7ed",
      glow: "rgba(239,68,68,0.4)",
      label: "Overdrive",
      stage,
    };
  }

  if (stage === "hot") {
    return {
      accent: "#f97316",
      badgeText: "#ffd3b0",
      burstScale: 1.22,
      core: "#ffedd5",
      glow: "rgba(239,68,68,0.26)",
      label: "Hot",
      stage,
    };
  }

  return {
    accent: "#f59e0b",
    badgeText: "#ffddb0",
    burstScale: 1,
    core: "#fed7aa",
    glow: "rgba(249,115,22,0.18)",
    label: "Warm",
    stage,
  };
}