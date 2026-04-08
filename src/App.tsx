import type { ChangeEvent, ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { endOfYear, format, subDays } from "date-fns";
import BackgroundField from "./components/BackgroundField";
// ConfigPanel UI removed in favor of per-type settings in Codex
import CodexPanel from "./components/CodexPanel";
import { DEFAULT_GAME_CONFIG } from "./engine/types";

import BugSettingsMenu from "./components/BugSettingsMenu";
import ChartCard from "./components/ChartCard";
import CommandCenter from "./components/CommandCenter";
import MetricCard from "./components/MetricCard";
import SettingsMenu from "./components/SettingsMenu";
import TopNav from "./components/TopNav";
import Tooltip from "./components/Tooltip";
import {
  createEmptyBugCounts,
  getBugCountsFromPriorityDistribution,
  getBugTotal,
} from "./constants/bugs";
import { STORAGE_KEYS } from "./constants/storageKeys";
import { useStoredState } from "./hooks/useStoredState";
import { useMetrics } from "./hooks/useMetrics";
import { UpgradeSystem } from "../interactive/game/Upgrades";
import type {
  ActiveTab,
  BugCounts,
  BugVisualSettingKey,
  ChartFocusState,
  CompareRangeKey,
  ComparisonMetrics,
  DeadlineMetrics,
  MenuSettingsState,
  SettingToggleKey,
  StatusBannerKind,
  SummaryMetrics,
  Tone,
  TopMenuKey,
  WorkdaySettings,
} from "./types/dashboard";
import { cn } from "./utils/cn";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getMetricTone,
  getNetChangeTone,
} from "./utils/dashboard";
import {
  parseStoredBoolean,
  parseStoredPositiveNumber,
  parseStoredString,
} from "./utils/storage";
import {
  buildComparisonSummaryChartData,
  buildComparisonTimelineChartData,
  buildDeadlineBurndownChartData,
  buildPriorityChartData,
  getComparisonMetrics,
  getDeadlineMetrics,
  getSummaryMetrics,
} from "./utils/metrics";

const MILESTONE_THRESHOLDS = [100, 50, 25, 10, 0] as const;

interface MilestoneFlash {
  threshold: number;
  token: number;
}

interface StatusBannerProps {
  children: ReactNode;
  kind?: StatusBannerKind;
}

interface MetricCardDefinition {
  hint: string;
  label: string;
  tone: Tone;
  value: string;
}

function getBacklogSummary(
  summary: SummaryMetrics,
  deadlineMetrics: DeadlineMetrics,
) {
  if (summary.currentNetBurnRate <= 0) {
    return `The backlog is not trending downward right now. Current net burn is ${formatNumber(summary.currentNetBurnRate, 2)}/day against ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day needed.`;
  }

  if (summary.currentNetBurnRate >= deadlineMetrics.neededNetBurnRate) {
    return `The backlog is trending downward, and current net burn of ${formatNumber(summary.currentNetBurnRate, 2)}/day is holding ahead of the target path.`;
  }

  return `The backlog is trending downward, but current net burn of ${formatNumber(summary.currentNetBurnRate, 2)}/day is still below the ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day needed to close the gap to the target path.`;
}

function getWorkdayLabelAndHint(
  isWorkdayMode: boolean,
  deadlineLabel: string,
): { hint: string; label: string } {
  if (isWorkdayMode) {
    return {
      hint: `Remaining working days to reach zero by ${deadlineLabel}.`,
      label: "Workdays left",
    };
  }

  return {
    hint: `Days remaining to reach zero by ${deadlineLabel}.`,
    label: "Days left",
  };
}

function buildOverviewMetricCards(
  summary: SummaryMetrics,
  deadlineMetrics: DeadlineMetrics,
  metricTone: Tone,
  isWorkdayMode: boolean,
): MetricCardDefinition[] {
  const dayMetric = getWorkdayLabelAndHint(
    isWorkdayMode,
    summary.deadlineLabel,
  );

  return [
    {
      hint: "Current open backlog size. This same number drives the animated bug field in the background.",
      label: "Open bugs",
      tone: metricTone,
      value: formatNumber(summary.bugCount),
    },
    {
      hint: dayMetric.hint,
      label: dayMetric.label,
      tone: metricTone,
      value: formatNumber(summary.daysUntilDeadline),
    },
    {
      hint: "Recent fixes per day minus recent created bugs per day.",
      label: "Current net burn",
      tone: metricTone,
      value: `${formatNumber(summary.currentNetBurnRate, 2)}/day`,
    },
    {
      hint: "Required daily net backlog reduction to hit zero by the selected deadline.",
      label: "Required net burn",
      tone: metricTone,
      value: `${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day`,
    },
    {
      hint: "Confidence rises when current net burn stays above the required burn.",
      label: "Confidence",
      tone: metricTone,
      value: formatPercent(summary.likelihoodScore),
    },
  ];
}

