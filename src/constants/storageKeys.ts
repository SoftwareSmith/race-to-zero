export const STORAGE_KEYS = {
  bugChaosMultiplier: "race-to-zero:bug-chaos-multiplier",
  bugSizeMultiplier: "race-to-zero:bug-size-multiplier",
  deadlineDate: "race-to-zero:deadline-date",
  deadlineFromDate: "race-to-zero:deadline-from-date",
  excludePublicHolidays: "race-to-zero:exclude-holidays-awst",
  excludeWeekends: "race-to-zero:exclude-weekends",
  gameConfig: "race-to-zero:game-config",
  bugCodex: "race-to-zero:bug-codex",
  weaponEvolutionStates: "bugSlayer_weaponEvolutionStates",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
