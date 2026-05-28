import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompareRange } from "./hooks/useCompareRange";
import { useAnalyticsMetrics } from "./hooks/useMetrics";
import {
  useDashboardBootstrapMetrics,
  useDashboardBootstrapSettings,
  useDashboardBootstrapUi,
} from "./context/DashboardBootstrapContext";
import type {
  CompareRangeKey,
  ComparisonMetrics,
  HistoryMetrics,
  InsightsMetrics,
} from "../../types/dashboard";

let dashboardAnalyticsLoader:
  | Promise<{
      getComparisonMetrics: typeof import("@dashboard/utils/metrics").getComparisonMetrics;
      getHistoryMetrics: typeof import("@dashboard/utils/metrics").getHistoryMetrics;
      getInsightsMetrics: typeof import("@dashboard/utils/metrics").getInsightsMetrics;
    }>
  | null = null;

type DashboardAnalyticsModule = Awaited<ReturnType<typeof loadDashboardAnalytics>>;

function loadDashboardAnalytics() {
  if (!dashboardAnalyticsLoader) {
    dashboardAnalyticsLoader = import("@dashboard/utils/metrics").then(
      ({
        getComparisonMetrics,
        getHistoryMetrics,
        getInsightsMetrics,
      }) => ({
        getComparisonMetrics,
        getHistoryMetrics,
        getInsightsMetrics,
      }),
    );
  }

  return dashboardAnalyticsLoader;
}

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
  const shouldLoadAnalytics =
    bootstrapUi.activeTab === "periods" ||
    bootstrapUi.activeTab === "insights" ||
    bootstrapUi.activeTab === "history";
  const [analyticsModule, setAnalyticsModule] =
    useState<DashboardAnalyticsModule | null>(null);
  const {
    metrics: analyticsMetricsSource,
    isLoading: isAnalyticsSourceLoading,
  } = useAnalyticsMetrics(shouldLoadAnalytics);

  const summary = useMemo(
    () => ({
      bugCount: bootstrapMetrics.deadlineMetrics.remainingBugs,
      bugsPerDayRequired: bootstrapMetrics.deadlineMetrics.bugsPerDayRequired,
      currentAddRate: bootstrapMetrics.deadlineMetrics.currentAddRate,
      currentFixRate: bootstrapMetrics.deadlineMetrics.currentFixRate,
      currentNetBurnRate: bootstrapMetrics.deadlineMetrics.currentNetBurnRate,
      daysUntilDeadline: bootstrapMetrics.deadlineMetrics.daysUntilDeadline,
      deadlineLabel: bootstrapMetrics.deadlineMetrics.deadlineLabel,
      likelihoodScore: bootstrapMetrics.deadlineMetrics.likelihoodScore,
      onTrack: bootstrapMetrics.deadlineMetrics.onTrack,
      statusSignal: bootstrapMetrics.deadlineMetrics.statusSignal,
      trackingStartLabel: bootstrapMetrics.deadlineMetrics.trackingStartLabel,
    }),
    [bootstrapMetrics.deadlineMetrics],
  );

  useEffect(() => {
    let cancelled = false;

    if (!shouldLoadAnalytics || analyticsModule) {
      return undefined;
    }

    loadDashboardAnalytics()
      .then((module) => {
        if (!cancelled) {
          setAnalyticsModule(module);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalyticsModule(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [analyticsModule, shouldLoadAnalytics]);

  const comparisonMetrics = useMemo<ComparisonMetrics | null>(() => {
    if (!analyticsMetricsSource || !analyticsModule) {
      return null;
    }

    return analyticsModule.getComparisonMetrics(analyticsMetricsSource, {
      rangeKey: compareRangeKey,
      customFromDate,
      customToDate,
      teamKey: bootstrapMetrics.selectedTeamKey,
    });
  }, [
    analyticsMetricsSource,
    analyticsModule,
    bootstrapMetrics.selectedTeamKey,
    compareRangeKey,
    customFromDate,
    customToDate,
  ]);

  const insightsMetrics = useMemo<InsightsMetrics | null>(() => {
    if (!analyticsMetricsSource || !analyticsModule) {
      return null;
    }

    return analyticsModule.getInsightsMetrics(analyticsMetricsSource, {
      rangeKey: compareRangeKey,
      customFromDate,
      customToDate,
      teamKey: bootstrapMetrics.selectedTeamKey,
    });
  }, [
    analyticsMetricsSource,
    analyticsModule,
    bootstrapMetrics.selectedTeamKey,
    compareRangeKey,
    customFromDate,
    customToDate,
  ]);

  const historyMetrics = useMemo<HistoryMetrics | null>(() => {
    if (!analyticsMetricsSource || !analyticsModule) {
      return null;
    }

    return analyticsModule.getHistoryMetrics(analyticsMetricsSource, {
      rangeKey: compareRangeKey,
      customFromDate,
      customToDate,
      teamKey: bootstrapMetrics.selectedTeamKey,
    });
  }, [
    analyticsMetricsSource,
    analyticsModule,
    bootstrapMetrics.selectedTeamKey,
    compareRangeKey,
    customFromDate,
    customToDate,
  ]);

  const isComparisonLoading =
    bootstrapUi.activeTab === "periods" &&
    (isAnalyticsSourceLoading || analyticsModule == null);
  const isInsightsLoading =
    bootstrapUi.activeTab === "insights" &&
    (isAnalyticsSourceLoading || analyticsModule == null);
  const isHistoryLoading =
    bootstrapUi.activeTab === "history" &&
    (isAnalyticsSourceLoading || analyticsModule == null);

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
    showAmbientBugs: bootstrapSettings.showAmbientBugs,
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
    toggleShowAmbientBugs: bootstrapSettings.toggleShowAmbientBugs,
    toggleShowBugParticleCount: bootstrapSettings.toggleShowBugParticleCount,
    headerEyebrow,
    headerSubtitle,
    teamFilterKey: bootstrapUi.teamFilterKey,
    teamFilterOptions: bootstrapUi.teamFilterOptions,
    historyMetrics,
    isComparisonLoading,
    isHistoryLoading,
    isInsightsLoading,
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