import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";
import { useCompareRange } from "./hooks/useCompareRange";
import {
  useDashboardBootstrapMetrics,
  useDashboardBootstrapSettings,
  useDashboardBootstrapUi,
} from "./context/DashboardBootstrapContext";
import type { CompareRangeKey } from "../../types/dashboard";
import {
  getComparisonMetrics,
  getHistoryMetrics,
  getInsightsMetrics,
  getSummaryMetrics,
} from "@dashboard/utils/metrics";

export function useDashboardController() {
  const bootstrapMetrics = useDashboardBootstrapMetrics();
  const bootstrapSettings = useDashboardBootstrapSettings();
  const bootstrapUi = useDashboardBootstrapUi();
  const {
    compareRangeKey,
    customFromDate,
    customToDate,
    setCompareRangeKey,
    setCustomFromDate,
    setCustomToDate,
  } = useCompareRange();

  const comparisonMetrics = useMemo(
    () =>
      getComparisonMetrics(bootstrapMetrics.metricsSource, {
        rangeKey: compareRangeKey,
        customFromDate,
        customToDate,
        teamKey: bootstrapMetrics.selectedTeamKey,
      }),
    [
      bootstrapMetrics.metricsSource,
      bootstrapMetrics.selectedTeamKey,
      compareRangeKey,
      customFromDate,
      customToDate,
    ],
  );

  const insightsMetrics = useMemo(
    () =>
      getInsightsMetrics(bootstrapMetrics.metricsSource, {
        rangeKey: compareRangeKey,
        customFromDate,
        customToDate,
        teamKey: bootstrapMetrics.selectedTeamKey,
      }),
    [
      bootstrapMetrics.metricsSource,
      bootstrapMetrics.selectedTeamKey,
      compareRangeKey,
      customFromDate,
      customToDate,
    ],
  );

  const historyMetrics = useMemo(
    () =>
      getHistoryMetrics(bootstrapMetrics.metricsSource, {
        rangeKey: compareRangeKey,
        customFromDate,
        customToDate,
        teamKey: bootstrapMetrics.selectedTeamKey,
      }),
    [
      bootstrapMetrics.metricsSource,
      bootstrapMetrics.selectedTeamKey,
      compareRangeKey,
      customFromDate,
      customToDate,
    ],
  );

  const summary = useMemo(
    () => getSummaryMetrics(bootstrapMetrics.deadlineMetrics),
    [bootstrapMetrics.deadlineMetrics],
  );

  const handleCompareRangeChange = useCallback(
    (value: CompareRangeKey) => {
      bootstrapUi.closeMenus();
      setCompareRangeKey(value);
    },
    [bootstrapUi, setCompareRangeKey],
  );

  const handleCustomFromDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      bootstrapUi.closeMenus();
      setCustomFromDate(event.target.value);
    },
    [bootstrapUi, setCustomFromDate],
  );

  const handleCustomToDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      bootstrapUi.closeMenus();
      setCustomToDate(event.target.value);
    },
    [bootstrapUi, setCustomToDate],
  );

  const headerEyebrow =
    summary.bugCount === 0 ? "All clear" : "Operations dashboard";
  const headerSubtitle =
    summary.bugCount === 0
      ? "No open bugs in the current public snapshot."
      : "Current pace against the zero-bug deadline.";

  return {
    activeTab: bootstrapUi.activeTab,
    bugVisualSettings: bootstrapSettings.bugVisualSettings,
    chartFocus: bootstrapUi.chartFocus,
    closeMenus: bootstrapUi.closeMenus,
    codexMenuRef: bootstrapUi.codexMenuRef,
    comparisonMetrics,
    compareRangeKey,
    currentBugCount: bootstrapMetrics.currentBugCount,
    currentBugCounts: bootstrapMetrics.currentBugCounts,
    customFromDate,
    customToDate,
    deadlineDate: bootstrapUi.deadlineDate,
    deadlineFromDate: bootstrapUi.deadlineFromDate,
    deadlineMetrics: bootstrapMetrics.deadlineMetrics,
    error: bootstrapMetrics.error,
    gameConfig: bootstrapSettings.gameConfig,
    showBugParticleCount: bootstrapSettings.showBugParticleCount,
    handleChartFocusChange: bootstrapUi.handleChartFocusChange,
    handleCompareRangeChange,
    handleCustomFromDateChange,
    handleCustomToDateChange,
    handleDeadlineDateChange: bootstrapUi.handleDeadlineDateChange,
    handleDeadlineFromDateChange: bootstrapUi.handleDeadlineFromDateChange,
    handleTabChange: bootstrapUi.handleTabChange,
    handleTeamFilterChange: bootstrapUi.handleTeamFilterChange,
    handleToggleSetting: bootstrapSettings.handleToggleSetting,
    handleTopMenuToggle: bootstrapUi.handleTopMenuToggle,
    handleTopNavInteract: bootstrapUi.handleTopNavInteract,
    toggleShowBugParticleCount: bootstrapSettings.toggleShowBugParticleCount,
    headerEyebrow,
    headerSubtitle,
    teamFilterKey: bootstrapUi.teamFilterKey,
    teamFilterOptions: bootstrapUi.teamFilterOptions,
    historyMetrics,
    insightsMetrics,
    openTopMenu: bootstrapUi.openTopMenu,
    settings: bootstrapSettings.settings,
    settingsMenuRef: bootstrapUi.settingsMenuRef,
    setChartFocus: bootstrapUi.setChartFocus,
    summary,
    todayDate: bootstrapUi.todayDate,
    workdaySettings: bootstrapSettings.workdaySettings,
  };
}