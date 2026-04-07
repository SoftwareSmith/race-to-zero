export type Tone = "positive" | "negative" | "neutral";
export type StatusBannerKind = "error" | "info";
export type TopMenuKey = "bugs" | "settings" | null;
export type SettingToggleKey =
  | "excludePublicHolidays"
  | "excludeWeekends"
  | "showParticleCount"
  | "terminatorMode";
export type BugVisualSettingKey = "chaosMultiplier" | "sizeMultiplier";
export type ActiveTab = "overview" | "periods";
export type CompareRangeKey = "7" | "30" | "90" | "all" | "custom";

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
  createdAt: string;
  completedAt: string | null;
  priority: number;
  stateName: string | null;
  stateType: string | null;
  teamKey?: string | null;
}

export interface MetricsSource {
  bugs?: MetricsBug[];
  generatedAt?: string;
  lastUpdated?: string;
}

export interface PriorityDistributionEntry {
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
  bugs: MetricsBug[];
  bugsPerDayRequired: number;
  currentAddRate: number;
  currentFixRate: number;
  currentNetBurnRate: number;
  daysUntilDeadline: number;
  deadline: Date;
  deadlineLabel: string;
  likelihoodScore: number;
  neededNetBurnRate: number;
  onTrack: boolean;
  priorityDistribution: PriorityDistributionEntry[];
  remainingBugs: number;
  statusBody: string;
  statusHeadline: string;
  statusSignal: string;
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
  completionRate: number;
  created: number;
  dayCount: number;
  endDate: Date;
  fixRate: number;
  fixed: number;
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
  previousWindow: ComparisonWindowMetrics | null;
  rangeKey: string;
  rangeLabel: string;
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
  sizeMultiplier: number;
}

export interface MenuSettingsState extends WorkdaySettings {
  showParticleCount: boolean;
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
}

export interface EffectPalette {
  bug: string;
  fireflies: string[];
  orbA: string;
  orbB: string;
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
