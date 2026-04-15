/**
 * StructureLayer — renders placed structures as an absolute-positioned layer
 * inside BackgroundField, aligned with canvas-local coords.
 */

import { useEffect, useState } from "react";
import type { AgentCaptureState, PlacedStructure } from "@game/types";
import { STRUCTURE_DEFS } from "@config/structureConfig";

interface StructureLayerProps {
  structures: PlacedStructure[];
  agentCaptures?: Record<string, AgentCaptureState>;
}

/** Agent commentary lines based on absorb progress */
function getAgentText(
  phase: string,
  progress: number,
): { text: string; color: string } {
  if (phase === "done") return { text: "✓ Merged!", color: "#4ade80" };
  if (phase === "failed") return { text: "✗ PR Rejected", color: "#f87171" };
  if (phase === "idle") return { text: "Scanning...", color: "#d1fae5" };
  if (progress < 0.22) return { text: "Analysing bug…", color: "#94a3b8" };
  if (progress < 0.48) return { text: "Writing PR…", color: "#7dd3fc" };
  if (progress < 0.75) return { text: "Running tests…", color: "#fbbf24" };
  return { text: "Awaiting review…", color: "#c084fc" };
}

export default function StructureLayer({
  structures,
  agentCaptures,
}: StructureLayerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let animationFrameId = 0;
    let lastUpdateAt = 0;

    const tick = (timestamp: number) => {
      if (timestamp - lastUpdateAt >= 100) {
        lastUpdateAt = timestamp;
        setNow(Date.now());
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (structures.length === 0) return null;

  return (
    <>
      {structures.map((s) => {
        const def = STRUCTURE_DEFS.find((d) => d.id === s.structureType);
        const color = def?.accentColor ?? "#fbbf24";
        const tier = s.tier ?? 1;
        const tierScale = 1 + (tier - 1) * 0.12;
        const isLantern = s.structureType === "lantern";
        const effectR = (def?.effectRadius ?? 80) * tierScale;
        const capture = agentCaptures?.[s.id];
        const isAbsorbing = capture?.phase === "absorbing";
        const isDone = capture?.phase === "done";
        const isFailed = capture?.phase === "failed";
        const progress =
          isAbsorbing && capture
            ? Math.min(1, (now - capture.startedAt) / capture.processingMs)
            : isDone
              ? 1
              : 0;
        const agentLabel = isLantern
          ? null
          : getAgentText(capture?.phase ?? "idle", progress);

        return (
          <div
            key={s.id}
            aria-hidden="true"
            className="pointer-events-none absolute overflow-visible [animation:structure-spawn-in_420ms_cubic-bezier(.34,1.56,.64,1)_forwards]"
            style={{
              left: s.canvasX,
              top: s.canvasY,
              width: 0,
              height: 0,
            }}
          >
            <div
              className="absolute -right-4 -top-5 flex min-w-8 items-center justify-center rounded-full border px-1.5 py-0.5 text-[0.45rem] font-semibold uppercase tracking-[0.12em] text-white"
              style={{
                borderColor: `${color}88`,
                background: `linear-gradient(180deg, ${color}55, rgba(3,7,18,0.92))`,
                boxShadow: `0 0 12px ${color}30`,
              }}
            >
              {tier === 3 ? "T3" : `T${tier}`}
            </div>

            {/* ── Lantern: large radial warm glow field ── */}
            {isLantern ? (
              <>
                {/* Big ambient glow fills attraction radius */}
                <div
                  className="pointer-events-none absolute rounded-full [animation:structure-glow_2.5s_ease-in-out_infinite]"
                  style={{
                    width: effectR * 2,
                    height: effectR * 2,
                    left: -effectR,
                    top: -effectR,
                    background: `radial-gradient(circle, ${color}${tier >= 3 ? "77" : tier === 2 ? "66" : "55"} 0%, ${color}22 35%, ${color}08 65%, transparent 80%)`,
                    boxShadow: `0 0 ${60 + tier * 10}px ${20 + tier * 4}px ${color}18`,
                  }}
                />
                {/* Subtle pulsing ring edge */}
                <div
                  className="pointer-events-none absolute rounded-full border [animation:structure-pulse_3s_ease-in-out_infinite]"
                  style={{
                    width: effectR * 2,
                    height: effectR * 2,
                    left: -effectR,
                    top: -effectR,
                    borderColor: `${color}20`,
                  }}
                />
                {/* Central flame icon */}
                <div
                  className="absolute flex h-10 w-10 items-center justify-center rounded-full border [animation:structure-glow_2s_ease-in-out_infinite]"
                  style={{
                    left: -20,
                    top: -20,
                    borderColor: `${color}70`,
                    background: `${color}${tier >= 3 ? "48" : "30"}`,
                    boxShadow: `0 0 ${28 + tier * 6}px ${color}70`,
                    transform: `scale(${1 + (tier - 1) * 0.06})`,
                  }}
                >
                  <span className="text-xl leading-none">🔦</span>
                </div>
              </>
            ) : (
              /* ── Agent: terminal-badge design, larger footprint ── */
              <>
                {/* Progress ring — 60px SVG to match larger body */}
                {(isAbsorbing || isDone || isFailed) && (
                  <div
                    className="pointer-events-none absolute"
                    style={{ width: 72, height: 72, left: -36, top: -36 }}
                  >
                    <svg
                      viewBox="0 0 72 72"
                      width="72"
                      height="72"
                      style={{ position: "absolute", inset: 0 }}
                    >
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke={`${color}22`}
                        strokeWidth="3"
                      />
                      {isAbsorbing ? (
                        <circle
                          cx="36"
                          cy="36"
                          r="30"
                          fill="none"
                          stroke={color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 30}`}
                          strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress)}`}
                          style={{
                            transformOrigin: "center",
                            transform: "rotate(-90deg)",
                            transition: "stroke-dashoffset 0.1s linear",
                          }}
                        />
                      ) : isDone ? (
                        <circle
                          cx="36"
                          cy="36"
                          r="30"
                          fill="none"
                          stroke="#4ade80"
                          strokeWidth="3"
                          strokeLinecap="round"
                          style={{
                            animation:
                              "agent-absorb-done 0.9s ease-out forwards",
                          }}
                        />
                      ) : (
                        <circle
                          cx="36"
                          cy="36"
                          r="30"
                          fill="none"
                          stroke="#f87171"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${(2 * Math.PI * 30 * progress * 360) / 360} ${2 * Math.PI * 30}`}
                          style={{
                            transformOrigin: "center",
                            transform: "rotate(-90deg)",
                            animation:
                              "agent-absorb-fail 0.7s ease-out forwards",
                          }}
                        />
                      )}
                    </svg>
                  </div>
                )}
                {/* Badge body */}
                <div
                  className="absolute flex h-14 w-14 items-center justify-center rounded-xl border-2"
                  style={{
                    left: -28,
                    top: -28,
                    borderColor: `${color}70`,
                    background: `radial-gradient(circle at 40% 38%, ${color}28 0%, rgba(3,7,18,0.92) 100%)`,
                    boxShadow: `0 0 20px ${color}45`,
                  }}
                >
                  <span className="text-2xl leading-none">🤖</span>
                  {isDone && (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-sm font-bold text-green-400"
                      style={{
                        animation: "agent-absorb-done 0.9s ease-out forwards",
                      }}
                    >
                      ✓
                    </div>
                  )}
                  {isFailed && (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-sm font-bold text-red-400"
                      style={{
                        animation: "agent-absorb-fail 0.7s ease-out forwards",
                      }}
                    >
                      ✕
                    </div>
                  )}
                </div>
                {/* Commentary text */}
                {agentLabel && (
                  <div
                    className="absolute whitespace-nowrap rounded-full border border-white/10 bg-black/78 px-2 py-1 font-mono text-[0.68rem] font-semibold shadow-[0_6px_16px_rgba(0,0,0,0.3)]"
                    style={{
                      bottom: 36,
                      left: 0,
                      transform: "translateX(-50%)",
                      color: agentLabel.color,
                    }}
                  >
                    {agentLabel.text}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
