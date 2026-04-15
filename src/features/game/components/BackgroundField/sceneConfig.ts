import {
  getEffectPalette,
  getMotionProfile,
  getSceneProfile,
} from "@game/utils/backgroundScene";
import type { Tone } from "../../../../types/dashboard";

export function getBackgroundSceneConfig(
  tone: Tone,
  effectiveBugCount: number,
) {
  const visualTone = effectiveBugCount === 0 ? "all-clear" : tone;

  return {
    colors: getEffectPalette(visualTone),
    motionProfile: getMotionProfile(visualTone),
    sceneProfile: getSceneProfile(visualTone),
  };
}