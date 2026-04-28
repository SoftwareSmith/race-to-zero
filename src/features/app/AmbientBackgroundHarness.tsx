import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useDashboardMetrics,
  useDashboardSettings,
} from "@dashboard/context/DashboardContext";
import BackgroundField from "@game/components/BackgroundField";
import type { BackgroundFieldHandle } from "@game/components/BackgroundField/types";

interface AmbientBackgroundHarnessProps {
  fullDensity?: boolean;
}

const AmbientBackgroundHarness = memo(
  forwardRef<BackgroundFieldHandle, AmbientBackgroundHarnessProps>(
    function AmbientBackgroundHarness(
      { fullDensity = false }: AmbientBackgroundHarnessProps,
      ref,
    ) {
      const metrics = useDashboardMetrics();
      const settings = useDashboardSettings();
      const backgroundFieldRef = useRef<BackgroundFieldHandle | null>(null);
      const bugCounts = useMemo(
        () => metrics.currentBugCounts,
        [metrics.currentBugCounts],
      );
      const visibilityKey = useMemo(
        () =>
          `${fullDensity ? "full" : "ambient"}:${Object.values(bugCounts).join(":")}`,
        [bugCounts, fullDensity],
      );
      const [revealedKey, setRevealedKey] = useState(
        fullDensity ? visibilityKey : "",
      );
      const isVisible = fullDensity || revealedKey === visibilityKey;

      useEffect(() => {
        let firstFrame = 0;
        let secondFrame = 0;

        if (fullDensity) {
          firstFrame = window.requestAnimationFrame(() => {
            setRevealedKey(visibilityKey);
          });

          return () => {
            if (firstFrame) {
              window.cancelAnimationFrame(firstFrame);
            }
          };
        }

        firstFrame = window.requestAnimationFrame(() => {
          secondFrame = window.requestAnimationFrame(() => {
            setRevealedKey(visibilityKey);
          });
        });

        return () => {
          window.cancelAnimationFrame(firstFrame);
          if (secondFrame) {
            window.cancelAnimationFrame(secondFrame);
          }
        };
      }, [fullDensity, visibilityKey]);

      useImperativeHandle(
        ref,
        () => ({
          captureTransitionSnapshot: () =>
            backgroundFieldRef.current?.captureTransitionSnapshot() ?? [],
        }),
        [],
      );

      return (
        <BackgroundField
          ref={backgroundFieldRef}
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
    },
  ),
);

export default AmbientBackgroundHarness;
