/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useContext,
  useMemo,
  type Context,
  type ReactNode,
} from "react";
import { useDashboardController } from "../useDashboardController";

type DashboardContextValue = ReturnType<typeof useDashboardController>;
type DashboardUiValue = Pick<
  DashboardContextValue,
  | "activeTab"
  | "chartFocus"
  | "closeMenus"
  | "codexMenuRef"
  | "compareRangeKey"
  | "customFromDate"
  | "customToDate"
  | "deadlineDate"
  | "deadlineFromDate"
  | "handleChartFocusChange"
  | "handleCompareRangeChange"
  | "handleCustomFromDateChange"
  | "handleCustomToDateChange"
  | "handleDeadlineDateChange"
  | "handleDeadlineFromDateChange"
  | "handleTabChange"
  | "handleTopMenuToggle"
  | "handleTopNavInteract"
  | "openTopMenu"
  | "setChartFocus"
  | "settingsMenuRef"
  | "todayDate"
>;
type DashboardMetricsValue = Pick<
  DashboardContextValue,
  | "comparisonMetrics"
  | "currentBugCount"
  | "currentBugCounts"
  | "deadlineMetrics"
  | "error"
  | "headerEyebrow"
  | "headerSubtitle"
  | "insightsMetrics"
  | "summary"
>;
type DashboardSettingsValue = Pick<
  DashboardContextValue,
  | "bugVisualSettings"
  | "gameConfig"
  | "handleToggleSetting"
  | "settings"
  | "showBugParticleCount"
  | "toggleShowBugParticleCount"
  | "workdaySettings"
>;

const DashboardContext = createContext<DashboardContextValue | null>(null);
const DashboardUiContext = createContext<DashboardUiValue | null>(null);
const DashboardMetricsContext = createContext<DashboardMetricsValue | null>(
  null,
);
const DashboardSettingsContext = createContext<DashboardSettingsValue | null>(
  null,
);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const value = useDashboardController();
  const uiValue = useMemo<DashboardUiValue>(
    () => ({
      activeTab: value.activeTab,
      chartFocus: value.chartFocus,
      closeMenus: value.closeMenus,
      codexMenuRef: value.codexMenuRef,
      compareRangeKey: value.compareRangeKey,
      customFromDate: value.customFromDate,
      customToDate: value.customToDate,
      deadlineDate: value.deadlineDate,
      deadlineFromDate: value.deadlineFromDate,
      handleChartFocusChange: value.handleChartFocusChange,
      handleCompareRangeChange: value.handleCompareRangeChange,
      handleCustomFromDateChange: value.handleCustomFromDateChange,
      handleCustomToDateChange: value.handleCustomToDateChange,
      handleDeadlineDateChange: value.handleDeadlineDateChange,
      handleDeadlineFromDateChange: value.handleDeadlineFromDateChange,
      handleTabChange: value.handleTabChange,
      handleTopMenuToggle: value.handleTopMenuToggle,
      handleTopNavInteract: value.handleTopNavInteract,
      openTopMenu: value.openTopMenu,
      setChartFocus: value.setChartFocus,
      settingsMenuRef: value.settingsMenuRef,
      todayDate: value.todayDate,
    }),
    [
      value.activeTab,
      value.chartFocus,
      value.closeMenus,
      value.codexMenuRef,
      value.compareRangeKey,
      value.customFromDate,
      value.customToDate,
      value.deadlineDate,
      value.deadlineFromDate,
      value.handleChartFocusChange,
      value.handleCompareRangeChange,
      value.handleCustomFromDateChange,
      value.handleCustomToDateChange,
      value.handleDeadlineDateChange,
      value.handleDeadlineFromDateChange,
      value.handleTabChange,
      value.handleTopMenuToggle,
      value.handleTopNavInteract,
      value.openTopMenu,
      value.setChartFocus,
      value.settingsMenuRef,
      value.todayDate,
    ],
  );
  const metricsValue = useMemo<DashboardMetricsValue>(
    () => ({
      comparisonMetrics: value.comparisonMetrics,
      currentBugCount: value.currentBugCount,
      currentBugCounts: value.currentBugCounts,
      deadlineMetrics: value.deadlineMetrics,
      error: value.error,
      headerEyebrow: value.headerEyebrow,
      headerSubtitle: value.headerSubtitle,
      insightsMetrics: value.insightsMetrics,
      summary: value.summary,
    }),
    [
      value.comparisonMetrics,
      value.currentBugCount,
      value.currentBugCounts,
      value.deadlineMetrics,
      value.error,
      value.headerEyebrow,
      value.headerSubtitle,
      value.insightsMetrics,
      value.summary,
    ],
  );
  const settingsValue = useMemo<DashboardSettingsValue>(
    () => ({
      bugVisualSettings: value.bugVisualSettings,
      gameConfig: value.gameConfig,
      handleToggleSetting: value.handleToggleSetting,
      settings: value.settings,
      showBugParticleCount: value.showBugParticleCount,
      toggleShowBugParticleCount: value.toggleShowBugParticleCount,
      workdaySettings: value.workdaySettings,
    }),
    [
      value.bugVisualSettings,
      value.gameConfig,
      value.handleToggleSetting,
      value.settings,
      value.showBugParticleCount,
      value.toggleShowBugParticleCount,
      value.workdaySettings,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      <DashboardUiContext.Provider value={uiValue}>
        <DashboardMetricsContext.Provider value={metricsValue}>
          <DashboardSettingsContext.Provider value={settingsValue}>
            {children}
          </DashboardSettingsContext.Provider>
        </DashboardMetricsContext.Provider>
      </DashboardUiContext.Provider>
    </DashboardContext.Provider>
  );
}

export function useDashboardContext(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error(
      "useDashboardContext must be used within a DashboardProvider",
    );
  }
  return ctx;
}

function useRequiredDashboardContext<T>(
  context: Context<T | null>,
  name: string,
): T {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${name} must be used within a DashboardProvider`);
  }

  return value;
}

export function useDashboardUi(): DashboardUiValue {
  return useRequiredDashboardContext(DashboardUiContext, "useDashboardUi");
}

export function useDashboardMetrics(): DashboardMetricsValue {
  return useRequiredDashboardContext(
    DashboardMetricsContext,
    "useDashboardMetrics",
  );
}

export function useDashboardSettings(): DashboardSettingsValue {
  return useRequiredDashboardContext(
    DashboardSettingsContext,
    "useDashboardSettings",
  );
}
