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
import type { Engine } from "@game/engine/Engine";
import { preloadVfxEngine } from "@game/components/VfxCanvas";
import { DashboardProvider } from "./features/dashboard/context/DashboardContext";

const loadDashboardShell = () => import("./features/app/DashboardShell");
const loadSiegeExperience = () => import("./features/app/SiegeExperience");
const loadWeaponEffectLayer = () => import("@game/components/WeaponEffectLayer");
const DashboardShell = lazy(loadDashboardShell);
const SiegeExperience = lazy(loadSiegeExperience);
const AmbientBackgroundHarness = lazy(
  () => import("./features/app/AmbientBackgroundHarness"),
);

function AppContent() {
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
  const [transitionSwarm, setTransitionSwarm] = useState<Engine | null>(null);
  const [ambientSuspended, setAmbientSuspended] = useState(false);
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

  const handleEnterInteractiveMode = useCallback(() => {
    prefetchSiege();
    void preloadVfxEngine();
    const liveSwarm = ambientFieldRef.current?.detachTransitionSwarm() ?? null;
    setTransitionSwarm(liveSwarm);
    setTransitionSnapshot(
      liveSwarm
        ? null
        : ambientFieldRef.current?.captureTransitionSnapshot() ?? null,
    );
    setAmbientSuspended(true);
    startTransition(() => {
      setSiegeMounted(true);
      setStartRequestId((value) => value + 1);
    });
  }, [prefetchSiege]);

  const handleShellStateChange = useCallback(
    (state: { interactiveMode: boolean; siegePhase: SiegePhase }) => {
      setShellState((currentState) => {
        if (
          currentState.siegePhase !== "idle" &&
          state.siegePhase === "idle"
        ) {
          setAmbientSuspended(false);
          setTransitionSnapshot(null);
          setTransitionSwarm(null);
        }

        return state;
      });
    },
    [],
  );

  const shouldRenderDashboard = shellState.siegePhase === "idle";

  return (
    <div className="relative h-screen overflow-hidden bg-[#050608] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_26%),linear-gradient(180deg,#020304_0%,#050608_44%,#080d12_100%)]" />
      <div className="pointer-events-none absolute inset-x-[12%] top-[-18%] h-[42vh] rounded-full bg-[radial-gradient(circle,rgba(244,114,182,0.14),transparent_62%)] blur-3xl" />
      {!ambientSuspended ? (
        <div className="pointer-events-none absolute inset-0 opacity-100 transition-opacity duration-300 ease-out">
          <Suspense fallback={null}>
            <AmbientBackgroundHarness
              ref={ambientFieldRef}
              fullDensity={ambientPerfMode}
            />
          </Suspense>
        </div>
      ) : null}
      {siegeMounted ? (
        <Suspense fallback={null}>
          <SiegeExperience
            dashboardRef={dashboardRef}
            onShellStateChange={handleShellStateChange}
            startRequestId={startRequestId}
            transitionSnapshot={stableTransitionSnapshot}
            transitionSwarm={transitionSwarm}
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
    <DashboardProvider>
      <AppContent />
    </DashboardProvider>
  );
}
