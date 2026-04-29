import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  useDashboardMetrics,
  useDashboardSettings,
  useDashboardUi,
} from "@dashboard/context/DashboardContext";
import { WEAPON_DEFS } from "@config/weaponConfig";
import BackgroundField from "@game/components/BackgroundField";
import SiegeHud from "@game/components/SiegeHud";
import SiegeRunCompleteOverlay from "@game/components/SiegeRunCompleteOverlay";
import { useSiegeGame } from "@game/hooks/useSiegeGame";
import { useSiegeZones } from "@game/hooks/useSiegeZones";
import { useWeaponEvolution } from "@game/hooks/useWeaponEvolution";
import type { SiegePhase, SiegeWeaponId, WeaponTier } from "@game/types";
import { triggerNamedShake } from "@game/utils/screenShake";
import { getWeaponTierTitle } from "@game/weapons/progression";
import type { BugTransitionSnapshotItem } from "@game/components/BackgroundField/types";

interface SiegeExperienceProps {
  dashboardRef: RefObject<HTMLDivElement | null>;
  onShellStateChange: (state: {
    interactiveMode: boolean;
    siegePhase: SiegePhase;
  }) => void;
  startRequestId: number;
  transitionSnapshot?: BugTransitionSnapshotItem[] | null;
}

const SiegeExperience = memo(function SiegeExperience({
  dashboardRef,
  onShellStateChange,
  startRequestId,
  transitionSnapshot = null,
}: SiegeExperienceProps) {
  const metrics = useDashboardMetrics();
  const settings = useDashboardSettings();
  const ui = useDashboardUi();
  const {
    evolutionStates,
    onEvolution,
    syncFromEngine,
    getWeaponTier,
    resetEvolution,
  } = useWeaponEvolution();
  const [upgradeToast, setUpgradeToast] = useState<string | null>(null);
  const [justEvolvedWeaponId, setJustEvolvedWeaponId] =
    useState<SiegeWeaponId | null>(null);
  const lastStartRequestIdRef = useRef(0);

  const showUpgradeToast = useCallback((message: string) => {
    setUpgradeToast(message);
    window.setTimeout(() => setUpgradeToast(null), 3500);
  }, []);

  const handleSiegeEscape = useCallback(() => {
    if (ui.openTopMenu === "codex") {
      ui.closeMenus();
      return true;
    }

    return false;
  }, [ui]);

  const siegeGame = useSiegeGame({
    currentBugCount: metrics.currentBugCount,
    currentBugCounts: metrics.currentBugCounts,
    evolutionStates,
    onEscape: handleSiegeEscape,
    pauseTimer: ui.openTopMenu === "codex",
  });
  const getActiveWeaponTier = useCallback(
    (weaponId: SiegeWeaponId): WeaponTier =>
      Math.min(getWeaponTier(weaponId), siegeGame.maxWeaponTier) as WeaponTier,
    [getWeaponTier, siegeGame.maxWeaponTier],
  );

  const handleEvolution = useCallback(
    (weaponId: SiegeWeaponId, newTier: WeaponTier) => {
      onEvolution(weaponId, newTier);
      const def = WEAPON_DEFS.find((weapon) => weapon.id === weaponId);
      const newTitle = def ? getWeaponTierTitle(def, newTier) : weaponId;
      const weaponTitle = def?.title ?? weaponId;
      showUpgradeToast(`${weaponTitle} upgraded to ${newTitle}`);
      if (dashboardRef.current) {
        triggerNamedShake(dashboardRef.current, "tierup");
      }
      setJustEvolvedWeaponId(weaponId);
      window.setTimeout(() => setJustEvolvedWeaponId(null), 800);
    },
    [dashboardRef, onEvolution, showUpgradeToast],
  );

  const siegeZones = useSiegeZones({
    active: siegeGame.interactiveMode,
    deps: [ui.activeTab],
    rootRef: dashboardRef,
  });

  useEffect(() => {
    onShellStateChange({
      interactiveMode: siegeGame.interactiveMode,
      siegePhase: siegeGame.siegePhase,
    });
  }, [onShellStateChange, siegeGame.interactiveMode, siegeGame.siegePhase]);

  useEffect(() => {
    if (
      startRequestId === 0 ||
      startRequestId === lastStartRequestIdRef.current
    ) {
      return;
    }

    lastStartRequestIdRef.current = startRequestId;
    ui.closeMenus();
    ui.setChartFocus(null);
    resetEvolution();
    siegeGame.enterInteractiveMode();
  }, [resetEvolution, siegeGame, startRequestId, ui]);

  const handleExitInteractiveMode = useCallback(() => {
    ui.closeMenus();
    ui.setChartFocus(null);
    siegeGame.exitInteractiveMode();
  }, [siegeGame, ui]);

  const handleReplayMode = useCallback(() => {
    ui.closeMenus();
    ui.setChartFocus(null);
    resetEvolution();
    siegeGame.enterInteractiveMode(siegeGame.gameMode, {
      baseBugCounts: siegeGame.interactiveInitialBugCounts,
    });
  }, [resetEvolution, siegeGame, ui]);

  const handleSwitchMode = useCallback(() => {
    ui.closeMenus();
    ui.setChartFocus(null);
    resetEvolution();
    siegeGame.enterInteractiveMode(
      siegeGame.gameMode === "purge" ? "outbreak" : "purge",
      { baseBugCounts: siegeGame.interactiveInitialBugCounts },
    );
  }, [resetEvolution, siegeGame, ui]);

  const handleChangeGameMode = useCallback(
    (mode: typeof siegeGame.gameMode) => {
      if (mode === siegeGame.gameMode) {
        return;
      }

      ui.closeMenus();
      ui.setChartFocus(null);
      resetEvolution();
      siegeGame.enterInteractiveMode(mode, {
        baseBugCounts: siegeGame.interactiveInitialBugCounts,
      });
    },
    [resetEvolution, siegeGame, ui],
  );

  const backgroundChartFocus = siegeGame.interactiveMode ? ui.chartFocus : null;
  const shouldRenderSiegeField = siegeGame.siegePhase !== "idle";

  return (
    <>
      {shouldRenderSiegeField ? (
        <BackgroundField
          bugCounts={siegeGame.displayedBugCounts}
          bugVisualSettings={settings.bugVisualSettings}
          chartFocus={backgroundChartFocus}
          className={siegeGame.interactiveMode ? "z-30" : "z-0"}
          combatStats={siegeGame.interactiveMode ? siegeGame.combatStats : null}
          gameMode={siegeGame.gameMode}
          gameConfig={settings.gameConfig}
          getWeaponTier={getActiveWeaponTier}
          initialEvolutionStates={evolutionStates}
          interactiveMode={siegeGame.interactiveMode}
          interactiveSessionKey={
            siegeGame.interactiveMode ? siegeGame.interactiveSessionKey : null
          }
          onBugHit={
            siegeGame.interactiveMode
              ? siegeGame.handleInteractiveHit
              : undefined
          }
          clearSwarmRequestId={
            siegeGame.interactiveMode ? siegeGame.clearSwarmRequestId : 0
          }
          onLiveBugCountChange={
            siegeGame.interactiveMode ? siegeGame.syncRemainingBugs : undefined
          }
          onWeaponEvolution={handleEvolution}
          onWeaponEvolutionStatesChange={syncFromEngine}
          maxWeaponTier={siegeGame.maxWeaponTier}
          runtimeSpeedMultiplier={
            siegeGame.interactiveMode
              ? siegeGame.survivalStatus.runtimeSpeedMultiplier
              : 1
          }
          onWeaponFired={
            siegeGame.interactiveMode ? siegeGame.handleWeaponFired : undefined
          }
          remainingBugCount={
            siegeGame.interactiveMode
              ? siegeGame.interactiveRemainingBugs
              : undefined
          }
          selectedWeaponId={
            siegeGame.interactiveMode ? siegeGame.selectedWeaponId : undefined
          }
          siegeZones={siegeZones}
          streakMultiplier={
            siegeGame.interactiveMode ? siegeGame.streakMultiplier : 1
          }
          survivalSpawnPlan={
            siegeGame.interactiveMode ? siegeGame.survivalSpawnPlan : null
          }
          tone={metrics.deadlineMetrics.statusTone}
          transitionSnapshot={transitionSnapshot}
        />
      ) : null}
      {siegeGame.siegePhase === "entering" ? (
        <div className="pointer-events-none fixed inset-0 z-[100] [animation:siege-flash_520ms_ease-out_forwards]" />
      ) : null}

      {siegeGame.interactiveMode ? (
        <SiegeHud
          className="z-[220]"
          codexMenuRef={ui.codexMenuRef}
          codexOpen={ui.openTopMenu === "codex"}
          debugMode={siegeGame.debugMode}
          elapsedMs={siegeGame.interactiveElapsedMs}
          gameMode={siegeGame.gameMode}
          interactiveKills={siegeGame.interactiveKills}
          interactivePoints={siegeGame.interactivePoints}
          interactiveRemainingBugs={siegeGame.interactiveRemainingBugs}
          justEvolvedWeaponId={justEvolvedWeaponId}
          killStreak={siegeGame.killStreak}
          lastFireTimes={siegeGame.lastFireTimes}
          nextWeaponUnlock={siegeGame.nextWeaponUnlock}
          onChangeGameMode={handleChangeGameMode}
          onExit={handleExitInteractiveMode}
          onKillAllBugs={siegeGame.killAllBugs}
          onSelectWeapon={siegeGame.selectWeapon}
          onToggleCodex={() => ui.handleTopMenuToggle("codex")}
          onToggleDebugMode={siegeGame.toggleDebugMode}
          selectedWeaponId={siegeGame.selectedWeaponId}
          streakMultiplier={siegeGame.streakMultiplier}
          survivalStatus={siegeGame.survivalStatus}
          upgradeToast={upgradeToast}
          weaponSnapshots={siegeGame.weaponSnapshots}
        />
      ) : null}

      {siegeGame.interactiveMode && siegeGame.completionSummary ? (
        <SiegeRunCompleteOverlay
          completionSummary={siegeGame.completionSummary}
          leaderboard={siegeGame.leaderboard}
          onExit={handleExitInteractiveMode}
          onReplayMode={handleReplayMode}
          onSwitchMode={handleSwitchMode}
        />
      ) : null}
    </>
  );
});

export default SiegeExperience;
