import {
  Suspense,
  lazy,
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { DashboardProvider } from "@dashboard/context/DashboardContext";
import CommandCenter from "@dashboard/components/CommandCenter";
import SettingsMenu from "@dashboard/components/SettingsMenu";
import TopNav from "@dashboard/components/TopNav";
import {
  hideAllCustomChartTooltips,
  removeAllCustomChartTooltips,
} from "@dashboard/utils/chartConfig";
import {
  useDashboardMetrics,
  useDashboardSettings,
  useDashboardUi,
} from "@dashboard/context/DashboardContext";
import { OverviewView } from "@dashboard/DashboardViews";
import StatusBanner from "@shared/components/StatusBanner";
import type { SiegePhase } from "@game/types";
import Tooltip from "@shared/components/Tooltip";
import { cn } from "@shared/utils/cn";

const CHROME_TRANSITION_CLASSNAME =
  "transition-[opacity,transform,filter] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)]";

const PeriodsView = lazy(() =>
  import("@dashboard/DashboardAnalyticsViews").then((module) => ({
    default: module.PeriodsView,
  })),
);
const InsightsView = lazy(() =>
  import("@dashboard/DashboardAnalyticsViews").then((module) => ({
    default: module.InsightsView,
  })),
);
const HistoryView = lazy(() =>
  import("@dashboard/DashboardAnalyticsViews").then((module) => ({
    default: module.HistoryView,
  })),
);

interface DashboardShellProps {
  dashboardRef: RefObject<HTMLDivElement | null>;
  interactiveMode: boolean;
  onEnterInteractiveMode: () => void;
  onPrefetchSiege: () => void;
  siegePhase: SiegePhase;
}

type SkeletonChartVariant = "bar" | "line";
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn(
        "dashboard-skeleton-shell rounded-full bg-[rgba(255,255,255,0.06)]",
        className,
      )}
    />
  );
}

function MetricCardSkeleton() {
  return (
    <article className="relative flex h-full min-h-[68px] flex-col overflow-hidden rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,28,0.96),rgba(18,23,34,0.96))] px-2.5 py-[0.4375rem] shadow-[0_8px_18px_rgba(0,0,0,0.16)] sm:min-h-[76px] sm:rounded-[18px] sm:py-2">
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="relative flex items-start gap-3">
        <SkeletonBlock className="mt-0.5 h-2.5 w-20 sm:h-2.5 sm:w-24" />
      </div>
      <SkeletonBlock className="mt-3 h-7 w-[58%] rounded-[10px] sm:mt-3.5 sm:h-8" />
    </article>
  );
}

function ChartPlotSkeleton({ variant }: { variant: SkeletonChartVariant }) {
  if (variant === "bar") {
    return (
      <div className="absolute inset-0 flex items-end gap-2 px-2 pb-2 pt-5 sm:gap-2.5 sm:px-3 sm:pb-3">
        {[34, 62, 48, 78, 56, 70, 44].map((height, index) => (
          <div
            key={`bar-skeleton-${index}`}
            className="dashboard-skeleton-shell flex-1 rounded-t-[8px] bg-[rgba(255,255,255,0.06)]"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    );
  }

  const points = [
    { left: "4%", top: "66%" },
    { left: "20%", top: "54%" },
    { left: "38%", top: "59%" },
    { left: "56%", top: "32%" },
    { left: "74%", top: "43%" },
    { left: "92%", top: "24%" },
  ];

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-2 bottom-2 top-5 rounded-[14px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] sm:inset-x-3 sm:bottom-3" />
      {points.slice(0, -1).map((point, index) => {
        const nextPoint = points[index + 1];
        const x1 = Number.parseFloat(point.left);
        const y1 = Number.parseFloat(point.top);
        const x2 = Number.parseFloat(nextPoint.left);
        const y2 = Number.parseFloat(nextPoint.top);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        return (
          <div
            key={`line-skeleton-segment-${index}`}
            className="absolute h-[2px] origin-left rounded-full bg-white/12"
            style={{
              left: point.left,
              top: point.top,
              transform: `rotate(${angle}deg)`,
              width: `${length}%`,
            }}
          />
        );
      })}
      {points.map((point, index) => (
        <div
          key={`line-skeleton-point-${index}`}
          className="dashboard-skeleton-shell absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-zinc-800"
          style={{ left: point.left, top: point.top }}
        />
      ))}
    </div>
  );
}

function ChartCardSkeleton({ variant }: { variant: SkeletonChartVariant }) {
  return (
    <article className="group relative flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,18,0.96),rgba(19,23,32,0.96))] p-2.5 text-stone-50 shadow-[0_14px_28px_rgba(0,0,0,0.24)] sm:rounded-[20px] sm:p-3">
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_60%)]" />
      <div className="relative flex h-full flex-col">
        <div className="shrink-0">
          <SkeletonBlock className="mt-1 h-4.5 w-40 rounded-[8px] sm:h-5 sm:w-48" />
          <SkeletonBlock className="mt-[0.5rem] h-2.5 w-[92%] sm:w-[88%]" />
          <SkeletonBlock className="mt-2 h-2.5 w-[68%]" />
        </div>
        <div className="relative mt-2 h-[156px] shrink-0 overflow-hidden sm:mt-2.5 sm:h-[184px] xl:h-[198px]">
          <div className="dashboard-skeleton-shell absolute inset-0 rounded-[14px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))]" />
          <ChartPlotSkeleton variant={variant} />
        </div>
      </div>
    </article>
  );
}