function getCompletedTone(comparisonMetrics: ComparisonMetrics): Tone {
  if (
    comparisonMetrics.currentWindow.fixed >
    comparisonMetrics.currentWindow.created
  ) {
    return "positive";
  }

  if (
    comparisonMetrics.currentWindow.fixed ===
    comparisonMetrics.currentWindow.created
  ) {
    return "neutral";
  }

  return getMetricTone(
    comparisonMetrics.currentWindow.fixed,
    comparisonMetrics.previousWindow?.fixed ?? null,
    true,
  );
}

function getCompletionRateTone(comparisonMetrics: ComparisonMetrics): Tone {
  if (comparisonMetrics.currentWindow.completionRate > 100) {
    return "positive";
  }

  if (Math.abs(comparisonMetrics.currentWindow.completionRate - 100) < 0.01) {
    return "neutral";
  }

  return getMetricTone(
    comparisonMetrics.currentWindow.completionRate,
    comparisonMetrics.previousWindow?.completionRate ?? null,
    true,
  );
}

function buildPeriodsMetricCards(
  comparisonMetrics: ComparisonMetrics,
  createdTone: Tone,
  completedTone: Tone,
  netChangeTone: Tone,
  completionRateTone: Tone,
): MetricCardDefinition[] {
  return [
    {
      hint: "New bugs added during the selected period. Lower is better.",
      label: "Bugs created",
      tone: createdTone,
      value: formatNumber(comparisonMetrics.currentWindow.created),
    },
    {
      hint: "Bugs completed during the selected period. Higher is better.",
      label: "Bugs completed",
      tone: completedTone,
      value: formatNumber(comparisonMetrics.currentWindow.fixed),
    },
    {
      hint: "Created minus completed during the selected period.",
      label: "Net change",
      tone: netChangeTone,
      value: formatSignedNumber(comparisonMetrics.currentWindow.netChange),
    },
    {
      hint: "Completion rate helps normalize periods with different intake volume.",
      label: "Completion rate",
      tone: completionRateTone,
      value: formatPercent(comparisonMetrics.currentWindow.completionRate, 1),
    },
  ];
}

function StatusBanner({ kind = "info", children }: StatusBannerProps) {
  const styles = {
    error: "border-red-500/30 bg-red-950/30 text-red-100",
    info: "border-sky-500/30 bg-sky-950/20 text-sky-100",
  };

  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-3 text-sm font-medium shadow-[0_12px_30px_rgba(68,50,30,0.06)]",
        styles[kind] ?? styles.info,
      )}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

interface OverviewViewProps {
  deadlineMetrics: DeadlineMetrics;
  onChartFocusChange: (nextFocus: ChartFocusState | null) => void;
  summary: SummaryMetrics;
  workdaySettings: WorkdaySettings;
}

