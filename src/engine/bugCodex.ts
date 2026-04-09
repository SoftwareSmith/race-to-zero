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
    edgePreference: 0.04,
    noiseFrequency: 0.9,
    noiseForwardStrength: 0.2,
    noiseLateralStrength: 0.72,
    noiseTurnStrength: 1.05,
    regionWeights: { edge: 0.12, middle: 0.56, interior: 0.32 },
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
    edgePreference: -0.02,
    noiseFrequency: 0.64,
    noiseForwardStrength: 0.14,
    noiseLateralStrength: 0.38,
    noiseTurnStrength: 0.6,
    regionWeights: { edge: 0.1, middle: 0.54, interior: 0.36 },
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
    edgePreference: -0.08,
    noiseFrequency: 0.42,
    noiseForwardStrength: 0.08,
    noiseLateralStrength: 0.14,
    noiseTurnStrength: 0.26,
    regionWeights: { edge: 0.08, middle: 0.4, interior: 0.52 },
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
    edgePreference: 0,
    noiseFrequency: 1.18,
    noiseForwardStrength: 0.28,
    noiseLateralStrength: 0.88,
    noiseTurnStrength: 1.22,
    regionWeights: { edge: 0.14, middle: 0.54, interior: 0.32 },
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
  dossier: {
    encounter: string;
    pressure: string;
    strength: string;
    susceptibility: string;
    weakness: string;
  };
  profile: CrawlProfile;
  socialAffinity?: number; // positive likes groups, negative prefers solitude
  preferredRegion?: CrawlRegion;
  iconVariant?: string; // reference to a built-in svg variant
  iconUrl?: string; // custom icon URL
  color?: string; // optional override color for this type
  size?: number; // optional size multiplier for this type
  weaponMatchups: BugWeaponMatchups;
}

export type BugWeaponId = "hammer" | "laser" | "pulse";

export type BugWeaponMatchupState = "favored" | "steady" | "risky";

export interface BugWeaponMatchup {
  note: string;
  state: BugWeaponMatchupState;
}

export type BugWeaponMatchups = Record<BugWeaponId, BugWeaponMatchup>;

function createWeaponMatchups(
  overrides: Partial<BugWeaponMatchups> = {},
): BugWeaponMatchups {
  return {
    hammer: {
      note: "Serviceable cleanup, but not the primary answer.",
      state: "steady",
      ...overrides.hammer,
    },
    laser: {
      note: "Useful once the lane is stable enough to stay on target.",
      state: "steady",
      ...overrides.laser,
    },
    pulse: {
      note: "Helps manage spread, but timing matters more than raw output.",
      state: "steady",
      ...overrides.pulse,
    },
  };
}

