export type Tone = "positive" | "negative" | "neutral";
export type StatusBannerKind = "error" | "info";
export type TopMenuKey = "codex" | "settings" | null;
export type SettingToggleKey =
  | "excludePublicHolidays"
  | "excludeWeekends"
  | "showAmbientBugs";
export type BugVisualSettingKey = "chaosMultiplier" | "sizeMultiplier";
export type ActiveTab = "overview" | "periods" | "insights" | "history";
export type CompareRangeKey = "7" | "30" | "90" | "all" | "custom";
export type HistoryOutcomeKey =
  | "completed"
  | "cancelled"
  | "duplicated"
  | "autoClosed"
  | "archived";

export interface TabItem {
  id: ActiveTab;
  label: string;
}

export interface CompareRangeOption {
  label: string;
  value: CompareRangeKey;
}

export interface WorkdaySettings {
  excludePublicHolidays: boolean;
  excludeWeekends: boolean;
}

export interface MetricsBug {
  archivedAt?: string | null;
  autoClosedAt?: string | null;
  canceledAt?: string | null;
  createdAt: string;
  completedAt: string | null;
  dueDate?: string | null;
  priority: number;
  stateName: string | null;
  stateType: string | null;
  teamKey?: string | null;
  updatedAt?: string | null;
}

export interface InsightsPriorityMetrics {
  averageOverdueDays: number;
  averageResolutionDays: number;
  overdueCompleted: number;
  eligible: number;
  label: string;
  medianOverdueDays: number;
  medianResolutionDays: number;
  missingDueDate: number;
  onTime: number;
  slaHitRate: number;
  totalCompleted: number;
}

export interface InsightsTrendEntry {
  overdueCompleted: number;
  completed: number;
  date: string;
  onTime: number;
}

export interface InsightsMetrics {
  averageOverdueDays: number;
  averageResolutionDays: number;
  body: string;
  overdueCompleted: number;
  currentWindow: ComparisonWindowMetrics;
  eligibleCompleted: number;
  headline: string;
  medianOverdueDays: number;
  medianResolutionDays: number;
  missingDueDate: number;
  onTimeCompleted: number;
  openOverdue: number;
  openPending: number;
  priorityMetrics: InsightsPriorityMetrics[];
  rangeLabel: string;
  slaHitRate: number;
  tone: Tone;
  totalCompleted: number;
  trendSeries: InsightsTrendEntry[];
}

export interface HistoryOutcomeMetric {
  count: number;
  key: HistoryOutcomeKey;
  label: string;
  percent: number;
}

export interface HistoryTrendEntry {
  archived: number;
  autoClosed: number;
  cancelled: number;
  completed: number;
  date: string;
  duplicated: number;
  total: number;
}

export interface HistoryPriorityMetrics {
  archived: number;
  autoClosed: number;
  averageCycleDays: number;
  cancelled: number;
  completed: number;
  duplicated: number;
  label: string;
  medianCycleDays: number;
  p75CycleDays: number;
  p90CycleDays: number;
  totalClosed: number;
}

export interface HistoryCycleBucketEntry {
  count: number;
  label: string;
}

export interface HistoryWindowMetrics {
  archived: number;
  autoClosed: number;
  averageCycleDays: number;
  cancellationRate: number;
  cancelled: number;
  completionRate: number;
  completed: number;
  duplicated: number;
  medianCycleDays: number;
  p75CycleDays: number;
  p90CycleDays: number;
  totalClosed: number;
}

export interface HistoryMetrics {
  body: string;
  currentWindow: HistoryWindowMetrics;
  cycleBuckets: HistoryCycleBucketEntry[];
  headline: string;
  outcomeMetrics: HistoryOutcomeMetric[];
  previousWindow: HistoryWindowMetrics | null;
  priorityMetrics: HistoryPriorityMetrics[];
  rangeLabel: string;
  teamLabel: string;
  teamKey: string | null;
  tone: Tone;
  trendSeries: HistoryTrendEntry[];
}

export interface HistoryTeamOption {
  label: string;
  value: string;
}

export interface MetricsSource {
  bugs?: MetricsBug[];
  generatedAt?: string;
  lastUpdated?: string;
}

export interface OpenAgeDistributionEntry {
  count: number;
  label: string;
}

