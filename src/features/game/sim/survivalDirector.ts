import type { BugCounts } from "../../../types/dashboard";

export interface SurvivalSpawnPlan {
  counts: BugCounts;
  focusLabel?: string;
  tacticLabel?: string;
  variantFocus?: string;
}