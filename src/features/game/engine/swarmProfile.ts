import type { BugType } from "./bugCodex";

export type BugSwarmRole =
  | "screen-swarm"
  | "lane-patrol"
  | "hunter-pack"
  | "disruptor";

export interface BugSwarmProfile {
  coordination: string;
  label: string;
  pressure: number;
  role: BugSwarmRole;
  summary: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toPercent(value: number) {
  return Math.round(clamp(value, 0.18, 1) * 100);
}

export function getBugSwarmProfile(entry: BugType): BugSwarmProfile {
  const affinity = entry.socialAffinity ?? 0;
  const behavior = entry.profile.behavior;

  if (behavior === "stalk") {
    return {
      coordination: affinity <= 0 ? "Operates best with space" : "Collapses after a mark",
      label: "Hunter pack",
      pressure: toPercent(0.72 + entry.profile.speedMultiplier * 0.12),
      role: "hunter-pack",
      summary:
        "Cuts into the interior, isolates a lane, and cashes in once nearby bugs force the player off-center.",
    };
  }

  if (behavior === "patrol") {
    return {
      coordination: affinity >= 0.2 ? "Trades lanes with nearby bugs" : "Cycles broad routes",
      label: "Lane patrol",
      pressure: toPercent(0.58 + entry.profile.roamRadius / 420),
      role: "lane-patrol",
      summary:
        "Rotates pressure across wider routes and keeps resurfacing in active lanes instead of diving straight in.",
    };
  }

  if (behavior === "panic") {
    return {
      coordination: "Breaks formation on contact",
      label: "Disruptor",
      pressure: toPercent(0.54 + entry.profile.noiseLateralStrength * 0.18),
      role: "disruptor",
      summary:
        "Burns space through erratic movement, forcing quick corrections instead of holding a clean formation.",
    };
  }

  return {
    coordination: affinity >= 0.35 ? "Crowds into shared lanes" : "Screens in loose packs",
    label: "Screen swarm",
    pressure: toPercent(
      0.5 +
        affinity * 0.22 +
        entry.profile.wanderMultiplier * 0.12 +
        entry.profile.speedMultiplier * 0.08,
    ),
    role: "screen-swarm",
    summary:
      "Builds pressure by spreading visual noise, crowding open routes, and making direct cleanup less efficient.",
  };
}