function AnalyticsPanelFallback({
  cardCount,
  chartVariants,
}: {
  cardCount: number;
  chartVariants: SkeletonChartVariant[];
}) {
  return (
    <div aria-hidden="true" className="grid content-start gap-1.5 sm:gap-2">
      <div
        className={cn(
          "grid gap-1.5 sm:gap-2",
          cardCount <= 4
            ? "sm:grid-cols-2 xl:grid-cols-4"
            : cardCount === 5
              ? "sm:grid-cols-2 xl:grid-cols-5"
              : "sm:grid-cols-2 xl:grid-cols-6",
        )}
      >
        {Array.from({ length: cardCount }, (_, index) => (
          <MetricCardSkeleton key={`tab-skeleton-card-${index}`} />
        ))}
      </div>
      <div className="grid items-stretch gap-1.5 md:grid-cols-2 sm:gap-2">
        {chartVariants.map((variant, index) => (
          <ChartCardSkeleton
            key={`tab-skeleton-chart-${index}`}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

function AnalyticsTabSkeleton({
  cardCount,
  chartVariants,
}: {
  cardCount: number;
  chartVariants: SkeletonChartVariant[];
}) {
  return (
    <AnalyticsPanelFallback
      cardCount={cardCount}
      chartVariants={chartVariants}
    />
  );
}

const PERIODS_CHART_VARIANTS: SkeletonChartVariant[] = [
  "line",
  "bar",
  "bar",
  "line",
];
const INSIGHTS_CHART_VARIANTS: SkeletonChartVariant[] = [
  "bar",
  "bar",
  "line",
  "bar",
];
const HISTORY_CHART_VARIANTS: SkeletonChartVariant[] = [
  "bar",
  "line",
  "bar",
  "bar",
];

const DashboardShellContent = memo(function DashboardShellContent({
  dashboardRef,
  interactiveMode,
  onEnterInteractiveMode,
  onPrefetchSiege,
  siegePhase,
}: DashboardShellProps) {
  const metrics = useDashboardMetrics();
  const settings = useDashboardSettings();
  const ui = useDashboardUi();
  const chromeHidden = interactiveMode;
  const chartFocusHandler = interactiveMode
    ? ui.handleChartFocusChange
    : undefined;
  const shellFrameRef = useRef<HTMLDivElement | null>(null);
  const [autoFitScale, setAutoFitScale] = useState(1);
  const periodsPanel = (() => {
    if (metrics.isComparisonLoading) {
      return (
        <AnalyticsTabSkeleton
          cardCount={4}
          chartVariants={PERIODS_CHART_VARIANTS}
        />
      );
    }

    if (!metrics.comparisonMetrics) {
      return (
        <AnalyticsPanelFallback
          cardCount={4}
          chartVariants={PERIODS_CHART_VARIANTS}
        />
      );
    }

    return (
      <Suspense
        fallback={
          <AnalyticsTabSkeleton
            cardCount={4}
            chartVariants={PERIODS_CHART_VARIANTS}
          />
        }
      >
        <PeriodsView
          comparisonMetrics={metrics.comparisonMetrics}
          onChartFocusChange={chartFocusHandler}
          siegeMode={interactiveMode}
        />
      </Suspense>
    );
  })();

  const insightsPanel = (() => {
    if (metrics.isInsightsLoading) {
      return (
        <AnalyticsTabSkeleton
          cardCount={5}
          chartVariants={INSIGHTS_CHART_VARIANTS}
        />
      );
    }

    if (!metrics.insightsMetrics) {
      return (
        <AnalyticsPanelFallback
          cardCount={5}
          chartVariants={INSIGHTS_CHART_VARIANTS}
        />
      );
    }

    return (
      <Suspense
        fallback={
          <AnalyticsTabSkeleton
            cardCount={5}
            chartVariants={INSIGHTS_CHART_VARIANTS}
          />
        }
      >
        <InsightsView
          insightsMetrics={metrics.insightsMetrics}
          onChartFocusChange={chartFocusHandler}
          siegeMode={interactiveMode}
        />
      </Suspense>
    );
  })();

  const historyPanel = (() => {
    if (metrics.isHistoryLoading) {
      return (
        <AnalyticsTabSkeleton
          cardCount={6}
          chartVariants={HISTORY_CHART_VARIANTS}
        />
      );
    }

    if (!metrics.historyMetrics) {
      return (
        <AnalyticsPanelFallback
          cardCount={6}
          chartVariants={HISTORY_CHART_VARIANTS}
        />
      );
    }

    return (
      <Suspense
        fallback={
          <AnalyticsTabSkeleton
            cardCount={6}
            chartVariants={HISTORY_CHART_VARIANTS}
          />
        }
      >
        <HistoryView
          historyMetrics={metrics.historyMetrics}
          onChartFocusChange={chartFocusHandler}
          siegeMode={interactiveMode}
        />
      </Suspense>
    );
  })();

  useLayoutEffect(() => {
    const frame = shellFrameRef.current;
    const content = dashboardRef.current;
    if (!frame || !content) {
      return undefined;
    }

    let frameId = 0;

    const measure = () => {
      const frameRect = frame.getBoundingClientRect();
      const nextScale = Math.min(
        1,
        frameRect.width / Math.max(1, content.scrollWidth),
        frameRect.height / Math.max(1, content.scrollHeight),
      );

      setAutoFitScale((current) =>
        Math.abs(current - nextScale) < 0.01 ? current : nextScale,
      );
    };

    const scheduleMeasure = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        measure();
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      scheduleMeasure();
    });

    resizeObserver.observe(frame);
    resizeObserver.observe(content);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [dashboardRef, ui.activeTab]);

  useEffect(() => {
    removeAllCustomChartTooltips();
  }, []);

  useEffect(() => {
    if (!interactiveMode) {
      return;
    }

    hideAllCustomChartTooltips();
  }, [interactiveMode]);

  return (
    <div
      ref={shellFrameRef}
      className="relative z-10 flex h-screen w-full items-start justify-center overflow-hidden px-1.5 py-1.5 sm:px-2.5 sm:py-2.5 lg:px-3 lg:py-3"
    >
      <div
        style={{
          transform: `scale(${autoFitScale})`,
          transformOrigin: "top center",
          width: autoFitScale < 1 ? `${100 / autoFitScale}%` : "100%",
        }}
      >
        <div
          ref={dashboardRef}
          className={cn(
            "relative z-10 mx-auto grid w-full max-w-[1360px] content-start gap-1 px-0 py-0 sm:gap-1.5",
            interactiveMode ? "pointer-events-none select-none" : "",
          )}
          style={{
            opacity: siegePhase === "entering" ? 0.04 : 1,
            transform:
              siegePhase === "entering"
                ? "translateY(6px) scale(0.992)"
                : undefined,
            transition: "opacity 220ms ease-out, transform 260ms ease-out",
          }}
        >
          <header
            className={cn(
              "relative z-20 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-2.5",
              CHROME_TRANSITION_CLASSNAME,
              chromeHidden
                ? "-translate-y-5 opacity-0 blur-sm"
                : "translate-y-0 opacity-100 blur-0",
            )}
          >
            <div className="min-w-0 max-w-3xl">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-stone-500">
                {metrics.headerEyebrow}
              </p>
              <h1 className="mt-1 font-display text-[1.8rem] leading-[0.94] tracking-[-0.055em] text-stone-50 sm:mt-1.5 sm:text-[2.15rem] xl:text-[2.55rem]">
                Race to Zero Bugs
              </h1>
              <p className="mt-1.5 max-w-2xl text-[0.72rem] leading-[1.15rem] text-stone-400 sm:mt-2 sm:text-[0.82rem] sm:leading-5">
                {metrics.headerSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-start justify-start gap-[0.3125rem] self-start md:justify-end md:gap-1.5">
              <SettingsMenu
                containerRef={ui.settingsMenuRef}
                onMenuToggle={() => ui.handleTopMenuToggle("settings")}
                onToggle={settings.handleToggleSetting}
                onToggleShowBugParticleCount={
                  settings.toggleShowBugParticleCount
                }
                open={!interactiveMode && ui.openTopMenu === "settings"}
                settings={settings.settings}
                showBugParticleCount={settings.showBugParticleCount}
              />
              {!interactiveMode && settings.showAmbientBugs ? (
                <Tooltip content="Start the interactive bug game.">
                  <button
                    aria-label="Open interactive bug game"
                    className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-[14px] border border-white/10 bg-zinc-950/86 px-2.5 text-stone-300 shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                    onClick={onEnterInteractiveMode}
                    onFocus={onPrefetchSiege}
                    onMouseEnter={onPrefetchSiege}
                    onTouchStart={onPrefetchSiege}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
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
              ) : null}
            </div>
          </header>

          <div
            className={cn(
              "relative z-10 rounded-[20px] px-[0.3125rem] py-[0.1875rem] sm:px-2 sm:py-[0.3125rem]",
              CHROME_TRANSITION_CLASSNAME,
              chromeHidden
                ? "translate-y-[-12px] opacity-0 blur-sm"
                : "translate-y-0 opacity-100 blur-0",
            )}
            data-siege-panel="top-nav"
          >
            <TopNav
              activeTab={ui.activeTab}
              compareRangeKey={ui.compareRangeKey}
              customFromDate={ui.customFromDate}
              customToDate={ui.customToDate}
              deadlineDate={ui.deadlineDate}
              deadlineFromDate={ui.deadlineFromDate}
              teamFilterKey={ui.teamFilterKey}
              teamFilterOptions={ui.teamFilterOptions}
              onCompareRangeChange={ui.handleCompareRangeChange}
              onCustomFromDateChange={ui.handleCustomFromDateChange}
              onCustomToDateChange={ui.handleCustomToDateChange}
              onDeadlineDateChange={ui.handleDeadlineDateChange}
              onDeadlineFromDateChange={ui.handleDeadlineFromDateChange}
              onTeamFilterChange={ui.handleTeamFilterChange}
              onInteract={ui.handleTopNavInteract}
              onTabChange={ui.handleTabChange}
              todayDate={ui.todayDate}
            />
          </div>

          <div
            className={cn(
              "relative z-10",
              CHROME_TRANSITION_CLASSNAME,
              chromeHidden
                ? "translate-y-[-14px] opacity-0 blur-sm"
                : "translate-y-0 opacity-100 blur-0",
            )}
          >
            <CommandCenter
              activeTab={ui.activeTab}
              comparisonMetrics={metrics.comparisonMetrics}
              deadlineMetrics={metrics.deadlineMetrics}
              historyMetrics={metrics.historyMetrics}
              insightsMetrics={metrics.insightsMetrics}
              siegeMode={interactiveMode}
              summary={metrics.summary}
            />
          </div>

          <main className="grid content-start gap-1.5 self-start sm:gap-2">
            <div>
              {ui.activeTab === "overview" ? (
                <OverviewView
                  deadlineMetrics={metrics.deadlineMetrics}
                  onChartFocusChange={chartFocusHandler}
                  siegeMode={interactiveMode}
                  summary={metrics.summary}
                  workdaySettings={settings.workdaySettings}
                />
              ) : null}

              <div className={ui.activeTab === "periods" ? "block" : "hidden"}>
                {periodsPanel}
              </div>

              <div className={ui.activeTab === "insights" ? "block" : "hidden"}>
                {insightsPanel}
              </div>

              <div className={ui.activeTab === "history" ? "block" : "hidden"}>
                {historyPanel}
              </div>
            </div>

            {metrics.error ? (
              <StatusBanner kind="error">{metrics.error}</StatusBanner>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
});

export default function DashboardShell(props: DashboardShellProps) {
  return (
    <DashboardProvider>
      <DashboardShellContent {...props} />
    </DashboardProvider>
  );
}
