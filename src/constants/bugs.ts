import type {
  BugCounts,
  BugVariant,
  PriorityDistributionEntry,
} from "../types/dashboard";

export type { BugVariantConfig } from "@config/bugVariants";
export {
  BUG_VARIANT_CONFIG,
  getBugVariantColor,
  getBugVariantMaxHp,
} from "@config/bugVariants";

export const BUG_VARIANTS = ["low", "medium", "high", "urgent"] as const;

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