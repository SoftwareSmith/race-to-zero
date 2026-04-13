/**
 * Single source of truth for all bug variant definitions:
 * visual appearance, physics parameters, crawl behaviour,
 * combat matchups, and lore text.
 *
 * Everything that was previously split across
 *   src/constants/bugs.ts  (BugVariantConfig, BUG_VARIANT_CONFIG)
 *   src/engine/bugCodex.ts (CrawlProfile, CRAWL_PROFILES, BUG_CODEX identity fields)
 * is consolidated here.
 */

import type { SiegeWeaponId, WeaponMatchupState } from "@game/types";
import type { BugVariant } from "../types/dashboard";

// ── Crawl behaviour types ─────────────────────────────────────────────────────

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

// ── Weapon matchup types ──────────────────────────────────────────────────────

export type BugWeaponId = SiegeWeaponId;
export type BugWeaponMatchupState = WeaponMatchupState;

export interface BugWeaponMatchup {
  note: string;
  state: BugWeaponMatchupState;
}

export type BugWeaponMatchups = Record<BugWeaponId, BugWeaponMatchup>;

// ── Unified variant definition ────────────────────────────────────────────────

export interface BugVariantDef {
  // Identity
  id: BugVariant;
  name: string;
  description: string;
  dossier: {
    encounter: string;
    pressure: string;
    strength: string;
    susceptibility: string;
    weakness: string;
  };

  // Visual / physics
  baseColor: string;
  baseScale: number;
  bobAmplitude: number;
  bobFrequency: number;
  darken: number;
  defaultOpacity: number;
  maxHp: number;
  /** Points awarded to the player for defeating this bug type. */
  pointValue: number;
  sizeBoost: number;
  swayAmplitude: number;
  swayFrequency: number;

  // Optional icon override
  iconVariant?: string;
  iconUrl?: string;

  // Crawl behaviour
  crawlProfile: CrawlProfile;
  socialAffinity?: number;
  preferredRegion?: CrawlRegion;

