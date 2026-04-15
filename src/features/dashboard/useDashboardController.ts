import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  getBugCountsFromPriorityDistribution,
  getBugTotal,
} from "../../constants/bugs";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useCompareRange } from "./hooks/useCompareRange";
import { useDeadlineRange } from "./hooks/useDeadlineRange";
import { useGameSettings } from "./hooks/useGameSettings";
import { useMetrics } from "./hooks/useMetrics";
import { useWorkdaySettings } from "./hooks/useWorkdaySettings";
import type {
  ActiveTab,
  ChartFocusState,
  CompareRangeKey,
  MenuSettingsState,
  SettingToggleKey,
  TopMenuKey,
} from "../../types/dashboard";
import {
  getComparisonMetrics,
  getDeadlineMetrics,
  getSummaryMetrics,
} from "@dashboard/utils/metrics";

export function useDashboardController() {
  const { metrics, error } = useMetrics();
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
    showBugParticleCount,
    toggleShowBugParticleCount,
  } = useGameSettings();
  const [openTopMenu, setOpenTopMenu] = useState<TopMenuKey>(null);
  const {
    compareRangeKey,
    customFromDate,
    customToDate,
    setCompareRangeKey,
    setCustomFromDate,
    setCustomToDate,
  } = useCompareRange();
  const [chartFocus, setChartFocus] = useState<ChartFocusState | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const codexMenuRef = useRef<HTMLDivElement | null>(null);

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

    }),
    [excludePublicHolidays, excludeWeekends],
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
        default:
          break;
      }
    },
    [setExcludePublicHolidays, setExcludeWeekends],
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

  const handleCompareRangeChange = useCallback((value: CompareRangeKey) => {
    setOpenTopMenu(null);
    setCompareRangeKey(value);
  }, [setCompareRangeKey]);

  const handleCustomFromDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setOpenTopMenu(null);
      setCustomFromDate(event.target.value);
    },
    [setCustomFromDate],
  );

  const handleCustomToDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setOpenTopMenu(null);
      setCustomToDate(event.target.value);
    },
    [setCustomToDate],
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

  // avoid thrashing chart focus state from rapid Chart.js hover events
  const lastChartFocusRef = useRef<ChartFocusState | null>(null);
  const handleChartFocusChange = useCallback(
    (nextFocus: ChartFocusState | null) => {
      const prev = lastChartFocusRef.current;
      const same =
        (prev === null && nextFocus === null) ||
        (prev !== null && nextFocus !== null &&
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

  const headerEyebrow =
    summary.bugCount === 0 ? "All clear" : "Operations dashboard";
  const headerSubtitle =
    summary.bugCount === 0
      ? "No open bugs in the current public snapshot."
      : "Current pace against the zero-bug deadline.";

  return {
    activeTab,
    bugVisualSettings,
    chartFocus,
    closeMenus,
    codexMenuRef,
    comparisonMetrics,
    compareRangeKey,
    currentBugCount,
    currentBugCounts,
    customFromDate,
    customToDate,
    deadlineDate,
    deadlineFromDate,
    deadlineMetrics,
    error,
    gameConfig,
    showBugParticleCount,
    handleChartFocusChange,
    handleCompareRangeChange,
    handleCustomFromDateChange,
    handleCustomToDateChange,
    handleDeadlineDateChange,
    handleDeadlineFromDateChange,
    handleTabChange,
    handleToggleSetting,
    handleTopMenuToggle,
    handleTopNavInteract,
    toggleShowBugParticleCount,
    headerEyebrow,
    headerSubtitle,
    openTopMenu,
    settings,
    settingsMenuRef,
    setChartFocus,
    summary,
    todayDate,
    workdaySettings,
  };
}