import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  getBugCountsFromPriorityDistribution,
  getBugTotal,
} from "../../constants/bugs";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useStoredState } from "@shared/hooks/useStoredState";
import { parseStoredString } from "@shared/utils/storage";
import type {
  ActiveTab,
  ChartFocusState,
  HistoryTeamOption,
  MenuSettingsState,
  SettingToggleKey,
  TopMenuKey,
} from "../../types/dashboard";
import { useDeadlineRange } from "./hooks/useDeadlineRange";
import { useGameSettings } from "./hooks/useGameSettings";
import { useMetrics } from "./hooks/useMetrics";
import { useWorkdaySettings } from "./hooks/useWorkdaySettings";
import { getBootstrapDeadlineMetrics } from "@dashboard/utils/bootstrapMetrics";

export function useDashboardBootstrapController() {
  const { metrics: metricsSource, error } = useMetrics();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const {
    deadlineDate,
    deadlineFromDate,
    setDeadlineDate,
    setDeadlineFromDate,
  } = useDeadlineRange();
  const {
    excludePublicHolidays,
    excludeWeekends,
    setExcludePublicHolidays,
    setExcludeWeekends,
    workdaySettings,
  } = useWorkdaySettings();
  const {
    bugVisualSettings,
    gameConfig,
    showAmbientBugs,
    showBugParticleCount,
    toggleShowAmbientBugs,
    toggleShowBugParticleCount,
  } = useGameSettings();
  const [teamFilterKey, setTeamFilterKey] = useStoredState(
    STORAGE_KEYS.dashboardTeamFilter,
    "all",
    { parse: parseStoredString },
  );
  const [openTopMenu, setOpenTopMenu] = useState<TopMenuKey>(null);
  const [chartFocus, setChartFocus] = useState<ChartFocusState | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const codexMenuRef = useRef<HTMLDivElement | null>(null);
  const teamFilterOptions = useMemo<HistoryTeamOption[]>(() => {
    const teamKeys = [...(metricsSource?.teamKeys ?? [])].sort((left, right) =>
      left.localeCompare(right),
    );

    return [
      { label: "All teams", value: "all" },
      ...teamKeys.map((teamKey) => ({ label: teamKey, value: teamKey })),
    ];
  }, [metricsSource]);
  const selectedTeamKey = teamFilterKey === "all" ? null : teamFilterKey;
  const deadlineMetrics = useMemo(
    () =>
      getBootstrapDeadlineMetrics(metricsSource, {
        deadlineDate,
        teamKey: selectedTeamKey,
        trackingStartDate: deadlineFromDate,
        workdaySettings,
      }),
    [
      deadlineDate,
      deadlineFromDate,
      metricsSource,
      selectedTeamKey,
      workdaySettings,
    ],
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
      showAmbientBugs,
    }),
    [excludePublicHolidays, excludeWeekends, showAmbientBugs],
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
        case "showAmbientBugs":
          toggleShowAmbientBugs();
          break;
        default:
          break;
      }
    },
    [setExcludePublicHolidays, setExcludeWeekends, toggleShowAmbientBugs],
  );

  const handleTopMenuToggle = useCallback(
    (menuKey: Exclude<TopMenuKey, null>) => {
      setOpenTopMenu((currentValue) =>
        currentValue === menuKey ? null : menuKey,
      );
    },
    [],
  );

  const closeMenus = useCallback(() => {
    setOpenTopMenu(null);
  }, []);

  const handleTopNavInteract = useCallback(() => {
    setOpenTopMenu(null);
  }, []);

  const handleTeamFilterChange = useCallback(
    (value: string) => {
      setOpenTopMenu(null);
      setTeamFilterKey(value);
    },
    [setTeamFilterKey],
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

  const lastChartFocusRef = useRef<ChartFocusState | null>(null);
  const handleChartFocusChange = useCallback(
    (nextFocus: ChartFocusState | null) => {
      const prev = lastChartFocusRef.current;
      const same =
        (prev === null && nextFocus === null) ||
        (prev !== null &&
          nextFocus !== null &&
          prev.chartKey === nextFocus.chartKey &&
          prev.dataIndex === nextFocus.dataIndex &&
          prev.datasetIndex === nextFocus.datasetIndex);

      if (same) {
        return;
      }

      lastChartFocusRef.current = nextFocus;
      setChartFocus(nextFocus);
    },
    [],
  );

  useEffect(() => {
    if (!metricsSource) {
      return;
    }

    if (
      teamFilterKey !== "all" &&
      !teamFilterOptions.some((option) => option.value === teamFilterKey)
    ) {
      setTeamFilterKey("all");
    }
  }, [metricsSource, teamFilterKey, teamFilterOptions, setTeamFilterKey]);

  useEffect(() => {
    if (!openTopMenu) {
      return undefined;
    }

    const activeMenuRef =
      openTopMenu === "codex" ? codexMenuRef : settingsMenuRef;

    const handlePointerDown = (
      event: globalThis.MouseEvent | globalThis.TouchEvent,
    ) => {
      const targetNode = event.target;

      if (!(targetNode instanceof Node)) {
        return;
      }

      const targetElement =
        targetNode instanceof Element ? targetNode : targetNode.parentElement;
      const clickedInsideCodexModal =
        openTopMenu === "codex" &&
        targetElement?.closest("[data-codex-modal-root='true']");

      if (clickedInsideCodexModal) {
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

  return {
    activeTab,
    bugVisualSettings,
    chartFocus,
    closeMenus,
    codexMenuRef,
    currentBugCount,
    currentBugCounts,
    deadlineDate,
    deadlineFromDate,
    deadlineMetrics,
    error,
    gameConfig,
    handleChartFocusChange,
    handleDeadlineDateChange,
    handleDeadlineFromDateChange,
    handleTabChange,
    handleTeamFilterChange,
    handleToggleSetting,
    handleTopMenuToggle,
    handleTopNavInteract,
    metricsSource,
    openTopMenu,
    selectedTeamKey,
    settings,
    settingsMenuRef,
    setChartFocus,
    showAmbientBugs,
    showBugParticleCount,
    teamFilterKey,
    teamFilterOptions,
    todayDate,
    toggleShowAmbientBugs,
    toggleShowBugParticleCount,
    workdaySettings,
  };
}