  // Combat
  weaponMatchups: BugWeaponMatchups;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function steadyMatchups(
  overrides: Partial<BugWeaponMatchups> = {},
): BugWeaponMatchups {
  return {
    hammer: {
      note: "Serviceable cleanup, but not the primary answer.",
      state: "steady",
      ...overrides.hammer,
    },
    zapper: {
      note: "Manages spread with EMP bursts, but timing matters more than raw output.",
      state: "steady",
      ...overrides.zapper,
    },
    freeze: {
      note: "Slows the target, but low priority unless it's fast or flanking.",
      state: "steady",
      ...overrides.freeze,
    },
    chain: {
      note: "Good at linking clustered bugs, but not always the cleanest answer.",
      state: "steady",
      ...overrides.chain,
    },
    flame: {
      note: "Pressure tool that matters most when bugs stay in the burn zone.",
      state: "steady",
      ...overrides.flame,
    },
    laser: {
      note: "Reliable line pressure, best when the route is already clear.",
      state: "steady",
      ...overrides.laser,
    },
    shockwave: {
      note: "Useful for clearing surrounding pressure, not a direct counter.",
      state: "steady",
      ...overrides.shockwave,
    },
    nullpointer: {
      note: "Reserve for high-HP targets; overkill against low-threat types.",
      state: "steady",
      ...overrides.nullpointer,
    },
    plasma: {
      note: "Cluster breaker that shines when multiple bugs overlap.",
      state: "steady",
      ...overrides.plasma,
    },
    void: {
      note: "Control option for elite bugs; too slow for disposable cleanup.",
      state: "steady",
      ...overrides.void,
    },
  };
}

// ── Single source of truth ────────────────────────────────────────────────────

export const BUG_VARIANT_DEFS: Record<BugVariant, BugVariantDef> = {
  low: {
    id: "low",
    name: "Glitchling",
    description:
      "A noisy entry-level defect that slips through gaps, crowds screens, and clutters the lanes before anyone notices.",
    dossier: {
      encounter:
        "Usually appears as the first visible spreader when the board starts to fill and small defects begin leaking into active areas.",
      pressure: "Builds pressure through numbers rather than resilience.",
      strength:
        "Shows up in clusters and spreads visual noise quickly across open lanes.",
      susceptibility:
        "Low vitality means any direct damage removes it immediately.",
      weakness: "Falls apart fast once attention is focused on it.",
    },
    baseColor: "#7c7c7c",
    baseScale: 0.8,
    bobAmplitude: 8,
    bobFrequency: 6,
    darken: 0.6,
    defaultOpacity: 0.6,
    maxHp: 1,
    pointValue: 1,
    sizeBoost: 0,
    swayAmplitude: 7,
    swayFrequency: 5.6,
    crawlProfile: {
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
    socialAffinity: 0.6,
    preferredRegion: "middle",
    weaponMatchups: steadyMatchups({
      hammer: {
        note: "Fine for single cleanup once a straggler is already isolated.",
        state: "steady",
      },
      zapper: {
        note: "Best answer when Glitchlings are flooding in clusters and visual noise is building.",
        state: "favored",
      },
      chain: {
        note: "Electric bounce can miss the smallest runners when the field is loose.",
        state: "risky",
      },
      flame: {
        note: "Flammable swarm fodder — flames shred them fast and force panic movement.",
        state: "favored",
      },
      laser: {
        note: "Works, but the route setup is usually overkill for a 1-HP target.",
        state: "steady",
      },
      shockwave: {
        note: "Massive overkill on a 1-HP type, but clears the whole swarm in one blast.",
        state: "favored",
      },
      plasma: {
        note: "Explosions erase clustered Glitchlings, but single targets waste the payload.",
        state: "steady",
      },
      void: {
        note: "Too small and disposable — the gravity well is the wrong answer here.",
        state: "immune",
      },
    }),
  },

  medium: {
    id: "medium",
    name: "Throttler",
    description:
      "A steady pressure bug that slows the board down, patrols broad routes, and keeps resurfacing in active paths.",
    dossier: {
      encounter:
        "Most common during sustained backlog pressure, where medium-priority defects keep reappearing across the board.",
      pressure:
        "Applies consistent drag and occupies space longer than low-tier bugs.",
      strength:
        "Balanced route coverage lets it persist across multiple active zones.",
      susceptibility:
        "Can absorb some damage, but still folds once isolated and hit directly.",
      weakness:
        "Lacks the burst movement or resilience of higher-severity classes.",
    },
    baseColor: "#c86428",
    baseScale: 1,
    bobAmplitude: 10,
    bobFrequency: 4.8,
    darken: 0.8,
    defaultOpacity: 0.75,
    maxHp: 2,
    pointValue: 2,
    sizeBoost: 1,
    swayAmplitude: 8,
    swayFrequency: 4.2,
    crawlProfile: {
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
    socialAffinity: 0.2,
    preferredRegion: "middle",
    weaponMatchups: steadyMatchups({
      hammer: {
        note: "Can get stuck trading one-for-one while the patrol route keeps pressure alive.",
        state: "risky",
      },
      zapper: {
        note: "Useful when the board is getting crowded, but not a hard counter by itself.",
        state: "steady",
      },
      freeze: {
        note: "Slowing patrol routes gives you crucial breathing room to follow up.",
        state: "favored",
      },
      chain: {
        note: "Electric arcs catch patrol formations cleanly and reward grouped pressure.",
        state: "favored",
      },
      flame: {
        note: "Burning lanes slows the patrol advance, but it is more pressure than counterplay.",
        state: "favored",
      },
    }),
  },

  high: {
    id: "high",
    name: "Nullify",
    description:
      "A focused breaker that cuts through the interior, isolates targets, and removes breathing room from the dashboard.",
    dossier: {
      encounter:
        "Shows up when concentrated risk starts forming around the center of the board and high-pressure zones stop clearing cleanly.",
      pressure:
        "Creates concentrated pressure and steals safe space from the interior.",
      strength:
        "Prefers interior routes and turns open space into narrow operating windows.",
      susceptibility:
        "More durable than lower classes, but still predictable once its line is identified.",
      weakness:
        "Can be isolated and cleared if engaged before other classes stack around it.",
    },
    baseColor: "#dc3232",
    baseScale: 1.2,
    bobAmplitude: 12,
    bobFrequency: 3.6,
    darken: 0.9,
    defaultOpacity: 0.9,
    maxHp: 3,
    pointValue: 4,
    sizeBoost: 2,
    swayAmplitude: 10,
    swayFrequency: 3.4,
    crawlProfile: {
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
    socialAffinity: -0.3,
    preferredRegion: "interior",
    weaponMatchups: steadyMatchups({
      hammer: {
        note: "Closing distance gives Nullify too much room to steal the center lane back.",
        state: "risky",
      },
      zapper: {
        note: "Armored shell shrugs off toxin pressure before poison can matter.",
        state: "immune",
      },
      freeze: {
        note: "Best tool against Nullify — halving its speed turns the fast stalker into an easy target.",
        state: "favored",
      },
      chain: {
        note: "Electric arcs punish clustered elites and stay effective once the shell is exposed.",
        state: "favored",
      },
      flame: {
        note: "Armor blunts the burn — useful for space control, not direct deletion.",
        state: "risky",
      },
      laser: {
        note: "Precision beams cut through the interior lane and delete high-value pressure.",
        state: "favored",
      },
      shockwave: {
        note: "Static lockdown is solid, but the real value comes from follow-up damage.",
        state: "favored",
      },
      nullpointer: {
        note: "Reliable single-target solution once Nullify is in the interior and you need a guaranteed hit.",
        state: "favored",
      },
      plasma: {
        note: "Heavy clustered blasts do real work once multiple high-threat bugs overlap.",
        state: "favored",
      },
      void: {
        note: "Gravity control keeps interior elites contained and turns their size against them.",
        state: "favored",
      },
    }),
  },

  urgent: {
    id: "urgent",
    name: "ZeroDay",
    description:
      "A critical outbreak class that spreads unpredictably, spikes pressure instantly, and refuses to stay pinned for long.",
    dossier: {
      encounter:
        "Appears during peak escalation, when the board is already stressed and a critical failure class breaks containment.",
      pressure:
        "Creates immediate crisis pressure through speed, survivability, and erratic movement.",
      strength:
        "Hard to pin down, hard to outpace, and dangerous if left alive while the field is busy.",
      susceptibility:
        "No special weapon counter is assumed; the advantage comes from early focus and space control.",
      weakness:
        "Most manageable before it stacks with additional pressure waves or surrounding bugs.",
    },
    baseColor: "#fff",
    baseScale: 1.4,
    bobAmplitude: 14,
    bobFrequency: 2.8,
    darken: 1,
    defaultOpacity: 1,
    maxHp: 4,
    pointValue: 6,
    sizeBoost: 3,
    swayAmplitude: 12,
    swayFrequency: 2.8,
    crawlProfile: {
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
    socialAffinity: -0.1,
    preferredRegion: "middle",
    iconVariant: "urgent",
    weaponMatchups: steadyMatchups({
      hammer: {
        note: "Too volatile to rely on close-range cleanup alone once the outbreak is moving.",
        state: "risky",
      },
      freeze: {
        note: "ZeroDay runs too hot and too erratically — cryo control does not stick.",
        state: "immune",
      },
      flame: {
        note: "Fast outbreaks slip through the burn window before thermal damage ramps.",
        state: "risky",
      },
      laser: {
        note: "Precision beams track the chaos better than most tools and keep damage honest.",
        state: "favored",
      },
      shockwave: {
        note: "Clears surrounding pressure and softens ZeroDay when surrounded by a swarm.",
        state: "steady",
      },
      nullpointer: {
        note: "The most reliable answer — locks onto ZeroDay regardless of how erratically it moves.",
        state: "favored",
      },
      void: {
        note: "Singularity control finally pins the outbreak in place long enough to finish it.",
        state: "favored",
      },
    }),
  },
};

// ── Derived accessors ─────────────────────────────────────────────────────────

export function getBugVariantDef(variant: BugVariant): BugVariantDef {
  return BUG_VARIANT_DEFS[variant];
}

export function getBugVariantColor(variant: BugVariant): string {
  return BUG_VARIANT_DEFS[variant].baseColor;
}

export function getBugVariantMaxHp(variant: BugVariant): number {
  return BUG_VARIANT_DEFS[variant].maxHp;
}

// ── Backward-compatible sub-views ─────────────────────────────────────────────

/** Shape matching the old BugVariantConfig for consumers that destructure it. */
export interface BugVariantConfig {
  baseColor: string;
  baseScale: number;
  bobAmplitude: number;
  bobFrequency: number;
  darken: number;
  defaultOpacity: number;
  maxHp: number;
  sizeBoost: number;
  swayAmplitude: number;
  swayFrequency: number;
}

/**
 * Visual/physics config keyed by variant.
 * Derived from BUG_VARIANT_DEFS — do not edit directly.
 */
export const BUG_VARIANT_CONFIG: Record<BugVariant, BugVariantConfig> = {
  low: BUG_VARIANT_DEFS.low,
  medium: BUG_VARIANT_DEFS.medium,
  high: BUG_VARIANT_DEFS.high,
  urgent: BUG_VARIANT_DEFS.urgent,
};

/**
 * Crawl profiles keyed by variant.
 * Derived from BUG_VARIANT_DEFS — do not edit directly.
 */
export const CRAWL_PROFILES: Record<string, CrawlProfile> = {
  low: BUG_VARIANT_DEFS.low.crawlProfile,
  medium: BUG_VARIANT_DEFS.medium.crawlProfile,
  high: BUG_VARIANT_DEFS.high.crawlProfile,
  urgent: BUG_VARIANT_DEFS.urgent.crawlProfile,
};
