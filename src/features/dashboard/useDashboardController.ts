import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { endOfYear, format, subDays } from "date-fns";
import {
  getBugCountsFromPriorityDistribution,
  getBugTotal,
} from "../../constants/bugs";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { DEFAULT_GAME_CONFIG } from "../../engine/types";
import { useMetrics } from "../../hooks/useMetrics";
import { useStoredState } from "../../hooks/useStoredState";
import type {
  ActiveTab,
  BugVisualSettingKey,
  ChartFocusState,
  CompareRangeKey,
  MenuSettingsState,
  SettingToggleKey,
  TopMenuKey,
  WorkdaySettings,
} from "../../types/dashboard";
import {
  parseStoredBoolean,
  parseStoredPositiveNumber,
  parseStoredString,
} from "../../utils/storage";
import {
  getComparisonMetrics,
  getDeadlineMetrics,
  getSummaryMetrics,
} from "../../utils/metrics";

const MILESTONE_THRESHOLDS = [100, 50, 25, 10, 0] as const;

export interface MilestoneFlash {
  threshold: number;
  token: number;
}

export function useDashboardController() {
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
    1.4,
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
  const [gameConfig] = useStoredState(
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
      serialize: (value: typeof DEFAULT_GAME_CONFIG) => JSON.stringify(value),
    } as never,
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

  const closeMenus = useCallback(() => {
    setOpenTopMenu(null);
  }, []);

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
    const nextBugCount = summary.bugCount;
    const previousBugCount = previousBugCountRef.current;

    if (previousBugCount != null) {
      const crossedThreshold = MILESTONE_THRESHOLDS.find(
        (threshold) => previousBugCount > threshold && nextBugCount <= threshold,
      );
      if (crossedThreshold != null) {
        const sessionKey = `race-to-zero:milestone:${crossedThreshold}`;
        if (!window.sessionStorage.getItem(sessionKey)) {
          window.sessionStorage.setItem(sessionKey, "true");
          setMilestoneFlash({ threshold: crossedThreshold, token: Date.now() });
        }
      }
    }

    previousBugCountRef.current = nextBugCount;
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

  return {
    activeTab,
    bugSettingsMenuRef,
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
    handleBugVisualSetting,
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
    headerEyebrow,
    headerSubtitle,
    milestoneFlash,
    openTopMenu,
    settings,
    settingsMenuRef,
    setChartFocus,
    showParticleCount,
    summary,
    terminatorMode,
    todayDate,
    workdaySettings,
  };
}