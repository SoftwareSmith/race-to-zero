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
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { WEAPON_DEFS } from "@config/weaponConfig";
import BackgroundField from "@game/components/BackgroundField";
import SiegeHud from "@game/components/SiegeHud";
import { useSiegeGame } from "@game/hooks/useSiegeGame";
import { useSiegeZones } from "@game/hooks/useSiegeZones";
import { useWeaponEvolution } from "@game/hooks/useWeaponEvolution";
import type {
  SiegePhase,
  SiegeWeaponId,
  StructureId,
  WeaponTier,
} from "@game/types";
import { triggerNamedShake } from "@game/utils/screenShake";
import { getWeaponTierTitle } from "@game/weapons/progression";

interface SiegeExperienceProps {
  dashboardRef: RefObject<HTMLDivElement | null>;
  onShellStateChange: (state: {
    interactiveMode: boolean;
    siegePhase: SiegePhase;
  }) => void;
  startRequestId: number;
}

const SiegeExperience = memo(function SiegeExperience({
  dashboardRef,
  onShellStateChange,
  startRequestId,
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

  const getProgressionLabel = useCallback((tier: WeaponTier) => {
    return tier === 3 ? "Overdrive" : `Tier ${tier}`;
  }, []);

  const handleStructureTierUp = useCallback(
    ({
      structureType,
      tier,
    }: {
      structureId: string;
      structureType: StructureId;
      tier: WeaponTier;
    }) => {
      const structureTitle =
        STRUCTURE_DEFS.find((structure) => structure.id === structureType)
          ?.title ?? structureType;
      showUpgradeToast(
        `${structureTitle} upgraded to ${getProgressionLabel(tier)}`,
      );
      if (dashboardRef.current) {
        triggerNamedShake(dashboardRef.current, "tierup");
      }
    },
    [dashboardRef, getProgressionLabel, showUpgradeToast],
  );

  const siegeGame = useSiegeGame({
    currentBugCount: metrics.currentBugCount,
    currentBugCounts: metrics.currentBugCounts,
    evolutionStates,
    onStructureTierUp: handleStructureTierUp,
    pauseTimer: ui.openTopMenu === "codex",
  });

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

  const backgroundChartFocus = siegeGame.interactiveMode ? ui.chartFocus : null;

  return (
    <>
      <BackgroundField
        agentCaptures={
          siegeGame.interactiveMode ? siegeGame.agentCaptures : undefined
        }
        bugCounts={siegeGame.displayedBugCounts}
        bugVisualSettings={settings.bugVisualSettings}
        chartFocus={backgroundChartFocus}
        className={siegeGame.interactiveMode ? "z-30" : "z-0"}
        combatStats={siegeGame.interactiveMode ? siegeGame.combatStats : null}
        gameConfig={settings.gameConfig}
        getWeaponTier={getWeaponTier}
        initialEvolutionStates={evolutionStates}
        interactiveMode={siegeGame.interactiveMode}
        interactiveSessionKey={
          siegeGame.interactiveMode ? siegeGame.interactiveSessionKey : null
        }
        onAgentAbsorb={
          siegeGame.interactiveMode ? siegeGame.handleAgentAbsorb : undefined
        }
        onBugHit={
          siegeGame.interactiveMode ? siegeGame.handleInteractiveHit : undefined
        }
        onStructureKill={
          siegeGame.interactiveMode ? siegeGame.handleStructureKill : undefined
        }
        onStructurePlace={
          siegeGame.interactiveMode
            ? (type, vx, vy, cx, cy, structureId) =>
                siegeGame.placeStructure(type, vx, vy, cx, cy, structureId)
            : undefined
        }
        onWeaponEvolution={handleEvolution}
        onWeaponEvolutionStatesChange={syncFromEngine}
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
        siegeZones={siegeZones}
        streakMultiplier={
          siegeGame.interactiveMode ? siegeGame.streakMultiplier : 1
        }
        tone={metrics.deadlineMetrics.statusTone}
      />
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
          onArmStructure={siegeGame.armStructure}
          onChangeGameMode={siegeGame.changeGameMode}
          onExit={handleExitInteractiveMode}
          onSelectWeapon={siegeGame.selectWeapon}
          onToggleCodex={() => ui.handleTopMenuToggle("codex")}
          onToggleDebugMode={siegeGame.toggleDebugMode}
          placedCountByType={siegeGame.placedCountByType}
          placingStructureId={siegeGame.placingStructureId}
          selectedWeaponId={siegeGame.selectedWeaponId}
          streakMultiplier={siegeGame.streakMultiplier}
          unlockedStructures={siegeGame.combatStats.unlockedStructures}
          upgradeToast={upgradeToast}
          weaponSnapshots={siegeGame.weaponSnapshots}
        />
      ) : null}
    </>
  );
});

export default SiegeExperience;
