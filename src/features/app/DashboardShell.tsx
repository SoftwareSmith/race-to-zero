import { memo, useEffect, useRef, useState, type RefObject } from "react";
import CommandCenter from "@dashboard/components/CommandCenter";
import SettingsMenu from "@dashboard/components/SettingsMenu";
import TopNav from "@dashboard/components/TopNav";
import {
  useDashboardMetrics,
  useDashboardSettings,
  useDashboardUi,
} from "@dashboard/context/DashboardContext";
import {
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
  const [bugFieldMenuOpen, setBugFieldMenuOpen] = useState(false);

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
      ref={dashboardRef}
      className={cn(
        "relative z-10 mx-auto grid w-full max-w-[1480px] content-start gap-2 px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4",
        interactiveMode ? "pointer-events-none select-none" : "",
      )}
      style={{
        opacity:
          siegePhase === "active"
            ? 0.26
            : siegePhase === "entering"
              ? 0.62
              : siegePhase === "exiting"
                ? 0.7
                : 1,
        filter:
          siegePhase === "active"
            ? "blur(2px) saturate(0.72)"
            : siegePhase === "entering"
              ? "blur(1px) saturate(0.82)"
              : undefined,
        transform: siegePhase === "active" ? "scale(0.985)" : undefined,
        transition:
          "opacity 260ms ease-out, filter 340ms ease-out, transform 340ms ease-out",
      }}
    >
      <header
        className={cn(
          "relative z-20 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3",
          CHROME_TRANSITION_CLASSNAME,
          chromeHidden
            ? "-translate-y-5 opacity-0 blur-sm"
            : "translate-y-0 opacity-100 blur-0",
        )}
      >
        <div className="min-w-0 max-w-4xl">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
            {metrics.headerEyebrow}
          </p>
          <h1 className="mt-1.5 font-display text-3xl leading-[0.92] tracking-[-0.06em] text-stone-50 sm:text-[2.65rem] xl:text-[3.25rem]">
            Race to Zero Bugs
          </h1>
          <p className="mt-2 max-w-2xl text-[0.82rem] leading-5 text-stone-400 sm:text-sm">
            {metrics.headerSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-2 self-start">
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
              <MenuPanel title="Bug Field">
                <ToggleField
                  checked={settings.showBugParticleCount}
                  description="Show the rendered bug particle count overlay on the dashboard background."
                  label="Show bug particle count"
                  onChange={settings.toggleShowBugParticleCount}
                />
              </MenuPanel>
            ) : null}
          </div>
          {!interactiveMode ? (
            <Tooltip content="Start the interactive bug game.">
              <button
                aria-label="Open interactive bug game"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                onClick={onEnterInteractiveMode}
                onFocus={onPrefetchSiege}
                onMouseEnter={onPrefetchSiege}
                type="button"
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
          ) : null}
        </div>
      </header>

      <div
        className={cn(
          "relative z-10 mt-2 rounded-[24px] px-2 py-1.5 sm:mt-3 sm:px-3 sm:py-2",
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
          siegeMode={interactiveMode}
          summary={metrics.summary}
        />
      </div>

      <main className="grid content-start gap-2 self-start">
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
        </div>

        {metrics.error ? (
          <StatusBanner kind="error">{metrics.error}</StatusBanner>
        ) : null}
      </main>
    </div>
  );
});

export default DashboardShell;
