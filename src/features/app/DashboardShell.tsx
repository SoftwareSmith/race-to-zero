import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import CommandCenter from "@dashboard/components/CommandCenter";
import SettingsMenu from "@dashboard/components/SettingsMenu";
import TopNav from "@dashboard/components/TopNav";
import {
  useDashboardMetrics,
  useDashboardSettings,
  useDashboardUi,
} from "@dashboard/context/DashboardContext";
import {
  InsightsView,
  OverviewView,
  PeriodsView,
  StatusBanner,
} from "@dashboard/DashboardViews";
import {
  MenuIconButton,
  MenuPanel,
  ToggleField,
} from "@shared/components/MenuControls";
import type { SiegePhase } from "@game/types";
import Tooltip from "@shared/components/Tooltip";
import { cn } from "@shared/utils/cn";

const CHROME_TRANSITION_CLASSNAME =
  "transition-[opacity,transform,filter] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)]";

interface DashboardShellProps {
  dashboardRef: RefObject<HTMLDivElement | null>;
  interactiveMode: boolean;
  onEnterInteractiveMode: () => void;
  onPrefetchSiege: () => void;
  siegePhase: SiegePhase;
}

const DashboardShell = memo(function DashboardShell({
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
  const bugFieldMenuRef = useRef<HTMLDivElement | null>(null);
  const shellFrameRef = useRef<HTMLDivElement | null>(null);
  const [bugFieldMenuOpen, setBugFieldMenuOpen] = useState(false);
  const [autoFitScale, setAutoFitScale] = useState(1);

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
    if (!bugFieldMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        bugFieldMenuRef.current &&
        !bugFieldMenuRef.current.contains(target)
      ) {
        setBugFieldMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [bugFieldMenuOpen]);

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
                open={!interactiveMode && ui.openTopMenu === "settings"}
                settings={settings.settings}
              />
              <div className="relative" ref={bugFieldMenuRef}>
                <MenuIconButton
                  ariaLabel="Open bug field settings"
                  onClick={() =>
                    setBugFieldMenuOpen((currentValue) => !currentValue)
                  }
                  open={bugFieldMenuOpen}
                  size="compact"
                  tooltip="Bug field overlay controls."
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
                    <path d="M4 12h16" />
                    <path d="M12 4v16" />
                    <circle cx="12" cy="12" r="7" />
                  </svg>
                </MenuIconButton>

                {bugFieldMenuOpen ? (
                  <MenuPanel size="compact" title="Bug Field">
                    <ToggleField
                      checked={settings.showBugParticleCount}
                      description="Show the rendered bug particle count overlay on the dashboard background."
                      label="Show bug particle count"
                      onChange={settings.toggleShowBugParticleCount}
                      size="compact"
                    />
                  </MenuPanel>
                ) : null}
              </div>
              {!interactiveMode ? (
                <Tooltip content="Start the interactive bug game.">
                  <button
                    aria-label="Open interactive bug game"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-[14px] border border-white/10 bg-zinc-950/86 px-2.5 text-stone-300 shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
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
              onCompareRangeChange={ui.handleCompareRangeChange}
              onCustomFromDateChange={ui.handleCustomFromDateChange}
              onCustomToDateChange={ui.handleCustomToDateChange}
              onDeadlineDateChange={ui.handleDeadlineDateChange}
              onDeadlineFromDateChange={ui.handleDeadlineFromDateChange}
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

              {ui.activeTab === "periods" ? (
                <PeriodsView
                  comparisonMetrics={metrics.comparisonMetrics}
                  onChartFocusChange={chartFocusHandler}
                  siegeMode={interactiveMode}
                />
              ) : null}

              {ui.activeTab === "insights" ? (
                <InsightsView
                  insightsMetrics={metrics.insightsMetrics}
                  onChartFocusChange={chartFocusHandler}
                  siegeMode={interactiveMode}
                />
              ) : null}
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

export default DashboardShell;
