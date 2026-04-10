import {
  BUG_VARIANT_DEFS,
  type BugVariantDef,
  type CrawlProfile,
  type CrawlRegion,
  type BugWeaponMatchups,
} from "@config/bugVariants";

// Re-export types for consumers that import them from this module.
export type {
  CrawlRegion,
  CrawlProfile,
  BugWeaponId,
  BugWeaponMatchup,
  BugWeaponMatchupState,
  BugWeaponMatchups,
} from "@config/bugVariants";

// Re-export CRAWL_PROFILES for any legacy consumer.
export { CRAWL_PROFILES } from "@config/bugVariants";

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
  socialAffinity?: number;
  preferredRegion?: CrawlRegion;
  iconVariant?: string;
  iconUrl?: string;
  color?: string;
  size?: number;
  weaponMatchups: BugWeaponMatchups;
}

// ── Derive BUG_CODEX from the single config source ───────────────────────────

function variantDefToBugType(def: BugVariantDef): BugType {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    dossier: { ...def.dossier },
    profile: {
      ...def.crawlProfile,
      anchorDriftInterval: [
        ...def.crawlProfile.anchorDriftInterval,
      ] as [number, number],
      regionWeights: { ...def.crawlProfile.regionWeights },
    },
    socialAffinity: def.socialAffinity,
    preferredRegion: def.preferredRegion,
    iconVariant: def.iconVariant,
    iconUrl: def.iconUrl,
    weaponMatchups: {
      hammer: { ...def.weaponMatchups.hammer },
      laser: { ...def.weaponMatchups.laser },
      pulse: { ...def.weaponMatchups.pulse },
    },
  };
}

export const BUG_CODEX: Record<string, BugType> = Object.fromEntries(
  Object.entries(BUG_VARIANT_DEFS).map(([key, def]) => [
    key,
    variantDefToBugType(def),
  ]),
);

// ── Runtime codex (user-editable, persisted to localStorage) ─────────────────

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

let CURRENT_CODEX: Record<string, BugType> = cloneCodex(BUG_CODEX);

export function getCodex() {
  return CURRENT_CODEX;
}

export function setCodex(next: Record<string, BugType>) {
  CURRENT_CODEX = cloneCodex(next);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        "race-to-zero:bug-codex",
        JSON.stringify(CURRENT_CODEX),
      );
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
