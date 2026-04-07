import type {
  EffectPalette,
  FireflyParticle,
  MotionProfile,
  SceneProfile,
  Tone,
} from "../types/dashboard";

export function createFireflyParticles(
  tone: "all-clear" | Tone,
): FireflyParticle[] {
  const palette = getEffectPalette(tone);
  const count = 10;
  const particles: FireflyParticle[] = [];

  for (let index = 0; index < count; index += 1) {
    particles.push({
      color: palette.fireflies[index % palette.fireflies.length],
      delay: `${(Math.random() * 6).toFixed(2)}s`,
      driftX: `${(Math.random() * 80 - 40).toFixed(0)}px`,
      duration: `${(6 + Math.random() * 8).toFixed(2)}s`,
      size: `${(6 + Math.random() * 18).toFixed(0)}px`,
      x: `${(Math.random() * 100).toFixed(2)}%`,
      y: `${(Math.random() * 100).toFixed(2)}%`,
    });
  }

  return particles;
}

export function getEffectPalette(tone: "all-clear" | Tone): EffectPalette {
  if (tone === "all-clear") {
    return {
      bug: "#7c7c7c",
      fireflies: ["#7CFC00", "#ADFF2F", "#7FFF00"],
      orbA: "rgba(120,200,255,0.15)",
      orbB: "rgba(120,255,180,0.12)",
    };
  }

  if (tone === "positive") {
    return {
      bug: "#22c55e",
      fireflies: ["#60A5FA", "#34D399", "#A3E635"],
      orbA: "rgba(96,165,250,0.12)",
      orbB: "rgba(34,211,153,0.08)",
    };
  }

  if (tone === "negative") {
    return {
      bug: "#dc3232",
      fireflies: ["#FCA5A5", "#FB7185", "#EF4444"],
      orbA: "rgba(248,113,113,0.12)",
      orbB: "rgba(239,68,68,0.08)",
    };
  }

  return {
    bug: "#c86428",
    fireflies: ["#FDE68A", "#FCA5A5", "#FCD34D"],
    orbA: "rgba(250,204,21,0.08)",
    orbB: "rgba(245,158,11,0.06)",
  };
}

export function getMotionProfile(tone: "all-clear" | Tone): MotionProfile {
  if (tone === "all-clear") {
    return { durationMultiplier: 0.6, opacityMultiplier: 0.8, scale: 0.9 };
  }

  if (tone === "positive") {
    return { durationMultiplier: 0.9, opacityMultiplier: 1, scale: 1 };
  }

  if (tone === "negative") {
    return { durationMultiplier: 1.2, opacityMultiplier: 1.05, scale: 1.06 };
  }

  return { durationMultiplier: 1, opacityMultiplier: 1, scale: 1 };
}

export function getSceneProfile(tone: "all-clear" | Tone): SceneProfile {
  if (tone === "all-clear") {
    return { chartFocusStrength: 0.12, clusterStrength: 0.06 };
  }

  if (tone === "positive") {
    return { chartFocusStrength: 0.18, clusterStrength: 0.12 };
  }

  if (tone === "negative") {
    return { chartFocusStrength: 0.28, clusterStrength: 0.22 };
  }

  return { chartFocusStrength: 0.2, clusterStrength: 0.12 };
}