import { memo, useEffect, useMemo, useState } from "react";
import {
  useDashboardMetrics,
  useDashboardSettings,
} from "@dashboard/context/DashboardContext";
import BackgroundField from "@game/components/BackgroundField";

interface AmbientBackgroundHarnessProps {
  fullDensity?: boolean;
}

const AmbientBackgroundHarness = memo(function AmbientBackgroundHarness({
  fullDensity = false,
}: AmbientBackgroundHarnessProps) {
  const metrics = useDashboardMetrics();
  const settings = useDashboardSettings();
  const bugCounts = useMemo(
    () => metrics.currentBugCounts,
    [metrics.currentBugCounts],
  );
  const [isVisible, setIsVisible] = useState(fullDensity);

  useEffect(() => {
    if (fullDensity) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [bugCounts, fullDensity]);

  return (
    <BackgroundField
      bugCounts={bugCounts}
      bugVisualSettings={settings.bugVisualSettings}
      chartFocus={null}
      className={
        isVisible
          ? "z-0 transition-opacity duration-300 ease-out opacity-100"
          : "z-0 transition-opacity duration-300 ease-out opacity-0"
      }
      interactiveMode={false}
      openBugCount={metrics.currentBugCount}
      tone={metrics.deadlineMetrics.statusTone}
    />
  );
});

export default AmbientBackgroundHarness;