export const BUG_CODEX: Record<string, BugType> = {
  low: {
    id: "low",
    name: "Glitchling",
    description: "A noisy entry-level defect that slips through gaps, crowds screens, and clutters the lanes before anyone notices.",
    dossier: {
      encounter: "Usually appears as the first visible spreader when the board starts to fill and small defects begin leaking into active areas.",
      pressure: "Builds pressure through numbers rather than resilience.",
      strength: "Shows up in clusters and spreads visual noise quickly across open lanes.",
      susceptibility: "Low vitality means any direct damage removes it immediately.",
      weakness: "Falls apart fast once attention is focused on it.",
    },
    profile: CRAWL_PROFILES.low,
    socialAffinity: 0.6,
    preferredRegion: "middle",
    weaponMatchups: createWeaponMatchups({
      hammer: {
        note: "Fine for single cleanup once a straggler is already isolated.",
        state: "steady",
      },
      laser: {
        note: "Keeps lanes tidy, but it is usually more precision than you need.",
        state: "steady",
      },
      pulse: {
        note: "Best answer when Glitchlings are flooding in clusters and visual noise is building.",
        state: "favored",
      },
    }),
  },
  medium: {
    id: "medium",
    name: "Throttler",
    description: "A steady pressure bug that slows the board down, patrols broad routes, and keeps resurfacing in active paths.",
    dossier: {
      encounter: "Most common during sustained backlog pressure, where medium-priority defects keep reappearing across the board.",
      pressure: "Applies consistent drag and occupies space longer than low-tier bugs.",
      strength: "Balanced route coverage lets it persist across multiple active zones.",
      susceptibility: "Can absorb some damage, but still folds once isolated and hit directly.",
      weakness: "Lacks the burst movement or resilience of higher-severity classes.",
    },
    profile: CRAWL_PROFILES.medium,
    socialAffinity: 0.2,
    preferredRegion: "middle",
    weaponMatchups: createWeaponMatchups({
      hammer: {
        note: "Can get stuck trading one-for-one while the patrol route keeps pressure alive.",
        state: "risky",
      },
      laser: {
        note: "Strongest option for shaving down steady route pressure before it loops back around.",
        state: "favored",
      },
      pulse: {
        note: "Useful when the board is getting crowded, but not a hard counter by itself.",
        state: "steady",
      },
    }),
  },
  high: {
    id: "high",
    name: "Nullify",
    description: "A focused breaker that cuts through the interior, isolates targets, and removes breathing room from the dashboard.",
    dossier: {
      encounter: "Shows up when concentrated risk starts forming around the center of the board and high-pressure zones stop clearing cleanly.",
      pressure: "Creates concentrated pressure and steals safe space from the interior.",
      strength: "Prefers interior routes and turns open space into narrow operating windows.",
      susceptibility: "More durable than lower classes, but still predictable once its line is identified.",
      weakness: "Can be isolated and cleared if engaged before other classes stack around it.",
    },
    profile: CRAWL_PROFILES.high,
    socialAffinity: -0.3,
    preferredRegion: "interior",
    weaponMatchups: createWeaponMatchups({
      hammer: {
        note: "Closing distance gives Nullify too much room to steal the center lane back.",
        state: "risky",
      },
      laser: {
        note: "Best tool once its line is identified, letting you pin the interior before it stacks pressure.",
        state: "favored",
      },
      pulse: {
        note: "Good for softening interior pressure, but it still needs follow-up focus.",
        state: "steady",
      },
    }),
  },
  urgent: {
    id: "urgent",
    name: "ZeroDay",
    description: "A critical outbreak class that spreads unpredictably, spikes pressure instantly, and refuses to stay pinned for long.",
    dossier: {
      encounter: "Appears during peak escalation, when the board is already stressed and a critical failure class breaks containment.",
      pressure: "Creates immediate crisis pressure through speed, survivability, and erratic movement.",
      strength: "Hard to pin down, hard to outpace, and dangerous if left alive while the field is busy.",
      susceptibility: "No special weapon counter is assumed; the advantage comes from early focus and space control.",
      weakness: "Most manageable before it stacks with additional pressure waves or surrounding bugs.",
    },
    profile: CRAWL_PROFILES.urgent,
    socialAffinity: -0.1,
    preferredRegion: "middle",
    iconVariant: "urgent",
    weaponMatchups: createWeaponMatchups({
      hammer: {
        note: "Too volatile to rely on close-range cleanup alone once the outbreak is moving.",
        state: "risky",
      },
      laser: {
        note: "Worth using only when you already created a stable lane and can keep focus on target.",
        state: "steady",
      },
      pulse: {
        note: "Helps stabilize surrounding pressure, but it does not directly solve the outbreak.",
        state: "steady",
      },
    }),
  },
};

function cloneWeaponMatchups(
  source: Partial<BugWeaponMatchups> | undefined,
  fallback: BugWeaponMatchups,
) {
  return {
    hammer: { ...fallback.hammer, ...source?.hammer },
    laser: { ...fallback.laser, ...source?.laser },
    pulse: { ...fallback.pulse, ...source?.pulse },
  } satisfies BugWeaponMatchups;
}

export function cloneCodex(source: Record<string, BugType>) {
  return Object.fromEntries(
    Object.entries(source).map(([key, entry]) => [
      key,
      (() => {
        const defaultEntry = BUG_CODEX[key] ?? entry;

        return {
          ...entry,
          profile: {
            ...entry.profile,
            anchorDriftInterval: [
              ...entry.profile.anchorDriftInterval,
            ] as [number, number],
            regionWeights: { ...entry.profile.regionWeights },
          },
          dossier: { ...defaultEntry.dossier, ...entry.dossier },
          weaponMatchups: cloneWeaponMatchups(
            entry.weaponMatchups,
            defaultEntry.weaponMatchups,
          ),
        };
      })(),
    ]),
  ) as Record<string, BugType>;
}

// runtime codex that can be replaced by persisted edits
let CURRENT_CODEX: Record<string, BugType> = cloneCodex(BUG_CODEX);

export function getCodex() {
  return CURRENT_CODEX;
}

export function setCodex(next: Record<string, BugType>) {
  CURRENT_CODEX = cloneCodex(next);
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
      CURRENT_CODEX = cloneCodex(parsed as Record<string, BugType>);
    }
  } catch {
    // ignore
  }
}

export function resetCodexToDefaults() {
  const nextCodex = cloneCodex(BUG_CODEX);
  setCodex(nextCodex);
  return nextCodex;
}

export default BUG_CODEX;
