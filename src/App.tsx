import { useCallback, useRef, useState } from "react";
import BackgroundField from "@game/components/BackgroundField";
import CommandCenter from "@dashboard/components/CommandCenter";
import SettingsMenu from "@dashboard/components/SettingsMenu";
import TopNav from "@dashboard/components/TopNav";
import Tooltip from "@shared/components/Tooltip";
import {
  OverviewView,
  PeriodsView,
  StatusBanner,
} from "./features/dashboard/DashboardViews";
import {
  DashboardProvider,
  useDashboardContext,
} from "./features/dashboard/context/DashboardContext";
import SiegeHud from "@game/components/SiegeHud";
import { useSiegeGame } from "@game/hooks/useSiegeGame";
import { useSiegeZones } from "@game/hooks/useSiegeZones";
import { useWeaponEvolution } from "@game/hooks/useWeaponEvolution";
import { WEAPON_DEFS } from "@config/weaponConfig";
import { type SiegeWeaponId, type WeaponTier } from "@game/types";
import { cn } from "@shared/utils/cn";
import { triggerNamedShake } from "@game/utils/screenShake";
import { getWeaponTierTitle } from "@game/weapons/progression";

const CHROME_TRANSITION_CLASSNAME =
  "transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]";

function AppContent() {
  const dashboard = useDashboardContext();
  const {
    evolutionStates,
    onEvolution,
    syncFromEngine,
    getWeaponTier,
    resetEvolution,
  } = useWeaponEvolution();
  const siegeGame = useSiegeGame({
    currentBugCount: dashboard.currentBugCount,
    currentBugCounts: dashboard.currentBugCounts,
    evolutionStates,
    pauseTimer: dashboard.openTopMenu === "codex",
  });
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const [upgradeToast, setUpgradeToast] = useState<string | null>(null);
  const [justEvolvedWeaponId, setJustEvolvedWeaponId] =
    useState<SiegeWeaponId | null>(null);

  const showUpgradeToast = useCallback((message: string) => {
    setUpgradeToast(message);
    window.setTimeout(() => setUpgradeToast(null), 3500);
  }, []);

  const handleEvolution = useCallback(
    (weaponId: SiegeWeaponId, newTier: WeaponTier) => {
      onEvolution(weaponId, newTier);
      const def = WEAPON_DEFS.find((d) => d.id === weaponId);
      const newTitle = def ? getWeaponTierTitle(def, newTier) : weaponId;
      const weaponTitle = def?.title ?? weaponId;
      showUpgradeToast(`${weaponTitle} upgraded to ${newTitle}`);
      if (dashboardRef.current) {
        triggerNamedShake(dashboardRef.current, "tierup");
      }
      setJustEvolvedWeaponId(weaponId);
      setTimeout(() => setJustEvolvedWeaponId(null), 800);
    },
    [onEvolution, showUpgradeToast],
  );

  const siegeZones = useSiegeZones({
    active: siegeGame.interactiveMode,
    deps: [dashboard.activeTab],
    rootRef: dashboardRef,
  });

  const handleEnterInteractiveMode = useCallback(() => {
    dashboard.closeMenus();
    dashboard.setChartFocus(null);
    resetEvolution();
    siegeGame.enterInteractiveMode();
  }, [dashboard, resetEvolution, siegeGame]);

  const handleExitInteractiveMode = useCallback(() => {
    dashboard.closeMenus();
    dashboard.setChartFocus(null);
    siegeGame.exitInteractiveMode();
  }, [dashboard, siegeGame]);

  const backgroundChartFocus = siegeGame.interactiveMode
    ? dashboard.chartFocus
    : null;
  const chartFocusHandler = siegeGame.interactiveMode
    ? dashboard.handleChartFocusChange
    : undefined;
  const chromeHidden = siegeGame.interactiveMode;

  return (
    <div className="relative h-screen overflow-hidden bg-[#050608] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_26%),linear-gradient(180deg,#020304_0%,#050608_44%,#080d12_100%)]" />
      <div className="pointer-events-none absolute inset-x-[12%] top-[-18%] h-[42vh] rounded-full bg-[radial-gradient(circle,rgba(244,114,182,0.14),transparent_62%)] blur-3xl" />
      <BackgroundField
        bugCounts={siegeGame.displayedBugCounts}
        bugVisualSettings={dashboard.bugVisualSettings}
        chartFocus={backgroundChartFocus}
        className={siegeGame.interactiveMode ? "z-30" : "z-0"}
        combatStats={siegeGame.interactiveMode ? siegeGame.combatStats : null}
        gameConfig={dashboard.gameConfig}
        interactiveSessionKey={
          siegeGame.interactiveMode ? siegeGame.interactiveSessionKey : null
        }
        agentCaptures={
          siegeGame.interactiveMode ? siegeGame.agentCaptures : undefined
        }
        onAgentAbsorb={
          siegeGame.interactiveMode ? siegeGame.handleAgentAbsorb : undefined
        }
        onStructurePlace={
          siegeGame.interactiveMode
            ? (type, vx, vy, cx, cy, structureId) =>
                siegeGame.placeStructure(type, vx, vy, cx, cy, structureId)
            : undefined
        }
        onBugHit={
          siegeGame.interactiveMode ? siegeGame.handleInteractiveHit : undefined
        }
        onWeaponFired={
          siegeGame.interactiveMode ? siegeGame.handleWeaponFired : undefined
        }
        placedStructures={
          siegeGame.interactiveMode ? siegeGame.placedStructures : undefined
        }
        placingStructureId={
          siegeGame.interactiveMode ? siegeGame.placingStructureId : undefined
        }
        remainingBugCount={
          siegeGame.interactiveMode
            ? siegeGame.interactiveRemainingBugs
            : undefined
        }
        selectedWeaponId={
          siegeGame.interactiveMode ? siegeGame.selectedWeaponId : undefined
        }
        streakMultiplier={
          siegeGame.interactiveMode ? siegeGame.streakMultiplier : 1
        }
        siegeZones={siegeZones}
        interactiveMode={siegeGame.interactiveMode}
        tone={dashboard.deadlineMetrics.statusTone}
        getWeaponTier={getWeaponTier}
        onWeaponEvolutionStatesChange={syncFromEngine}
        onWeaponEvolution={handleEvolution}
        initialEvolutionStates={evolutionStates}
      />
      {siegeGame.siegePhase === "entering" ? (
        <div className="pointer-events-none fixed inset-0 z-[100] [animation:siege-flash_700ms_ease-out_forwards]" />
      ) : null}

      {siegeGame.interactiveMode ? (
        <SiegeHud
          className="pointer-events-none fixed inset-x-0 top-3 z-[220] px-3 sm:top-4"
          codexMenuRef={dashboard.codexMenuRef}
          debugMode={siegeGame.debugMode}
          elapsedMs={siegeGame.interactiveElapsedMs}
          interactiveKills={siegeGame.interactiveKills}
          interactivePoints={siegeGame.interactivePoints}
          interactiveRemainingBugs={siegeGame.interactiveRemainingBugs}
          justEvolvedWeaponId={justEvolvedWeaponId}
          killStreak={siegeGame.killStreak}
          lastFireTimes={siegeGame.lastFireTimes}
          nextWeaponUnlock={siegeGame.nextWeaponUnlock}
          onArmStructure={siegeGame.armStructure}
          onChangeGameMode={siegeGame.changeGameMode}
          onExit={handleExitInteractiveMode}
          onToggleCodex={() => dashboard.handleTopMenuToggle("codex")}
          onSelectWeapon={siegeGame.selectWeapon}
          onToggleDebugMode={siegeGame.toggleDebugMode}
          placedCountByType={siegeGame.placedCountByType}
          placingStructureId={siegeGame.placingStructureId}
          selectedWeaponId={siegeGame.selectedWeaponId}
          streakMultiplier={siegeGame.streakMultiplier}
          upgradeToast={upgradeToast}
          unlockedStructures={siegeGame.combatStats.unlockedStructures}
          weaponSnapshots={siegeGame.weaponSnapshots}
          codexOpen={dashboard.openTopMenu === "codex"}
          gameMode={siegeGame.gameMode}
        />
      ) : null}

      <div
        ref={dashboardRef}
        className={cn(
          "relative z-10 mx-auto grid w-full max-w-[1480px] content-start gap-2 px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4",
          siegeGame.interactiveMode ? "pointer-events-none select-none" : "",
        )}
        style={{
          opacity:
            siegeGame.siegePhase === "active"
              ? 0.26
              : siegeGame.siegePhase === "entering"
                ? 0.62
                : siegeGame.siegePhase === "exiting"
                  ? 0.7
                  : 1,
          filter:
            siegeGame.siegePhase === "active"
              ? "blur(2px) saturate(0.72)"
              : siegeGame.siegePhase === "entering"
                ? "blur(1px) saturate(0.82)"
                : undefined,
          transform:
            siegeGame.siegePhase === "active" ? "scale(0.985)" : undefined,
          transition:
            "opacity 420ms ease-out, filter 520ms ease-out, transform 520ms ease-out",
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
              {dashboard.headerEyebrow}
            </p>
            <h1 className="mt-1.5 font-display text-3xl leading-[0.92] tracking-[-0.06em] text-stone-50 sm:text-[2.65rem] xl:text-[3.25rem]">
              Race to Zero Bugs
            </h1>
            <p className="mt-2 max-w-2xl text-[0.82rem] leading-5 text-stone-400 sm:text-sm">
              {dashboard.headerSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-start justify-end gap-2 self-start">
            <SettingsMenu
              containerRef={dashboard.settingsMenuRef}
              onMenuToggle={() => dashboard.handleTopMenuToggle("settings")}
              onToggle={dashboard.handleToggleSetting}
              open={
                !siegeGame.interactiveMode &&
                dashboard.openTopMenu === "settings"
              }
              settings={dashboard.settings}
            />
            {!siegeGame.interactiveMode ? (
              <Tooltip content="Start the interactive bug game.">
                <button
                  aria-label="Start interactive bug game"
                  className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                  onClick={handleEnterInteractiveMode}
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
            activeTab={dashboard.activeTab}
            compareRangeKey={dashboard.compareRangeKey}
            customFromDate={dashboard.customFromDate}
            customToDate={dashboard.customToDate}
            deadlineDate={dashboard.deadlineDate}
            deadlineFromDate={dashboard.deadlineFromDate}
            onCompareRangeChange={dashboard.handleCompareRangeChange}
            onCustomFromDateChange={dashboard.handleCustomFromDateChange}
            onCustomToDateChange={dashboard.handleCustomToDateChange}
            onDeadlineDateChange={dashboard.handleDeadlineDateChange}
            onDeadlineFromDateChange={dashboard.handleDeadlineFromDateChange}
            onInteract={dashboard.handleTopNavInteract}
            onTabChange={dashboard.handleTabChange}
            todayDate={dashboard.todayDate}
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
            activeTab={dashboard.activeTab}
            comparisonMetrics={dashboard.comparisonMetrics}
            deadlineMetrics={dashboard.deadlineMetrics}
            siegeMode={siegeGame.interactiveMode}
            summary={dashboard.summary}
          />
        </div>

        <main className="grid content-start gap-2 self-start">
          <div>
            {dashboard.activeTab === "overview" ? (
              <OverviewView
                deadlineMetrics={dashboard.deadlineMetrics}
                onChartFocusChange={chartFocusHandler}
                siegeMode={siegeGame.interactiveMode}
                summary={dashboard.summary}
                workdaySettings={dashboard.workdaySettings}
              />
            ) : null}

            {dashboard.activeTab === "periods" ? (
              <PeriodsView
                comparisonMetrics={dashboard.comparisonMetrics}
                onChartFocusChange={chartFocusHandler}
                siegeMode={siegeGame.interactiveMode}
              />
            ) : null}
          </div>

          {dashboard.error ? (
            <StatusBanner kind="error">{dashboard.error}</StatusBanner>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <AppContent />
    </DashboardProvider>
  );
}
