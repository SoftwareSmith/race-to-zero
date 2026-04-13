import type { BugType, BugWeaponMatchupState } from "@game/engine/bugCodex";
import { WeaponMatchup } from "@game/types";
import { getBugVariantColor } from "../../../constants/bugs";
import type { BugVariant } from "../../../types/dashboard";

export interface VariantAccent {
  badgeClass: string;
  behaviorClass: string;
  cardClass: string;
  iconBorderClass: string;
  iconHalo: string;
  iconPanel: string;
  metricFillClass: string;
  metricFillGradient: string;
  metricGlow: string;
  metricGlowStrong: string;
  metricValueClass: string;
  washA: string;
  washB: string;
}

const VARIANT_HEX: Record<BugVariant, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  urgent: "#a78bfa",
};

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  const bigint = parseInt(cleaned, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r},${g},${b}`;
}

export function getThreatLabel(variant: BugVariant) {
  if (variant === "urgent") return "Critical";
  if (variant === "high") return "High";
  if (variant === "medium") return "Medium";
  return "Low";
}

export function getBehaviorLabel(behavior: BugType["profile"]["behavior"]) {
  if (behavior === "panic") return "Erratic";
  if (behavior === "stalk") return "Hunter";
  if (behavior === "patrol") return "Patrol";
  return "Skitter";
}

export function getSpeedLabel(entry: BugType) {
  if (entry.profile.speedMultiplier >= 1.02) return "Moves quickly";
  if (entry.profile.speedMultiplier <= 0.86) return "Slow mover";
  return "Steady pace";
}

export function getResilienceLabel(hp: number) {
  if (hp >= 4) return "Very tanky";
  if (hp >= 3) return "Tough";
  if (hp >= 2) return "Moderately durable";
  return "Fragile";
}

export function getPresenceLabel(presence: number) {
  if (presence >= 88) return "Very visible";
  if (presence >= 72) return "Notable on the board";
  if (presence >= 56) return "Easily missed at a glance";
  return "Low presence";
}

export function getWeaponEffectiveness(state: BugWeaponMatchupState) {
  if (state === WeaponMatchup.Favored) return 88;
  if (state === WeaponMatchup.Immune) return 6;
  if (state === WeaponMatchup.Risky) return 28;
  return 58;
}

export function getWeaponStateClasses(state: BugWeaponMatchupState) {
  if (state === WeaponMatchup.Immune) {
    return {
      badge: "border-rose-400/24 bg-rose-500/12 text-rose-100",
      panel: "border-rose-400/16 bg-rose-500/8",
      tile: "border-rose-300/16 bg-rose-400/10 text-rose-50",
      fill: "bg-rose-500/90",
      glow: "0 0 18px rgba(251,113,133,0.45)",
    };
  }

  if (state === WeaponMatchup.Favored) {
    return {
      badge: "border-emerald-400/24 bg-emerald-500/12 text-emerald-100",
      panel: "border-emerald-400/16 bg-emerald-500/8",
      tile: "border-emerald-300/16 bg-emerald-400/10 text-emerald-50",
      fill: "bg-emerald-500/90",
      glow: "0 0 18px rgba(52,211,153,0.45)",
    };
  }

  if (state === WeaponMatchup.Risky) {
    return {
      badge: "border-amber-400/24 bg-amber-500/12 text-amber-100",
      panel: "border-amber-400/16 bg-amber-500/8",
      tile: "border-amber-300/16 bg-amber-400/10 text-amber-50",
      fill: "bg-amber-500/90",
      glow: "0 0 18px rgba(251,191,36,0.4)",
    };
  }

  return {
    badge: "border-sky-400/18 bg-sky-500/10 text-sky-100",
    panel: "border-white/8 bg-white/[0.03]",
    tile: "border-white/8 bg-white/[0.04] text-stone-100",
    fill: "bg-sky-400/90",
    glow: "0 0 16px rgba(56,189,248,0.38)",
  };
}

export function getVariantAccent(variant: BugVariant): VariantAccent {
  const baseRgb = hexToRgb(VARIANT_HEX[variant] ?? getBugVariantColor(variant));
  const fullGradient = `linear-gradient(90deg, rgba(${baseRgb},1) 0%, rgba(${baseRgb},0) 100%)`;

  if (variant === "urgent") {
    return {
      badgeClass:
        "border-violet-400/30 bg-violet-500/14 text-violet-100 shadow-[0_0_22px_rgba(167,139,250,0.18)]",
      iconBorderClass: "border-violet-400/30",
      metricValueClass:
        "border-violet-400/36 bg-violet-500/36 text-violet-100 shadow-[0_0_20px_rgba(167,139,250,0.18)]",
      metricFillClass: "bg-violet-500",
      metricGlow: "0 0 32px rgba(167,139,250,0.52)",
      metricGlowStrong: "0 0 44px rgba(167,139,250,0.68)",
      behaviorClass: "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100",
      cardClass: "from-violet-500/12 via-fuchsia-500/6 to-black/20",
      iconHalo: "rgba(167,139,250,0.34)",
      iconPanel: "from-violet-500/18 via-fuchsia-500/8 to-red-500/12",
      washA: "rgba(167,139,250,0.18)",
      washB: "rgba(244,63,94,0.14)",
      metricFillGradient: fullGradient,
    };
  }

  if (variant === "high") {
    return {
      badgeClass:
        "border-red-400/28 bg-red-500/14 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.16)]",
      iconBorderClass: "border-red-400/28",
      metricValueClass:
        "border-red-400/36 bg-red-500/36 text-red-100 shadow-[0_0_20px_rgba(248,113,113,0.18)]",
      metricFillClass: "bg-red-500",
      metricGlow: "0 0 32px rgba(248,113,113,0.52)",
      metricGlowStrong: "0 0 44px rgba(248,113,113,0.68)",
      behaviorClass: "border-orange-400/20 bg-orange-500/10 text-orange-100",
      cardClass: "from-red-500/12 via-orange-500/6 to-black/20",
      iconHalo: "rgba(248,113,113,0.28)",
      iconPanel: "from-red-500/18 via-orange-500/8 to-sky-400/10",
      washA: "rgba(248,113,113,0.16)",
      washB: "rgba(251,146,60,0.12)",
      metricFillGradient: fullGradient,
    };
  }

  if (variant === "medium") {
    return {
      badgeClass:
        "border-amber-400/28 bg-amber-500/12 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.15)]",
      iconBorderClass: "border-amber-400/28",
      metricValueClass:
        "border-amber-400/36 bg-amber-500/36 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.18)]",
      metricFillClass: "bg-amber-500",
      metricGlow: "0 0 30px rgba(251,191,36,0.5)",
      metricGlowStrong: "0 0 42px rgba(251,191,36,0.64)",
      behaviorClass: "border-orange-300/18 bg-orange-400/10 text-orange-100",
      cardClass: "from-amber-500/12 via-orange-500/6 to-black/20",
      iconHalo: "rgba(251,191,36,0.22)",
      iconPanel: "from-amber-500/16 via-orange-500/8 to-sky-400/10",
      washA: "rgba(251,191,36,0.16)",
      washB: "rgba(249,115,22,0.10)",
      metricFillGradient: fullGradient,
    };
  }

  return {
    badgeClass:
      "border-emerald-400/22 bg-emerald-500/10 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.12)]",
    iconBorderClass: "border-emerald-400/22",
    metricValueClass:
      "border-emerald-400/32 bg-emerald-500/32 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.16)]",
    metricFillClass: "bg-emerald-500",
    metricGlow: "0 0 30px rgba(45,212,191,0.5)",
    metricGlowStrong: "0 0 42px rgba(45,212,191,0.66)",
    behaviorClass: "border-sky-400/16 bg-sky-500/8 text-sky-100",
    cardClass: "from-emerald-500/12 via-cyan-500/6 to-black/20",
    iconHalo: "rgba(45,212,191,0.18)",
    iconPanel: "from-emerald-500/14 via-cyan-500/6 to-white/8",
    washA: "rgba(45,212,191,0.14)",
    washB: "rgba(56,189,248,0.10)",
    metricFillGradient: fullGradient,
  };
}