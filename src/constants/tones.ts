import type { EffectPalette, MotionProfile, SceneProfile, Tone } from "../types/dashboard";

export const TONE_CONFIG: Record<Tone | "all-clear", {
  palette: EffectPalette;
  motion: MotionProfile;
  scene: SceneProfile;
}> = {
  "all-clear": {
    palette: {
      bug: "#7c7c7c",
    },
    motion: { durationMultiplier: 0.6, opacityMultiplier: 0.8, scale: 0.9 },
    scene: { chartFocusStrength: 0.12, clusterStrength: 0.06 },
  },

  positive: {
    palette: {
      bug: "#22c55e",
    },
    motion: { durationMultiplier: 0.9, opacityMultiplier: 1, scale: 1 },
    scene: { chartFocusStrength: 0.18, clusterStrength: 0.12 },
  },

  negative: {
    palette: {
      bug: "#dc3232",
    },
    motion: { durationMultiplier: 1.2, opacityMultiplier: 1.05, scale: 1.06 },
    scene: { chartFocusStrength: 0.28, clusterStrength: 0.22 },
  },

  neutral: {
    palette: {
      bug: "#c86428",
    },
    motion: { durationMultiplier: 1, opacityMultiplier: 1, scale: 1 },
    scene: { chartFocusStrength: 0.2, clusterStrength: 0.12 },
  },
};

export default TONE_CONFIG;
