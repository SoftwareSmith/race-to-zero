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
import { preloadVfxEngine } from "@game/components/VfxCanvas";
import DashboardShell from "./features/app/DashboardShell";
import { DashboardProvider } from "./features/dashboard/context/DashboardContext";

const loadSiegeExperience = () => import("./features/app/SiegeExperience");
const loadWeaponEffectLayer = () => import("@game/components/WeaponEffectLayer");
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
  const [shellState, setShellState] = useState<{
    interactiveMode: boolean;
    siegePhase: SiegePhase;
  }>({
    interactiveMode: false,
    siegePhase: "idle",
  });
  const shouldRenderDashboard = shellState.siegePhase !== "active";
  const stableTransitionSnapshot = useMemo(
    () => transitionSnapshot,
    [transitionSnapshot],
  );

  const prefetchSiege = useCallback(() => {
    void loadSiegeExperience();
    void loadWeaponEffectLayer();
    void preloadVfxEngine();
  }, []);

  const handleEnterInteractiveMode = useCallback(() => {
    prefetchSiege();
    setTransitionSnapshot(
      ambientFieldRef.current?.captureTransitionSnapshot() ?? null,
    );
    startTransition(() => {
      setSiegeMounted(true);
      setStartRequestId((value) => value + 1);
    });
  }, [prefetchSiege]);

  return (
    <div className="relative h-screen overflow-hidden bg-[#050608] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_26%),linear-gradient(180deg,#020304_0%,#050608_44%,#080d12_100%)]" />
      <div className="pointer-events-none absolute inset-x-[12%] top-[-18%] h-[42vh] rounded-full bg-[radial-gradient(circle,rgba(244,114,182,0.14),transparent_62%)] blur-3xl" />
      <div
        className={
          shellState.siegePhase === "active"
            ? "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out"
            : "pointer-events-none absolute inset-0 opacity-100 transition-opacity duration-300 ease-out"
        }
      >
        <Suspense fallback={null}>
          <AmbientBackgroundHarness
            ref={ambientFieldRef}
            fullDensity={ambientPerfMode}
          />
        </Suspense>
      </div>
      {siegeMounted ? (
        <Suspense fallback={null}>
          <SiegeExperience
            dashboardRef={dashboardRef}
            onShellStateChange={setShellState}
            startRequestId={startRequestId}
            transitionSnapshot={stableTransitionSnapshot}
          />
        </Suspense>
      ) : null}
      {shouldRenderDashboard ? (
        <DashboardShell
          dashboardRef={dashboardRef}
          interactiveMode={shellState.interactiveMode}
          onEnterInteractiveMode={handleEnterInteractiveMode}
          onPrefetchSiege={prefetchSiege}
          siegePhase={shellState.siegePhase}
        />
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
