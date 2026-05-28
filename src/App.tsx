import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SiegePhase } from "@game/types";
import type {
  BackgroundFieldHandle,
  BugTransitionSnapshotItem,
} from "@game/components/BackgroundField/types";
import { preloadVfxEngine } from "@game/components/vfxEngineLoader";
import { DashboardBootstrapProvider } from "./features/dashboard/context/DashboardBootstrapContext";
import { useDashboardBootstrapSettings } from "@dashboard/context/DashboardBootstrapContext";

const loadDashboardShell = () => import("./features/app/DashboardShell");
const loadSiegeExperience = () => import("./features/app/SiegeExperience");
const loadWeaponEffectLayer = () =>
  import("@game/components/WeaponEffectLayer");
const DashboardShell = lazy(loadDashboardShell);
const SiegeExperience = lazy(loadSiegeExperience);
const AmbientBackgroundHarness = lazy(
  () => import("./features/app/AmbientBackgroundHarness"),
);

function AppContent() {
  const dashboardSettings = useDashboardBootstrapSettings();
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const ambientFieldRef = useRef<BackgroundFieldHandle | null>(null);
  const [siegeMounted, setSiegeMounted] = useState(false);
  const [ambientPerfMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      new URLSearchParams(window.location.search).get("ambientPerf") === "1"
    );
  });
  const [startRequestId, setStartRequestId] = useState(0);
  const [transitionSnapshot, setTransitionSnapshot] = useState<
    BugTransitionSnapshotItem[] | null
  >(null);
  const [ambientSuspended, setAmbientSuspended] = useState(false);
  const [slowAmbientReveal, setSlowAmbientReveal] = useState(false);
  const transitionSwarmConsumedRef = useRef(false);
  const [shellState, setShellState] = useState<{
    interactiveMode: boolean;
    siegePhase: SiegePhase;
  }>({
    interactiveMode: false,
    siegePhase: "idle",
  });
  const stableTransitionSnapshot = useMemo(
    () => transitionSnapshot,
    [transitionSnapshot],
  );

  const prefetchSiege = useCallback(() => {
    void loadSiegeExperience();
    void loadWeaponEffectLayer();
  }, []);

  const consumeTransitionSwarm = useCallback(() => {
    if (transitionSwarmConsumedRef.current) {
      return null;
    }

    transitionSwarmConsumedRef.current = true;
    setAmbientSuspended(true);
    return ambientFieldRef.current?.detachTransitionSwarm() ?? null;
  }, []);

  const handleEnterInteractiveMode = useCallback(() => {
    prefetchSiege();
    void preloadVfxEngine();
    transitionSwarmConsumedRef.current = false;
    setSlowAmbientReveal(false);
    setTransitionSnapshot(
      ambientFieldRef.current?.captureTransitionSnapshot() ?? null,
    );
    setAmbientSuspended(false);
    startTransition(() => {
      setSiegeMounted(true);
      setStartRequestId((value) => value + 1);
    });
  }, [prefetchSiege]);

  const handleShellStateChange = useCallback(
    (state: { interactiveMode: boolean; siegePhase: SiegePhase }) => {
      setShellState((currentState) => {
        if (currentState.siegePhase !== "idle" && state.siegePhase === "idle") {
          transitionSwarmConsumedRef.current = false;
          setSlowAmbientReveal(true);
          setAmbientSuspended(false);
          setTransitionSnapshot(null);
        }

        return state;
      });
    },
    [],
  );

  const shouldRenderDashboard = shellState.siegePhase === "idle";
  const shouldRenderAmbient =
    dashboardSettings.showAmbientBugs &&
    (!ambientSuspended || shellState.siegePhase === "exiting");
  const shouldRevealAmbient =
    dashboardSettings.showAmbientBugs && !ambientSuspended;

  return (
    <div className="relative h-screen overflow-hidden bg-[#050608] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_26%),linear-gradient(180deg,#020304_0%,#050608_44%,#080d12_100%)]" />
      <div className="pointer-events-none absolute inset-x-[12%] top-[-18%] h-[42vh] rounded-full bg-[radial-gradient(circle,rgba(244,114,182,0.14),transparent_62%)] blur-3xl" />
      {shouldRenderAmbient ? (
        <div className="pointer-events-none absolute inset-0 opacity-100 transition-opacity duration-300 ease-out">
          <Suspense fallback={null}>
            <AmbientBackgroundHarness
              ref={ambientFieldRef}
              fullDensity={ambientPerfMode}
              revealAmbient={shouldRevealAmbient}
              slowReveal={slowAmbientReveal}
            />
          </Suspense>
        </div>
      ) : null}
      {siegeMounted ? (
        <Suspense fallback={null}>
          <SiegeExperience
            consumeTransitionSwarm={consumeTransitionSwarm}
            dashboardRef={dashboardRef}
            onShellStateChange={handleShellStateChange}
            startRequestId={startRequestId}
            transitionSnapshot={stableTransitionSnapshot}
          />
        </Suspense>
      ) : null}
      {shouldRenderDashboard ? (
        <Suspense fallback={null}>
          <DashboardShell
            dashboardRef={dashboardRef}
            interactiveMode={shellState.interactiveMode}
            onEnterInteractiveMode={handleEnterInteractiveMode}
            onPrefetchSiege={prefetchSiege}
            siegePhase={shellState.siegePhase}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <DashboardBootstrapProvider>
      <AppContent />
    </DashboardBootstrapProvider>
  );
}
