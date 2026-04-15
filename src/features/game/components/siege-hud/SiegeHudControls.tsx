import { Suspense, lazy, memo, type RefObject } from "react";
import Tooltip from "@shared/components/Tooltip";
import type { SiegeGameMode } from "@game/types";
import { SIEGE_GAME_MODE_META } from "@game/types";
import { cn } from "@shared/utils/cn";
import { HudActionButton } from "./shared";

const CodexPanel = lazy(() => import("@game/components/CodexPanel"));

interface SiegeHudControlsProps {
  codexMenuRef?: RefObject<HTMLDivElement | null>;
  codexOpen: boolean;
  debugMode: boolean;
  gameMode: SiegeGameMode;
  onChangeGameMode?: (mode: SiegeGameMode) => void;
  onExit: () => void;
  onToggleCodex?: () => void;
  onToggleDebugMode?: () => void;
  onPointerEnterHud: () => void;
  onPointerLeaveHud: () => void;
}

const SiegeHudControls = memo(function SiegeHudControls({
  codexMenuRef,
  codexOpen,
  debugMode,
  gameMode,
  onChangeGameMode,
  onExit,
  onToggleCodex,
  onToggleDebugMode,
  onPointerEnterHud,
  onPointerLeaveHud,
}: SiegeHudControlsProps) {
  const codexTrigger = onToggleCodex ? (
    <Tooltip content="Open codex">
      <HudActionButton active={codexOpen} onClick={onToggleCodex}>
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
          viewBox="0 0 24 24"
        >
          <path d="M5.5 5.5A2.5 2.5 0 0 1 8 3h10.5v15.5A2.5 2.5 0 0 0 16 16H5.5Z" />
          <path d="M8 3.5v12.3A2.2 2.2 0 0 0 10.2 18H18" />
          <path d="M10.1 7.2h5.8M10.1 10.4h5.8" />
        </svg>
      </HudActionButton>
    </Tooltip>
  ) : null;

  return (
    <div className="pointer-events-none fixed left-3 top-3 z-[220] sm:left-4 sm:top-4">
      <div
        data-testid="siege-hud-controls"
        data-hud-cursor="default"
        className="pointer-events-auto w-full max-w-[26rem] select-none !cursor-default [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label="Siege mode"
            className="inline-flex rounded-full border border-white/8 bg-black/28 p-0.5 shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl"
            role="tablist"
          >
            {(["purge", "outbreak"] as const).map((mode) => {
              const meta = SIEGE_GAME_MODE_META[mode];
              const selected = mode === gameMode;

              return (
                <Tooltip key={mode} content={meta.description}>
                  <button
                    aria-selected={selected}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[0.74rem] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40",
                      selected
                        ? "bg-sky-400/8 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]"
                        : "text-stone-400 hover:bg-white/4 hover:text-stone-100",
                    )}
                    onClick={() => onChangeGameMode?.(mode)}
                    role="tab"
                    type="button"
                  >
                    {meta.shortLabel}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div
            className="flex items-center gap-1.5"
            onPointerEnter={onPointerEnterHud}
            onPointerLeave={onPointerLeaveHud}
          >
            {codexMenuRef && onToggleCodex ? (
              <Suspense fallback={codexTrigger}>
                <CodexPanel
                  containerRef={codexMenuRef}
                  onMenuToggle={onToggleCodex}
                  open={codexOpen}
                  trigger={codexTrigger}
                />
              </Suspense>
            ) : null}

            {onToggleDebugMode ? (
              <Tooltip content="Toggle debug overlay">
                <HudActionButton
                  active={debugMode}
                  ariaLabel="Toggle debug overlay"
                  onClick={onToggleDebugMode}
                  tone="info"
                >
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <rect x="6" y="7" width="12" height="11" rx="2" />
                    <path d="M9 7V5a3 3 0 0 1 6 0v2M4 11h2m12 0h2" />
                  </svg>
                </HudActionButton>
              </Tooltip>
            ) : null}

            <Tooltip content="Exit siege">
              <HudActionButton
                ariaLabel="Back to dashboard"
                onClick={onExit}
                tone="danger"
              >
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path d="M15 18 9 12l6-6" />
                  <path d="M9 12h10" />
                </svg>
              </HudActionButton>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SiegeHudControls;
