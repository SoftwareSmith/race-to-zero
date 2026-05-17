/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useContext,
  useMemo,
  type Context,
  type ReactNode,
} from "react";
import { useDashboardBootstrapController } from "../useDashboardBootstrapController";

type DashboardBootstrapValue = ReturnType<
  typeof useDashboardBootstrapController
>;
type DashboardBootstrapUiValue = Pick<
  DashboardBootstrapValue,
  | "activeTab"
  | "chartFocus"
  | "closeMenus"
  | "codexMenuRef"
  | "deadlineDate"
  | "deadlineFromDate"
  | "handleChartFocusChange"
  | "handleDeadlineDateChange"
  | "handleDeadlineFromDateChange"
  | "handleTabChange"
  | "handleTeamFilterChange"
  | "handleTopMenuToggle"
  | "handleTopNavInteract"
  | "openTopMenu"
  | "setChartFocus"
  | "settingsMenuRef"
  | "teamFilterKey"
  | "teamFilterOptions"
  | "todayDate"
>;
type DashboardBootstrapMetricsValue = Pick<
  DashboardBootstrapValue,
  | "currentBugCount"
  | "currentBugCounts"
  | "deadlineMetrics"
  | "error"
  | "metricsSource"
  | "selectedTeamKey"
>;
type DashboardBootstrapSettingsValue = Pick<
  DashboardBootstrapValue,
  | "bugVisualSettings"
  | "gameConfig"
  | "handleToggleSetting"
  | "settings"
  | "showBugParticleCount"
  | "toggleShowBugParticleCount"
  | "workdaySettings"
>;

const DashboardBootstrapUiContext =
  createContext<DashboardBootstrapUiValue | null>(null);
const DashboardBootstrapMetricsContext =
  createContext<DashboardBootstrapMetricsValue | null>(null);
const DashboardBootstrapSettingsContext =
  createContext<DashboardBootstrapSettingsValue | null>(null);

export function DashboardBootstrapProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useDashboardBootstrapController();
  const uiValue = useMemo<DashboardBootstrapUiValue>(
    () => ({
      activeTab: value.activeTab,
      chartFocus: value.chartFocus,
      closeMenus: value.closeMenus,
      codexMenuRef: value.codexMenuRef,
      deadlineDate: value.deadlineDate,
      deadlineFromDate: value.deadlineFromDate,
      handleChartFocusChange: value.handleChartFocusChange,
      handleDeadlineDateChange: value.handleDeadlineDateChange,
      handleDeadlineFromDateChange: value.handleDeadlineFromDateChange,
      handleTabChange: value.handleTabChange,
      handleTeamFilterChange: value.handleTeamFilterChange,
      handleTopMenuToggle: value.handleTopMenuToggle,
      handleTopNavInteract: value.handleTopNavInteract,
      openTopMenu: value.openTopMenu,
      setChartFocus: value.setChartFocus,
      settingsMenuRef: value.settingsMenuRef,
      teamFilterKey: value.teamFilterKey,
      teamFilterOptions: value.teamFilterOptions,
      todayDate: value.todayDate,
    }),
    [
      value.activeTab,
      value.chartFocus,
      value.closeMenus,
      value.codexMenuRef,
      value.deadlineDate,
      value.deadlineFromDate,
      value.handleChartFocusChange,
      value.handleDeadlineDateChange,
      value.handleDeadlineFromDateChange,
      value.handleTabChange,
      value.handleTeamFilterChange,
      value.handleTopMenuToggle,
      value.handleTopNavInteract,
      value.openTopMenu,
      value.setChartFocus,
      value.settingsMenuRef,
      value.teamFilterKey,
      value.teamFilterOptions,
      value.todayDate,
    ],
  );
  const metricsValue = useMemo<DashboardBootstrapMetricsValue>(
    () => ({
      currentBugCount: value.currentBugCount,
      currentBugCounts: value.currentBugCounts,
      deadlineMetrics: value.deadlineMetrics,
      error: value.error,
      metricsSource: value.metricsSource,
      selectedTeamKey: value.selectedTeamKey,
    }),
    [
      value.currentBugCount,
      value.currentBugCounts,
      value.deadlineMetrics,
      value.error,
      value.metricsSource,
      value.selectedTeamKey,
    ],
  );
  const settingsValue = useMemo<DashboardBootstrapSettingsValue>(
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
    <DashboardBootstrapUiContext.Provider value={uiValue}>
      <DashboardBootstrapMetricsContext.Provider value={metricsValue}>
        <DashboardBootstrapSettingsContext.Provider value={settingsValue}>
          {children}
        </DashboardBootstrapSettingsContext.Provider>
      </DashboardBootstrapMetricsContext.Provider>
    </DashboardBootstrapUiContext.Provider>
  );
}

function useRequiredBootstrapContext<T>(
  context: Context<T | null>,
  name: string,
): T {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${name} must be used within a DashboardBootstrapProvider`);
  }

  return value;
}

export function useDashboardBootstrapUi(): DashboardBootstrapUiValue {
  return useRequiredBootstrapContext(
    DashboardBootstrapUiContext,
    "useDashboardBootstrapUi",
  );
}

export function useDashboardBootstrapMetrics(): DashboardBootstrapMetricsValue {
  return useRequiredBootstrapContext(
    DashboardBootstrapMetricsContext,
    "useDashboardBootstrapMetrics",
  );
}

export function useDashboardBootstrapSettings(): DashboardBootstrapSettingsValue {
  return useRequiredBootstrapContext(
    DashboardBootstrapSettingsContext,
    "useDashboardBootstrapSettings",
  );
}
