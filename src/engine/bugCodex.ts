import type { Vec2 } from "./types";

export type CrawlRegion = "edge" | "middle" | "interior";

export interface CrawlProfile {
  behavior: "skitter" | "patrol" | "stalk" | "panic";
  anchorDriftInterval: [number, number];
  anchorBias: "any" | "interior" | "perimeter";
  edgePreference: number;
  noiseFrequency: number;
  noiseForwardStrength: number;
  noiseLateralStrength: number;
  noiseTurnStrength: number;
  regionWeights: {
    edge: number;
    interior: number;
    middle: number;
  };
  roamRadius: number;
  separationMultiplier: number;
  speedMultiplier: number;
  turnMultiplier: number;
  wanderMultiplier: number;
  wideRoamChance: number;
}

export const CRAWL_PROFILES: Record<string, CrawlProfile> = {
  low: {
    behavior: "skitter",
    anchorDriftInterval: [8, 14],
    anchorBias: "any",
    edgePreference: 0.18,
    noiseFrequency: 0.9,
    noiseForwardStrength: 0.2,
    noiseLateralStrength: 0.72,
    noiseTurnStrength: 1.05,
    regionWeights: { edge: 0.24, middle: 0.48, interior: 0.28 },
    roamRadius: 150,
    separationMultiplier: 1.35,
    speedMultiplier: 0.82,
    turnMultiplier: 1.18,
    wanderMultiplier: 1.2,
    wideRoamChance: 0.18,
  },
  medium: {
    behavior: "patrol",
    anchorDriftInterval: [7, 12],
    anchorBias: "any",
    edgePreference: 0,
    noiseFrequency: 0.64,
    noiseForwardStrength: 0.14,
    noiseLateralStrength: 0.38,
    noiseTurnStrength: 0.6,
    regionWeights: { edge: 0.22, middle: 0.5, interior: 0.28 },
    roamRadius: 180,
    separationMultiplier: 1.1,
    speedMultiplier: 0.95,
    turnMultiplier: 1,
    wanderMultiplier: 0.85,
    wideRoamChance: 0.28,
  },
  high: {
    behavior: "stalk",
    anchorDriftInterval: [6, 10],
    anchorBias: "any",
    edgePreference: -0.06,
    noiseFrequency: 0.42,
    noiseForwardStrength: 0.08,
    noiseLateralStrength: 0.14,
    noiseTurnStrength: 0.26,
    regionWeights: { edge: 0.18, middle: 0.44, interior: 0.38 },
    roamRadius: 220,
    separationMultiplier: 0.9,
    speedMultiplier: 1.06,
    turnMultiplier: 0.86,
    wanderMultiplier: 0.55,
    wideRoamChance: 0.36,
  },
  urgent: {
    behavior: "panic",
    anchorDriftInterval: [4, 8],
    anchorBias: "any",
    edgePreference: 0.12,
    noiseFrequency: 1.18,
    noiseForwardStrength: 0.28,
    noiseLateralStrength: 0.88,
    noiseTurnStrength: 1.22,
    regionWeights: { edge: 0.24, middle: 0.46, interior: 0.3 },
    roamRadius: 280,
    separationMultiplier: 0.75,
    speedMultiplier: 1,
    turnMultiplier: 1.28,
    wanderMultiplier: 1,
    wideRoamChance: 0.52,
  },
};

export interface BugType {
  id: string;
  name: string;
  description: string;
  profile: CrawlProfile;
  socialAffinity?: number; // positive likes groups, negative prefers solitude
  preferredRegion?: CrawlRegion;
  iconVariant?: string; // reference to a built-in svg variant
  iconUrl?: string; // custom icon URL
  color?: string; // optional override color for this type
  size?: number; // optional size multiplier for this type
}

export const BUG_CODEX: Record<string, BugType> = {
  low: {
    id: "low",
    name: "Skitter",
    description: "Small, quick bugs that like to cluster along edges.",
    profile: CRAWL_PROFILES.low,
    socialAffinity: 0.6,
    preferredRegion: "middle",
  },
  medium: {
    id: "medium",
    name: "Crawler",
    description: "Moderate speed, balanced roaming across the field.",
    profile: CRAWL_PROFILES.medium,
    socialAffinity: 0.2,
    preferredRegion: "middle",
  },
  high: {
    id: "high",
    name: "Stalker",
    description: "Faster, prefers interior regions and loner behavior.",
    profile: CRAWL_PROFILES.high,
    socialAffinity: -0.3,
    preferredRegion: "interior",
  },
  urgent: {
    id: "urgent",
    name: "Panic",
    description: "Fast and skittish; darts widely and avoids crowds.",
    profile: CRAWL_PROFILES.urgent,
    socialAffinity: -0.1,
    preferredRegion: "middle",
    iconVariant: "urgent",
  },
};

// runtime codex that can be replaced by persisted edits
let CURRENT_CODEX: Record<string, BugType> = { ...BUG_CODEX };

export function getCodex() {
  return CURRENT_CODEX;
}

export function setCodex(next: Record<string, BugType>) {
  CURRENT_CODEX = { ...next };
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("race-to-zero:bug-codex", JSON.stringify(CURRENT_CODEX));
    }
  } catch {
    // ignore storage errors
  }
}

export function loadCodexFromStorage() {
  try {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("race-to-zero:bug-codex");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      CURRENT_CODEX = parsed as Record<string, BugType>;
    }
  } catch {
    // ignore
  }
}

export default BUG_CODEX;
