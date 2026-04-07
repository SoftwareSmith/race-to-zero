import type {
  BugCounts,
  BugVariant,
  PriorityDistributionEntry,
} from "../types/dashboard";

export const BUG_VARIANTS = ["low", "medium", "high", "urgent"] as const;

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

export const BUG_VARIANT_CONFIG: Record<BugVariant, BugVariantConfig> = {
  low: {
    baseColor: "#7c7c7c",
    baseScale: 0.8,
    bobAmplitude: 8,
    bobFrequency: 6,
    darken: 0.6,
    defaultOpacity: 0.6,
    maxHp: 1,
    sizeBoost: 0,
    swayAmplitude: 7,
    swayFrequency: 5.6,
  },
  medium: {
    baseColor: "#c86428",
    baseScale: 1,
    bobAmplitude: 10,
    bobFrequency: 4.8,
    darken: 0.8,
    defaultOpacity: 0.75,
    maxHp: 2,
    sizeBoost: 1,
    swayAmplitude: 8,
    swayFrequency: 4.2,
  },
  high: {
    baseColor: "#dc3232",
    baseScale: 1.2,
    bobAmplitude: 12,
    bobFrequency: 3.6,
    darken: 0.9,
    defaultOpacity: 0.9,
    maxHp: 3,
    sizeBoost: 2,
    swayAmplitude: 10,
    swayFrequency: 3.4,
  },
  urgent: {
    baseColor: "#9b111e",
    baseScale: 1.4,
    bobAmplitude: 14,
    bobFrequency: 2.8,
    darken: 1,
    defaultOpacity: 1,
    maxHp: 4,
    sizeBoost: 3,
    swayAmplitude: 12,
    swayFrequency: 2.8,
  },
};

const PRIORITY_LABEL_TO_VARIANT: Record<string, BugVariant> = {
  High: "high",
  Low: "low",
  Medium: "medium",
  Normal: "medium",
  Unspecified: "low",
  Urgent: "urgent",
};

export function createEmptyBugCounts(): BugCounts {
  return {
    high: 0,
    low: 0,
    medium: 0,
    urgent: 0,
  };
}

export function normalizeBugCounts(
  counts?: Partial<BugCounts> | null,
): BugCounts {
  const normalized = createEmptyBugCounts();

  for (const variant of BUG_VARIANTS) {
    normalized[variant] = Math.max(0, Math.floor(counts?.[variant] ?? 0));
  }

  return normalized;
}

export function getBugCountsFromPriorityDistribution(
  priorityDistribution: PriorityDistributionEntry[],
): BugCounts {
  const counts = createEmptyBugCounts();

  for (const entry of priorityDistribution) {
    const variant = PRIORITY_LABEL_TO_VARIANT[entry.label];
    if (!variant) {
      continue;
    }

    counts[variant] += Math.max(0, Math.floor(entry.count ?? 0));
  }

  return counts;
}

export function getBugCountsKey(counts: Partial<BugCounts> | null | undefined) {
  const normalized = normalizeBugCounts(counts);
  return BUG_VARIANTS.map((variant) => `${variant}:${normalized[variant]}`).join("|");
}

export function getBugTotal(counts: Partial<BugCounts> | null | undefined) {
  const normalized = normalizeBugCounts(counts);
  return BUG_VARIANTS.reduce((total, variant) => total + normalized[variant], 0);
}

export function getBugVariantColor(variant: BugVariant) {
  return BUG_VARIANT_CONFIG[variant].baseColor;
}

export function getBugVariantMaxHp(variant: BugVariant) {
  return BUG_VARIANT_CONFIG[variant].maxHp;
}