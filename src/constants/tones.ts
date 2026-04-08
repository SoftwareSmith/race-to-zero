import type { EffectPalette, MotionProfile, SceneProfile, Tone } from "../types/dashboard";

export const TONE_CONFIG: Record<Tone | "all-clear", {
  palette: EffectPalette;
  motion: MotionProfile;
  scene: SceneProfile;
}> = {
  "all-clear": {
    palette: {
      bug: "#7c7c7c",
      fireflies: ["#7CFC00", "#ADFF2F", "#7FFF00"],
      orbA: "rgba(120,200,255,0.15)",
      orbB: "rgba(120,255,180,0.12)",
    },
    motion: { durationMultiplier: 0.6, opacityMultiplier: 0.8, scale: 0.9 },
    scene: { chartFocusStrength: 0.12, clusterStrength: 0.06 },
  },

  positive: {
    palette: {
      bug: "#22c55e",
      fireflies: ["#60A5FA", "#34D399", "#A3E635"],
      orbA: "rgba(96,165,250,0.12)",
      orbB: "rgba(34,211,153,0.08)",
    },
    motion: { durationMultiplier: 0.9, opacityMultiplier: 1, scale: 1 },
    scene: { chartFocusStrength: 0.18, clusterStrength: 0.12 },
  },

  negative: {
    palette: {
      bug: "#dc3232",
      fireflies: ["#FCA5A5", "#FB7185", "#EF4444"],
      orbA: "rgba(248,113,113,0.12)",
      orbB: "rgba(239,68,68,0.08)",
    },
    motion: { durationMultiplier: 1.2, opacityMultiplier: 1.05, scale: 1.06 },
    scene: { chartFocusStrength: 0.28, clusterStrength: 0.22 },
  },

  neutral: {
    palette: {
      bug: "#c86428",
      fireflies: ["#FDE68A", "#FCA5A5", "#FCD34D"],
      orbA: "rgba(250,204,21,0.08)",
      orbB: "rgba(245,158,11,0.06)",
    },
    motion: { durationMultiplier: 1, opacityMultiplier: 1, scale: 1 },
    scene: { chartFocusStrength: 0.2, clusterStrength: 0.12 },
  },
};

export default TONE_CONFIG;
