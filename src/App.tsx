import { useCallback, useRef, useState } from "react";
import BackgroundField from "@game/components/BackgroundField";
import BugSettingsMenu from "@dashboard/components/BugSettingsMenu";
import CodexPanel from "@game/components/CodexPanel";
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
import type { SiegeWeaponId, WeaponTier } from "@game/types";
import { cn } from "@shared/utils/cn";

function AppContent() {
  const dashboard = useDashboardContext();
  const siegeGame = useSiegeGame({
    currentBugCount: dashboard.currentBugCount,
    currentBugCounts: dashboard.currentBugCounts,
  });
  const { evolutionStates, onEvolution, getWeaponTier } = useWeaponEvolution();
  const [evolutionToast, setEvolutionToast] = useState<string | null>(null);
  const [justEvolvedWeaponId, setJustEvolvedWeaponId] =
    useState<SiegeWeaponId | null>(null);

  const handleEvolution = useCallback(
    (weaponId: SiegeWeaponId, newTier: WeaponTier) => {
      onEvolution(weaponId, newTier);
      const def = WEAPON_DEFS.find((d) => d.id === weaponId);
      const prevTitle = def?.tierTitles?.[newTier - 2] ?? weaponId;
      const newTitle = def?.tierTitles?.[newTier - 1] ?? weaponId;
      setEvolutionToast(`${prevTitle} → ${newTitle}`);
      setTimeout(() => setEvolutionToast(null), 3500);
      setJustEvolvedWeaponId(weaponId);
      setTimeout(() => setJustEvolvedWeaponId(null), 800);
    },
    [onEvolution],
  );
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  const siegeZones = useSiegeZones({
    active: siegeGame.interactiveMode,
    deps: [dashboard.activeTab],
    rootRef: dashboardRef,
  });

  const handleEnterInteractiveMode = useCallback(() => {
    dashboard.closeMenus();
    dashboard.setChartFocus(null);
    siegeGame.enterInteractiveMode();
  }, [dashboard, siegeGame]);

  const handleExitInteractiveMode = useCallback(() => {
    dashboard.closeMenus();
    dashboard.setChartFocus(null);
    siegeGame.exitInteractiveMode();
  }, [dashboard, siegeGame]);

  const headerModeEyebrow = siegeGame.interactiveMode
    ? "Dashboard under siege"
    : dashboard.headerEyebrow;
  const headerModeSubtitle = siegeGame.interactiveMode
    ? "Panels are frozen into the battlefield. Bugs now reclaim cards, charts, and surfaces directly."
    : dashboard.headerSubtitle;
  const backgroundChartFocus = siegeGame.interactiveMode
    ? dashboard.chartFocus
    : null;
  const chartFocusHandler = siegeGame.interactiveMode
    ? dashboard.handleChartFocusChange
    : undefined;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608]">
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
        onTerminatorHit={
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
        showParticleCount={
          siegeGame.interactiveMode ? false : dashboard.showParticleCount
        }
        showTerminatorStatusBadge={!siegeGame.interactiveMode}
        siegeZones={siegeZones}
        terminatorMode={siegeGame.interactiveMode || dashboard.terminatorMode}
        tone={dashboard.deadlineMetrics.statusTone}
        getWeaponTier={getWeaponTier}
        onWeaponEvolution={handleEvolution}
        initialEvolutionStates={evolutionStates}
      />
      {siegeGame.siegePhase === "entering" ? (
        <div className="pointer-events-none fixed inset-0 z-[100] [animation:siege-flash_700ms_ease-out_forwards]" />
      ) : null}

      {/* Evolution toast: fires briefly when a weapon upgrades tier */}
      {evolutionToast && siegeGame.interactiveMode ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-10 left-1/2 z-[150] -translate-x-1/2 [animation:evolve-toast_3.5s_ease-out_forwards]"
        >
          <div className="rounded-2xl border border-amber-300/30 bg-zinc-950/90 px-5 py-2.5 text-sm font-semibold text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.2)] backdrop-blur-md">
            ⚡ {evolutionToast}
          </div>
        </div>
      ) : null}

      <div
        ref={dashboardRef}
        className={cn(
          "relative z-10 mx-auto flex min-h-screen w-full max-w-[1380px] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10",
          siegeGame.interactiveMode ? "pointer-events-none select-none" : "",
        )}
        style={{
          opacity:
            siegeGame.siegePhase === "active"
              ? 0.86
              : siegeGame.siegePhase === "entering"
                ? 0.94
                : siegeGame.siegePhase === "exiting"
                  ? 0.96
                  : 1,
          transition: "opacity 320ms ease-out",
        }}
      >
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
              {headerModeEyebrow}
            </p>
            <h1 className="mt-2 font-display text-4xl leading-[0.94] tracking-[-0.06em] text-stone-50 sm:text-5xl xl:text-6xl">
              Race to Zero Bugs
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400 sm:text-base">
              {headerModeSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto">
            {siegeGame.interactiveMode ? (
              <SiegeHud
                className="pointer-events-auto w-[min(18rem,calc(100vw-1.5rem))]"
                debugMode={siegeGame.debugMode}
                interactiveKills={siegeGame.interactiveKills}
                interactivePoints={siegeGame.interactivePoints}
                interactiveRemainingBugs={siegeGame.interactiveRemainingBugs}
                onArmStructure={siegeGame.armStructure}
                onExit={handleExitInteractiveMode}
                onSelectWeapon={siegeGame.selectWeapon}
                onToggleDebugMode={siegeGame.toggleDebugMode}
                placedCountByType={siegeGame.placedCountByType}
                placingStructureId={siegeGame.placingStructureId}
                selectedWeaponId={siegeGame.selectedWeaponId}
                lastFireTimes={siegeGame.lastFireTimes}
                justEvolvedWeaponId={justEvolvedWeaponId}
                unlockedStructures={siegeGame.combatStats.unlockedStructures}
                weaponSnapshots={siegeGame.weaponSnapshots}
              />
            ) : (
              <>
                <SettingsMenu
                  containerRef={dashboard.settingsMenuRef}
                  onMenuToggle={() => dashboard.handleTopMenuToggle("settings")}
                  onToggle={dashboard.handleToggleSetting}
                  open={dashboard.openTopMenu === "settings"}
                  settings={dashboard.settings}
                />
                <Tooltip content="Arm siege mode and start clearing bugs directly off the dashboard.">
                  <button
                    aria-label="Open interactive bug game"
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
                <BugSettingsMenu
                  bugVisualSettings={dashboard.bugVisualSettings}
                  containerRef={dashboard.bugSettingsMenuRef}
                  onChange={dashboard.handleBugVisualSetting}
                  onMenuToggle={() => dashboard.handleTopMenuToggle("bugs")}
                  onToggle={dashboard.handleToggleSetting}
                  open={dashboard.openTopMenu === "bugs"}
                  showParticleCount={dashboard.showParticleCount}
                  terminatorMode={dashboard.terminatorMode}
                />
                <CodexPanel
                  containerRef={dashboard.codexMenuRef}
                  onMenuToggle={() => dashboard.handleTopMenuToggle("codex")}
                  open={dashboard.openTopMenu === "codex"}
                />
              </>
            )}
          </div>
        </header>

        <div
          className={cn(
            siegeGame.interactiveMode
              ? "relative overflow-hidden rounded-[24px] border border-red-500/16 bg-black/18 p-2 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(248,113,113,0.08),transparent_34%,rgba(15,23,42,0.18))] before:content-['']"
              : "",
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

        <CommandCenter
          deadlineMetrics={dashboard.deadlineMetrics}
          siegeMode={siegeGame.interactiveMode}
          summary={dashboard.summary}
        />

        <main className="grid gap-8 pb-10">
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