export interface BootstrapMetricsSnapshot {
  completedSeries: DailyCountEntry[];
  createdSeries: DailyCountEntry[];
  doneCount: number;
  firstBugDate: string | null;
  openAgeDistribution: OpenAgeDistributionEntry[];
  priorityDistribution: PriorityDistributionEntry[];
  remainingBugs: number;
  remainingSeries: DailyCountEntry[];
  statusDistribution: StatusDistributionEntry[];
}

export interface BootstrapMetricsSource {
  all: BootstrapMetricsSnapshot;
  byTeam: Record<string, BootstrapMetricsSnapshot>;
  generatedAt?: string;
  lastUpdated?: string;
  teamKeys: string[];
}

export interface PriorityDistributionEntry {
  count: number;
  label: string;
}

export interface StatusDistributionEntry {
  count: number;
  label: string;
}

export interface DailyCountEntry {
  count: number;
  date: string;
}

export interface SummaryMetrics {
  bugCount: number;
  bugsPerDayRequired: number;
  currentAddRate: number;
  currentFixRate: number;
  currentNetBurnRate: number;
  daysUntilDeadline: number;
  deadlineLabel: string;
  likelihoodScore: number;
  onTrack: boolean;
  statusSignal: string;
  trackingStartLabel: string;
}

export interface DeadlineMetrics {
  allRemainingPerDay: DailyCountEntry[];
  bugsPerDayRequired: number;
  currentAddRate: number;
  currentFixRate: number;
  currentNetBurnRate: number;
  daysUntilDeadline: number;
  deadline: Date;
  deadlineLabel: string;
  doneCount: number;
  likelihoodScore: number;
  neededNetBurnRate: number;
  onTrack: boolean;
  openAgeDistribution: OpenAgeDistributionEntry[];
  priorityDistribution: PriorityDistributionEntry[];
  remainingBugs: number;
  statusBody: string;
  statusHeadline: string;
  statusSignal: string;
  statusDistribution: StatusDistributionEntry[];
  statusTone: Tone;
  today: Date;
  trackingStartBacklog: number;
  trackingStartDate: Date;
  trackingStartLabel: string;
  trendWindowLabel: string;
  workdaySettings: WorkdaySettings;
}

export interface ComparisonWindowMetrics {
  addRate: number;
  completed: number;
  completedRate: number;
  closureRate: number;
  created: number;
  dayCount: number;
  endDate: Date;
  closed: number;
  closedRate: number;
  label: string;
  netBurnRate: number;
  netChange: number;
  startDate: Date;
}

export interface ComparisonMetrics {
  body: string;
  completedSeries: DailyCountEntry[];
  createdSeries: DailyCountEntry[];
  currentWindow: ComparisonWindowMetrics;
  hasComparisonWindow: boolean;
  headline: string;
  historicalWindows: ComparisonWindowMetrics[];
  previousWindow: ComparisonWindowMetrics | null;
  rangeKey: string;
  rangeLabel: string;
  closedSeries: DailyCountEntry[];
  tone: Tone;
}

export interface ChartFocusState {
  chartKey: string;
  dataIndex: number;
  datasetIndex: number;
  label: string;
  relativeIndex: number;
}

export interface BugVisualSettings {
  chaosMultiplier: number;
  showParticleCount: boolean;
  sizeMultiplier: number;
}

export interface MenuSettingsState extends WorkdaySettings {
  showAmbientBugs: boolean;
}

export interface FireflyParticle {
  color: string;
  delay: string;
  driftX: string;
  duration: string;
  size: string;
  x: string;
  y: string;
}

export type BugVariant = "low" | "medium" | "high" | "urgent";

export type BugCounts = Record<BugVariant, number>;

export interface BugParticle {
  delay: number;
  driftX: number;
  driftY: number;
  duration: number;
  opacity: number;
  size: number;
  variant: BugVariant;
  x: number;
  y: number;
  // phases for quasi-randomized motion
  phase?: number;
  swayPhase?: number;
}

export interface EffectPalette {
  bug: string;
}

export interface MotionProfile {
  durationMultiplier: number;
  opacityMultiplier: number;
  scale: number;
}

export interface SceneProfile {
  chartFocusStrength: number;
  clusterStrength: number;
}
