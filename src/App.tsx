import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SiegePhase } from "@game/types";
import DashboardShell from "./features/app/DashboardShell";
import { DashboardProvider } from "./features/dashboard/context/DashboardContext";

const loadSiegeExperience = () => import("./features/app/SiegeExperience");
const SiegeExperience = lazy(loadSiegeExperience);

function AppContent() {
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const [siegeMounted, setSiegeMounted] = useState(false);
  const [startRequestId, setStartRequestId] = useState(0);
  const [shellState, setShellState] = useState<{
    interactiveMode: boolean;
    siegePhase: SiegePhase;
  }>({
    interactiveMode: false,
    siegePhase: "idle",
  });

  const prefetchSiege = useCallback(() => {
    void loadSiegeExperience();
  }, []);

  useEffect(() => {
    startTransition(() => {
      setSiegeMounted(true);
    });

    return undefined;
  }, []);

  const handleEnterInteractiveMode = useCallback(() => {
    prefetchSiege();
    startTransition(() => {
      setSiegeMounted(true);
      setStartRequestId((value) => value + 1);
    });
  }, [prefetchSiege]);

  return (
    <div className="relative h-screen overflow-hidden bg-[#050608] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_26%),linear-gradient(180deg,#020304_0%,#050608_44%,#080d12_100%)]" />
      <div className="pointer-events-none absolute inset-x-[12%] top-[-18%] h-[42vh] rounded-full bg-[radial-gradient(circle,rgba(244,114,182,0.14),transparent_62%)] blur-3xl" />
      {siegeMounted ? (
        <Suspense fallback={null}>
          <SiegeExperience
            dashboardRef={dashboardRef}
            onShellStateChange={setShellState}
            startRequestId={startRequestId}
          />
        </Suspense>
      ) : null}
      <DashboardShell
        dashboardRef={dashboardRef}
        interactiveMode={shellState.interactiveMode}
        onEnterInteractiveMode={handleEnterInteractiveMode}
        onPrefetchSiege={prefetchSiege}
        siegePhase={shellState.siegePhase}
      />
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
