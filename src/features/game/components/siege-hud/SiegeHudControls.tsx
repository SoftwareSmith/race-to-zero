import { Suspense, lazy, memo, type ReactNode, type RefObject } from "react";
import Tooltip from "@shared/components/Tooltip";
import type { SiegeGameMode } from "@game/types";
import { SIEGE_GAME_MODE_META } from "@game/types";
import { cn } from "@shared/utils/cn";
import { HudActionButton } from "./shared";

const CodexPanel = lazy(() => import("@game/components/CodexPanel"));

interface SiegeHudControlsProps {
  className?: string;
  codexMenuRef?: RefObject<HTMLDivElement | null>;
  codexOpen: boolean;
  debugMode: boolean;
  gameMode: SiegeGameMode;
  onChangeGameMode?: (mode: SiegeGameMode) => void;
  onExit: () => void;
  onEndSurvival?: () => void;
  onKillAllBugs?: () => void;
  onToggleCodex?: () => void;
  onToggleDebugMode?: () => void;
  onPointerEnterHud: () => void;
  onPointerLeaveHud: () => void;
}

interface HudControlAction {
  active?: boolean;
  ariaLabel: string;
  icon: ReactNode;
  key: string;
  onClick: () => void;
  tone: "default" | "danger" | "info";
  tooltip: string;
}

const SiegeHudControls = memo(function SiegeHudControls({
  className,
  codexMenuRef,
  codexOpen,
  debugMode,
  gameMode,
  onChangeGameMode,
  onEndSurvival,
  onExit,
  onKillAllBugs,
  onToggleCodex,
  onToggleDebugMode,
  onPointerEnterHud,
  onPointerLeaveHud,
}: SiegeHudControlsProps) {
  const codexTrigger = onToggleCodex ? (
    <Tooltip content="Open codex">
      <HudActionButton
        active={codexOpen}
        ariaLabel="Open codex"
        onClick={onToggleCodex}
      >
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
  const controlActions: HudControlAction[] = [
    ...(onToggleDebugMode
      ? [
          {
            active: debugMode,
            ariaLabel: "Toggle debug overlay",
            icon: (
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
            ),
            key: "debug",
            onClick: onToggleDebugMode,
            tone: "info" as const,
            tooltip: "Toggle debug overlay",
          },
        ]
      : []),
    ...(debugMode && onKillAllBugs
      ? [
          {
            ariaLabel: "Kill all bugs",
            icon: (
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
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
                <path d="M12 3v3" />
                <path d="M3 12h3m12 0h3" />
              </svg>
            ),
            key: "kill-all",
            onClick: onKillAllBugs,
            tone: "danger" as const,
            tooltip: "Clear the current swarm and trigger completion state",
          },
        ]
      : []),
    ...(debugMode && onEndSurvival && gameMode === "outbreak"
      ? [
          {
            ariaLabel: "Force survival overrun",
            icon: (
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
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            ),
            key: "end-survival",
            onClick: onEndSurvival,
            tone: "danger" as const,
            tooltip: "Force the site offline and view the overrun modal",
          },
        ]
      : []),
    {
      ariaLabel: "Back to dashboard",
      icon: (
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
      ),
      key: "exit",
      onClick: onExit,
      tone: "danger" as const,
      tooltip: "Exit siege",
    },
  ];

  return (
    <div className={cn("pointer-events-auto shrink-0", className)}>
      <div
        data-testid="siege-hud-controls"
        data-hud-cursor="default"
        className="select-none !cursor-default"
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

            {controlActions.map((action) => (
              <Tooltip key={action.key} content={action.tooltip}>
                <HudActionButton
                  active={action.active}
                  ariaLabel={action.ariaLabel}
                  onClick={action.onClick}
                  tone={action.tone}
                >
                  {action.icon}
                </HudActionButton>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SiegeHudControls;