const OverviewView = memo(function OverviewView({
  deadlineMetrics,
  onChartFocusChange,
  summary,
  workdaySettings,
}: OverviewViewProps) {
  const metricTone = deadlineMetrics.statusTone;
  const isWorkdayMode =
    workdaySettings.excludeWeekends || workdaySettings.excludePublicHolidays;
  const backlogSummary = getBacklogSummary(summary, deadlineMetrics);
  const deadlineBurndownData = useMemo(
    () => buildDeadlineBurndownChartData(deadlineMetrics),
    [deadlineMetrics],
  );
  const priorityChartData = useMemo(
    () => buildPriorityChartData(deadlineMetrics),
    [deadlineMetrics],
  );
  const metricCards = useMemo(
    () =>
      buildOverviewMetricCards(
        summary,
        deadlineMetrics,
        metricTone,
        isWorkdayMode,
      ),
    [deadlineMetrics, isWorkdayMode, metricTone, summary],
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((metricCard) => (
          <MetricCard
            key={metricCard.label}
            hint={metricCard.hint}
            label={metricCard.label}
            tone={metricCard.tone}
            value={metricCard.value}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <ChartCard
          chartKey="bug-burndown"
          className="min-h-[420px]"
          data={deadlineBurndownData}
          onHoverStateChange={onChartFocusChange}
          summary={backlogSummary}
          title="Bug burndown"
        />
        <ChartCard
          chartKey="priority-breakdown"
          className="min-h-[420px]"
          data={priorityChartData}
          description="Breakdown of the open backlog by priority so the biggest risk pockets are visible without hovering."
          onHoverStateChange={onChartFocusChange}
          title="Open bugs by priority"
          variant="bar"
        />
      </div>
    </div>
  );
});

interface PeriodsViewProps {
  comparisonMetrics: ComparisonMetrics;
  onChartFocusChange: (nextFocus: ChartFocusState | null) => void;
}

const PeriodsView = memo(function PeriodsView({
  comparisonMetrics,
  onChartFocusChange,
}: PeriodsViewProps) {
  const createdTone = getMetricTone(
    comparisonMetrics.currentWindow.created,
    comparisonMetrics.previousWindow?.created ?? null,
    false,
  );
  const completedTone = getCompletedTone(comparisonMetrics);
  const netChangeTone = getNetChangeTone(
    comparisonMetrics.currentWindow.netChange,
  );
  const completionRateTone = getCompletionRateTone(comparisonMetrics);
  const comparisonTimelineData = useMemo(
    () => buildComparisonTimelineChartData(comparisonMetrics),
    [comparisonMetrics],
  );
  const comparisonSummaryData = useMemo(
    () => buildComparisonSummaryChartData(comparisonMetrics),
    [comparisonMetrics],
  );
  const metricCards = useMemo(
    () =>
      buildPeriodsMetricCards(
        comparisonMetrics,
        createdTone,
        completedTone,
        netChangeTone,
        completionRateTone,
      ),
    [
      comparisonMetrics,
      completionRateTone,
      completedTone,
      createdTone,
      netChangeTone,
    ],
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metricCard) => (
          <MetricCard
            key={metricCard.label}
            hint={metricCard.hint}
            label={metricCard.label}
            tone={metricCard.tone}
            value={metricCard.value}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <ChartCard
          chartKey="comparison-timeline"
          className="min-h-[420px]"
          data={comparisonTimelineData}
          onHoverStateChange={onChartFocusChange}
          summary="Compare daily intake against completions to see whether recent periods are relieving pressure or letting backlog build."
          title="Created vs completed over time"
        />
        <ChartCard
          chartKey="comparison-summary"
          className="min-h-[420px]"
          data={comparisonSummaryData}
          description="Each x-axis group is one metric type, with current and previous period bars paired so the change is easy to read."
          onHoverStateChange={onChartFocusChange}
          summary="These bars compare the current period with the previous one across intake, completions, net movement, and completion rate."
          title="Current vs previous window"
          variant="bar"
        />
      </div>
    </div>
  );
});

function App() {
  const { metrics, error } = useMetrics();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [deadlineDate, setDeadlineDate] = useStoredState(
    STORAGE_KEYS.deadlineDate,
    format(endOfYear(new Date()), "yyyy-MM-dd"),
    {
      parse: parseStoredString,
    },
  );
  const [deadlineFromDate, setDeadlineFromDate] = useStoredState(
    STORAGE_KEYS.deadlineFromDate,
    format(subDays(new Date(), 29), "yyyy-MM-dd"),
    {
      parse: parseStoredString,
    },
  );
  const [excludeWeekends, setExcludeWeekends] = useStoredState(
    STORAGE_KEYS.excludeWeekends,
    false,
    {
      parse: parseStoredBoolean,
    },
  );
  const [excludePublicHolidays, setExcludePublicHolidays] = useStoredState(
    STORAGE_KEYS.excludePublicHolidays,
    false,
    {
      parse: parseStoredBoolean,
    },
  );
  const [showParticleCount, setShowParticleCount] = useStoredState(
    STORAGE_KEYS.showParticleCount,
    true,
    {
      parse: parseStoredBoolean,
    },
  );
  const [terminatorMode, setTerminatorMode] = useStoredState(
    STORAGE_KEYS.terminatorMode,
    false,
    {
      parse: parseStoredBoolean,
    },
  );
  const [openTopMenu, setOpenTopMenu] = useState<TopMenuKey>(null);
  const [bugSizeMultiplier, setBugSizeMultiplier] = useStoredState(
    STORAGE_KEYS.bugSizeMultiplier,
    3.5,
    {
      parse: parseStoredPositiveNumber,
    },
  );
  const [bugChaosMultiplier, setBugChaosMultiplier] = useStoredState(
    STORAGE_KEYS.bugChaosMultiplier,
    2.5,
    {
      parse: parseStoredPositiveNumber,
    },
  );
  const [compareRangeKey, setCompareRangeKey] = useState<CompareRangeKey>("30");
  const [customFromDate, setCustomFromDate] = useState(() =>
    format(subDays(new Date(), 29), "yyyy-MM-dd"),
  );
  const [customToDate, setCustomToDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [chartFocus, setChartFocus] = useState<ChartFocusState | null>(null);
  const [milestoneFlash, setMilestoneFlash] = useState<MilestoneFlash | null>(
    null,
  );
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const bugSettingsMenuRef = useRef<HTMLDivElement | null>(null);
  const codexMenuRef = useRef<HTMLDivElement | null>(null);
  const previousBugCountRef = useRef<number | null>(null);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [interactiveInitialBugCounts, setInteractiveInitialBugCounts] =
    useState<BugCounts>(() => createEmptyBugCounts());
  const [interactiveKills, setInteractiveKills] = useState(0);
  const [interactiveElapsedSeconds, setInteractiveElapsedSeconds] = useState(0);
  const [interactiveRemainingBugs, setInteractiveRemainingBugs] = useState(0);
  const [interactiveSessionKey, setInteractiveSessionKey] = useState<
    string | null
  >(null);

  const [gameConfig, setGameConfig] = useStoredState(
    STORAGE_KEYS.gameConfig,
    DEFAULT_GAME_CONFIG,
    {
      parse: (raw: string) => {
        try {
          return JSON.parse(raw) as typeof DEFAULT_GAME_CONFIG;
        } catch {
          return null;
        }
      },
      serialize: (v: typeof DEFAULT_GAME_CONFIG) => JSON.stringify(v),
    } as any,
  );

  const workdaySettings = useMemo<WorkdaySettings>(
    () => ({
      excludePublicHolidays,
      excludeWeekends,
    }),
    [excludePublicHolidays, excludeWeekends],
  );

  const deadlineMetrics = useMemo(
    () =>
      getDeadlineMetrics(metrics, {
        deadlineDate,
        trackingStartDate: deadlineFromDate,
        workdaySettings,
      }),
    [deadlineDate, deadlineFromDate, metrics, workdaySettings],
  );
  const comparisonMetrics = useMemo(
    () =>
      getComparisonMetrics(metrics, {
        rangeKey: compareRangeKey,
        customFromDate,
        customToDate,
      }),
    [compareRangeKey, customFromDate, customToDate, metrics],
  );
  const summary = useMemo(
    () => getSummaryMetrics(deadlineMetrics),
    [deadlineMetrics],
  );
  const currentBugCounts = useMemo(
    () =>
      getBugCountsFromPriorityDistribution(
        deadlineMetrics.priorityDistribution,
      ),
    [deadlineMetrics.priorityDistribution],
  );
  const currentBugCount = useMemo(
    () => getBugTotal(currentBugCounts),
    [currentBugCounts],
  );
  const todayDate = format(new Date(), "yyyy-MM-dd");

  const settings = useMemo<MenuSettingsState>(
    () => ({
      excludePublicHolidays,
      excludeWeekends,
      showParticleCount,
    }),
    [excludePublicHolidays, excludeWeekends, showParticleCount],
  );
  const bugVisualSettings = useMemo(
    () => ({
      chaosMultiplier: bugChaosMultiplier,
      sizeMultiplier: bugSizeMultiplier,
    }),
    [bugChaosMultiplier, bugSizeMultiplier],
  );
  const upgradeSystem = useMemo(() => new UpgradeSystem(), []);
  const weaponSnapshots = useMemo(
    () => upgradeSystem.getSnapshots(interactiveKills),
    [interactiveKills, upgradeSystem],
  );

  const weaponSnapshotsAvailable = useMemo(
    () => weaponSnapshots.map((s) => ({ ...s, locked: false })),
    [weaponSnapshots],
  );

  const handleToggleSetting = useCallback(
    (settingKey: SettingToggleKey) => {
      switch (settingKey) {
        case "excludeWeekends":
          setExcludeWeekends((currentValue) => !currentValue);
          break;
        case "excludePublicHolidays":
          setExcludePublicHolidays((currentValue) => !currentValue);
          break;
        case "showParticleCount":
          setShowParticleCount((currentValue) => !currentValue);
          break;
        case "terminatorMode":
          setTerminatorMode((currentValue) => !currentValue);
          break;
        default:
          break;
      }
    },
    [
      setExcludePublicHolidays,
      setExcludeWeekends,
      setShowParticleCount,
      setTerminatorMode,
    ],
  );

  const handleBugVisualSetting = useCallback(
    (settingKey: BugVisualSettingKey, value: number) => {
      if (settingKey === "sizeMultiplier") {
        setBugSizeMultiplier(value);
      }

      if (settingKey === "chaosMultiplier") {
        setBugChaosMultiplier(value);
      }
    },
    [setBugChaosMultiplier, setBugSizeMultiplier],
  );

  const handleTopMenuToggle = useCallback(
    (menuKey: Exclude<TopMenuKey, null>) => {
      setOpenTopMenu((currentValue) =>
        currentValue === menuKey ? null : menuKey,
      );
    },
    [],
  );

  const handleTopNavInteract = useCallback(() => {
    setOpenTopMenu(null);
  }, []);

  const handleCompareRangeChange = useCallback((value: CompareRangeKey) => {
    setOpenTopMenu(null);
    setCompareRangeKey(value);
  }, []);

  const handleCustomFromDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setOpenTopMenu(null);
      setCustomFromDate(event.target.value);
    },
    [],
  );

  const handleCustomToDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setOpenTopMenu(null);
      setCustomToDate(event.target.value);
    },
    [],
  );

  const handleDeadlineDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setOpenTopMenu(null);
      setDeadlineDate(event.target.value);
    },
    [setDeadlineDate],
  );

  const handleDeadlineFromDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setOpenTopMenu(null);
      setDeadlineFromDate(event.target.value);
    },
    [setDeadlineFromDate],
  );

  const handleTabChange = useCallback((tabId: ActiveTab) => {
    setOpenTopMenu(null);
    setActiveTab(tabId);
  }, []);

  const handleChartFocusChange = useCallback(
    (nextFocus: ChartFocusState | null) => {
      setChartFocus(nextFocus);
    },
    [],
  );

  const handleEnterInteractiveMode = useCallback(() => {
    setInteractiveKills(0);
    setInteractiveElapsedSeconds(0);
    setInteractiveInitialBugCounts(currentBugCounts);
    setInteractiveRemainingBugs(currentBugCount);
    setInteractiveSessionKey(`${Date.now()}`);
    setInteractiveMode(true);
  }, [currentBugCount, currentBugCounts]);

  useEffect(() => {
    if (!openTopMenu) {
      return undefined;
    }

    const activeMenuRef =
      openTopMenu === "bugs"
        ? bugSettingsMenuRef
        : openTopMenu === "codex"
          ? codexMenuRef
          : settingsMenuRef;

    const handlePointerDown = (
      event: globalThis.MouseEvent | globalThis.TouchEvent,
    ) => {
      const targetNode = event.target;

      if (!(targetNode instanceof Node)) {
        return;
      }

      if (
        activeMenuRef.current &&
        !activeMenuRef.current.contains(targetNode)
      ) {
        setOpenTopMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [openTopMenu]);

  useEffect(() => {
    document.body.classList.toggle("interactive-mode", interactiveMode);
    return () => {
      document.body.classList.remove("interactive-mode");
    };
  }, [interactiveMode]);

  useEffect(() => {
    if (!interactiveMode) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setInteractiveElapsedSeconds((currentValue) => currentValue + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [interactiveMode]);

  useEffect(() => {
    const currentBugCount = summary.bugCount;
    const previousBugCount = previousBugCountRef.current;

    if (previousBugCount != null) {
      const crossedThreshold = MILESTONE_THRESHOLDS.find(
        (threshold) =>
          previousBugCount > threshold && currentBugCount <= threshold,
      );
      if (crossedThreshold != null) {
        const sessionKey = `race-to-zero:milestone:${crossedThreshold}`;
        if (!window.sessionStorage.getItem(sessionKey)) {
          window.sessionStorage.setItem(sessionKey, "true");
          setMilestoneFlash({ threshold: crossedThreshold, token: Date.now() });
        }
      }
    }

    previousBugCountRef.current = currentBugCount;
  }, [summary.bugCount]);

  useEffect(() => {
    if (!milestoneFlash) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMilestoneFlash(null);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [milestoneFlash]);

  const headerEyebrow =
    summary.bugCount === 0 ? "All clear" : "Operations dashboard";
  const headerSubtitle =
    summary.bugCount === 0
      ? "No open bugs in the current public snapshot."
      : "Current pace against the zero-bug deadline.";
  const displayedBugCounts = interactiveMode
    ? interactiveInitialBugCounts
    : currentBugCounts;
  const interactiveKillRate =
    interactiveElapsedSeconds > 0
      ? (interactiveKills / interactiveElapsedSeconds) * 60
      : 0;
  const handleInteractiveHit = useCallback((payload: { defeated: boolean }) => {
    if (!payload.defeated) {
      return;
    }

    setInteractiveKills((currentValue) => currentValue + 1);
    setInteractiveRemainingBugs((currentValue) =>
      Math.max(0, currentValue - 1),
    );
  }, []);

  const getWeaponButtonClassName = useCallback(
    (weaponId: "hammer" | "gun" | "laser") => {
      const snapshot = weaponSnapshotsAvailable.find(
        (entry) => entry.id === weaponId,
      );
      if (!snapshot) {
        return "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-stone-200";
      }

      if (snapshot.current) {
        return "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/40 bg-sky-400/16 text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.18)] transition hover:-translate-y-0.5 hover:bg-sky-400/22";
      }

      if (snapshot.locked) {
        return "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/6 bg-white/4 text-stone-500 opacity-65 transition";
      }

      return "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/8 text-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-500/14";
    },
    [weaponSnapshotsAvailable],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608]">
      <BackgroundField
        bugCounts={displayedBugCounts}
        bugVisualSettings={bugVisualSettings}
        chartFocus={chartFocus}
        interactiveSessionKey={interactiveSessionKey}
        milestoneFlash={milestoneFlash}
        onTerminatorHit={interactiveMode ? handleInteractiveHit : undefined}
        remainingBugCount={
          interactiveMode ? interactiveRemainingBugs : undefined
        }
        showParticleCount={interactiveMode ? false : showParticleCount}
        showTerminatorStatusBadge={!interactiveMode}
        terminatorMode={interactiveMode || terminatorMode}
        tone={deadlineMetrics.statusTone}
        gameConfig={gameConfig}
      />

      {/* Engine config removed; per-type settings available in Codex */}

      {interactiveMode ? (
        <div className="relative min-h-screen">
          <div className="absolute top-6 right-6 z-50">
            <button
              data-no-hammer
              aria-label="Exit interactive mode"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
              onClick={() => setInteractiveMode(false)}
            >
              Back
            </button>
          </div>
          <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex w-full flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center">
                  <h1 className="mt-2 font-display text-4xl leading-[0.94] tracking-[-0.06em] text-stone-50 sm:text-5xl xl:mt-0 xl:text-6xl">
                    Race to Zero Bugs
                  </h1>
                  <div
                    data-no-hammer
                    className="grid grid-cols-3 gap-2 sm:gap-3"
                  >
                    <div className="min-w-[92px] rounded-[16px] border border-white/8 bg-zinc-950/74 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                      <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Bugs
                      </span>
                      <strong className="mt-1 block text-base font-semibold text-stone-50 sm:text-lg">
                        {interactiveRemainingBugs.toLocaleString()}
                      </strong>
                    </div>
                    <div className="min-w-[92px] rounded-[16px] border border-white/8 bg-zinc-950/74 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                      <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Kills
                      </span>
                      <strong className="mt-1 block text-base font-semibold text-stone-50 sm:text-lg">
                        {interactiveKills.toLocaleString()}
                      </strong>
                    </div>
                    <div className="min-w-[92px] rounded-[16px] border border-white/8 bg-zinc-950/74 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                      <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Rate
                      </span>
                      <strong className="mt-1 block text-base font-semibold text-stone-50 sm:text-lg">
                        {formatNumber(interactiveKillRate, 1)}/min
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start xl:self-center">
                  <div
                    data-no-hammer
                    className="flex flex-col gap-2 rounded-[18px] border border-white/8 bg-zinc-950/68 px-2 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Tooltip
                        content={
                          weaponSnapshotsAvailable.find(
                            (entry) => entry.id === "gun",
                          )?.progressText ?? "Available"
                        }
                      >
                        <button
                          aria-label="Gun"
                          className={getWeaponButtonClassName("gun")}
                        >
                          <svg
                            className="h-5 w-5 text-stone-200"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2 12h7l3-3h6v6h-6l-3-3H2v0z" />
                            <path d="M18 9v6" />
                          </svg>
                        </button>
                      </Tooltip>
                      <Tooltip
                        content={
                          weaponSnapshotsAvailable.find(
                            (entry) => entry.id === "laser",
                          )?.progressText ?? "Available"
                        }
                      >
                        <button
                          aria-label="Laser"
                          className={getWeaponButtonClassName("laser")}
                        >
                          <svg
                            className="h-5 w-5 text-stone-200"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 12h18" />
                            <path d="M12 3v18" />
                          </svg>
                        </button>
                      </Tooltip>
                      <Tooltip
                        content={
                          weaponSnapshotsAvailable.find(
                            (entry) => entry.id === "hammer",
                          )?.progressText ?? "Available"
                        }
                      >
                        <button
                          aria-label="Hammer"
                          className={getWeaponButtonClassName("hammer")}
                        >
                          <span className="text-lg leading-none">🔨</span>
                        </button>
                      </Tooltip>
                    </div>
                    <div className="px-1 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-stone-500">
                      {
                        upgradeSystem.getCombatStats(interactiveKills)
                          .currentToolLabel
                      }
                    </div>
                  </div>
                </div>
              </div>
            </header>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
                {headerEyebrow}
              </p>
              <h1 className="mt-2 font-display text-4xl leading-[0.94] tracking-[-0.06em] text-stone-50 sm:text-5xl xl:text-6xl">
                Race to Zero Bugs
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400 sm:text-base">
                {headerSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              <SettingsMenu
                containerRef={settingsMenuRef}
                onMenuToggle={() => handleTopMenuToggle("settings")}
                onToggle={handleToggleSetting}
                open={openTopMenu === "settings"}
                settings={settings}
              />
              <Tooltip content="Open the interactive bug-fixing game.">
                <button
                  aria-label="Open interactive bug game"
                  className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                  onClick={handleEnterInteractiveMode}
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 9.5h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1.6l-2.2 2.2a.9.9 0 0 1-1.54-.63V17.5h-1.3v1.59a.9.9 0 0 1-1.54.63l-2.2-2.2H6a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3Z" />
                    <path d="M8.2 7.4 10.4 5m5.4 2.4L13.6 5M9 12.8h.01M15 12.8h.01" />
                  </svg>
                </button>
              </Tooltip>
              <BugSettingsMenu
                bugVisualSettings={bugVisualSettings}
                containerRef={bugSettingsMenuRef}
                onChange={handleBugVisualSetting}
                onMenuToggle={() => handleTopMenuToggle("bugs")}
                onToggle={handleToggleSetting}
                open={openTopMenu === "bugs"}
                showParticleCount={showParticleCount}
                terminatorMode={terminatorMode}
              />
              <CodexPanel
                containerRef={codexMenuRef}
                onMenuToggle={() => handleTopMenuToggle("codex")}
                open={openTopMenu === "codex"}
              />
            </div>
          </header>

          <TopNav
            activeTab={activeTab}
            compareRangeKey={compareRangeKey}
            customFromDate={customFromDate}
            customToDate={customToDate}
            deadlineDate={deadlineDate}
            deadlineFromDate={deadlineFromDate}
            onInteract={handleTopNavInteract}
            onCompareRangeChange={handleCompareRangeChange}
            onCustomFromDateChange={handleCustomFromDateChange}
            onCustomToDateChange={handleCustomToDateChange}
            onDeadlineDateChange={handleDeadlineDateChange}
            onDeadlineFromDateChange={handleDeadlineFromDateChange}
            onTabChange={handleTabChange}
            todayDate={todayDate}
          />

          <CommandCenter deadlineMetrics={deadlineMetrics} summary={summary} />

          <main className="grid gap-8 pb-10">
            {activeTab === "overview" ? (
              <OverviewView
                deadlineMetrics={deadlineMetrics}
                onChartFocusChange={handleChartFocusChange}
                summary={summary}
                workdaySettings={workdaySettings}
              />
            ) : null}

            {activeTab === "periods" ? (
              <PeriodsView
                comparisonMetrics={comparisonMetrics}
                onChartFocusChange={handleChartFocusChange}
              />
            ) : null}

            {error ? <StatusBanner kind="error">{error}</StatusBanner> : null}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
