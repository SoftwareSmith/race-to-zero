import type { MotionProfile, SceneProfile, Tone } from "../../../types/dashboard";
import TONE_CONFIG from "../../../constants/tones";

/** Motion profile for moving bugs */
export function getMotionProfile(tone: "all-clear" | Tone): MotionProfile {
  return TONE_CONFIG[tone]?.motion ?? TONE_CONFIG.neutral.motion;
}

/** Scene configuration for clustering, chart focus etc */
export function getSceneProfile(tone: "all-clear" | Tone): SceneProfile {
  return TONE_CONFIG[tone]?.scene ?? TONE_CONFIG.neutral.scene;
}

export function getEffectPalette(tone: "all-clear" | Tone) {
  return TONE_CONFIG[tone]?.palette ?? TONE_CONFIG.neutral.palette;
}