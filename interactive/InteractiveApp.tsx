import { useEffect, useMemo, useState } from "react";
import BackgroundField from "../src/components/BackgroundField";
import Surface from "../src/components/Surface";
import type { BugCounts, BugVisualSettings } from "../src/types/dashboard";

interface InteractiveAppProps {
  initialBugCount: number;
}

const DEFAULT_BUG_VISUAL_SETTINGS: BugVisualSettings = {
  chaosMultiplier: 1,
  sizeMultiplier: 1,
};

function formatRuntime(seconds: number) {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (wholeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function InteractiveApp({ initialBugCount }: InteractiveAppProps) {
  const [remainingBugCount, setRemainingBugCount] = useState(initialBugCount);
  const [bugsFixed, setBugsFixed] = useState(0);
  const [runtimeSeconds, setRuntimeSeconds] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    document.body.classList.add("interactive-mode");
    const mountedAnimation = window.requestAnimationFrame(() => {
      setIsMounted(true);
    });
    const intervalId = window.setInterval(() => {
      setRuntimeSeconds((currentValue) => currentValue + 1);
    }, 1000);

    return () => {
      document.body.classList.remove("interactive-mode");
      window.cancelAnimationFrame(mountedAnimation);
      window.clearInterval(intervalId);
    };
  }, []);

  const subtitle = useMemo(() => {
    if (remainingBugCount === 0) {
      return "All visible bugs cleared. The live field is neutralized.";
    }

    return "Minimal interactive mode using the same terminator field as the dashboard.";
  }, [remainingBugCount]);

  const bugCounts = useMemo<BugCounts>(
    () => ({
      high: 0,
      low: remainingBugCount,
      medium: 0,
      urgent: 0,
    }),
    [remainingBugCount],
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <Surface
          tone="strong"
          className={[
            "relative overflow-hidden p-5 transition-[opacity,transform] duration-500 ease-out sm:p-6",
            isMounted
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-[0.99] opacity-0",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]" />

          <div className="relative max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
                Interactive Mode
              </p>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-4 text-sm font-medium text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100"
                href="../"
              >
                Back to dashboard
              </a>
            </div>

            <h1 className="mt-3 font-display text-4xl leading-[0.94] tracking-[-0.06em] text-stone-50 sm:text-5xl xl:text-6xl">
              Race to Zero Bugs
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400 sm:text-base">
              {subtitle}
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <div className="rounded-[18px] border border-white/8 bg-zinc-950/74 px-3.5 py-2.5 shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <span className="block text-[0.64rem] font-medium uppercase tracking-[0.16em] text-stone-500">
                  Current bugs
                </span>
                <strong className="mt-1 block text-lg font-semibold text-stone-50">
                  {remainingBugCount.toLocaleString()}
                </strong>
              </div>
              <div className="rounded-[18px] border border-white/8 bg-zinc-950/74 px-3.5 py-2.5 shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <span className="block text-[0.64rem] font-medium uppercase tracking-[0.16em] text-stone-500">
                  Fixed
                </span>
                <strong className="mt-1 block text-lg font-semibold text-stone-50">
                  {bugsFixed.toLocaleString()}
                </strong>
              </div>
              <div className="rounded-[18px] border border-white/8 bg-zinc-950/74 px-3.5 py-2.5 shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <span className="block text-[0.64rem] font-medium uppercase tracking-[0.16em] text-stone-500">
                  Runtime
                </span>
                <strong className="mt-1 block text-lg font-semibold text-stone-50">
                  {formatRuntime(runtimeSeconds)}
                </strong>
              </div>
            </div>
          </div>
        </Surface>

        <Surface
          tone="subtle"
          className={[
            "relative min-h-[62vh] overflow-hidden transition-[opacity,transform] duration-700 ease-out",
            isMounted
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-5 scale-[0.992] opacity-0",
          ].join(" ")}
        >
          <BackgroundField
            bugCounts={bugCounts}
            bugVisualSettings={DEFAULT_BUG_VISUAL_SETTINGS}
            chartFocus={null}
            milestoneFlash={null}
            onTerminatorHit={() => {
              setRemainingBugCount((currentValue) =>
                Math.max(0, currentValue - 1),
              );
              setBugsFixed((currentValue) => currentValue + 1);
            }}
            showParticleCount={false}
            showTerminatorStatusBadge={false}
            terminatorMode
            remainingBugCount={remainingBugCount}
            tone="negative"
          />
        </Surface>
      </div>
    </div>
  );
}

export default InteractiveApp;
