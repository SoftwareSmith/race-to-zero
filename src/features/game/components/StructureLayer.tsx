/**
 * StructureLayer — renders placed structures (Lantern, Bug Agent, Turret) as an
 * absolute-positioned layer inside BackgroundField, aligned with canvas-local coords.
 */

import { useEffect, useState } from "react";
import type { AgentCaptureState, PlacedStructure } from "@game/types";
import { STRUCTURE_DEFS } from "@config/structureConfig";

interface StructureLayerProps {
  structures: PlacedStructure[];
  agentCaptures?: Record<string, AgentCaptureState>;
  turretLastFireTimes?: Record<string, number>;
  teslaLastFireTimes?: Record<string, number>;
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
  turretLastFireTimes,
  teslaLastFireTimes,
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
        const isLantern = s.structureType === "lantern";
        const isTurret = s.structureType === "turret";
        const isTesla = s.structureType === "tesla";
        const isFirewall = s.structureType === "firewall";
        const effectR = def?.effectRadius ?? 80;
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
        const agentLabel =
          !isLantern && !isTurret
            ? getAgentText(capture?.phase ?? "idle", progress)
            : null;
        const turretLastFiredAt = turretLastFireTimes?.[s.id];
        const turretCooldownMs = 2000;
        const teslaLastFiredAt = teslaLastFireTimes?.[s.id];
        const teslaCooldownMs = 2500;

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
                    background: `radial-gradient(circle, ${color}55 0%, ${color}22 35%, ${color}08 65%, transparent 80%)`,
                    boxShadow: `0 0 60px 20px ${color}18`,
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
                    background: `${color}30`,
                    boxShadow: `0 0 28px ${color}70`,
                  }}
                >
                  <span className="text-xl leading-none">🔦</span>
                </div>
              </>
            ) : isTurret ? (
              /* ── Turret: debug-pointer core with reload bar ── */
              <>
                <div
                  className="pointer-events-none absolute rounded-full border border-dashed [animation:turret-scan_2s_ease-in-out_infinite]"
                  style={{
                    width: effectR * 2,
                    height: effectR * 2,
                    left: -effectR,
                    top: -effectR,
                    borderColor: `${color}45`,
                  }}
                />
                <div
                  className="pointer-events-none absolute rounded-full border border-cyan-200/12"
                  style={{
                    width: 58,
                    height: 58,
                    left: -29,
                    top: -29,
                    boxShadow: `0 0 20px ${color}18`,
                  }}
                />
                <div
                  className="absolute flex h-11 w-11 items-center justify-center rounded-full border"
                  style={{
                    left: -22,
                    top: -22,
                    borderColor: `${color}70`,
                    background: `radial-gradient(circle at 40% 38%, ${color}30 0%, ${color}18 45%, rgba(3,7,18,0.88) 100%)`,
                    boxShadow: `0 0 18px ${color}55`,
                  }}
                >
                  <div className="absolute inset-[5px] rounded-full border border-cyan-200/18 [animation:laser-cursor-breathe_1.8s_ease-in-out_infinite]" />
                  <div className="text-cyan-100 [animation:laser-cursor-breathe_1.2s_ease-in-out_infinite]">
                    {/* Crosshair icon — distinct from weapon HUD glyph */}
                    <svg
                      viewBox="0 0 20 20"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <circle cx="10" cy="10" r="4.5" />
                      <circle cx="10" cy="10" r="7.5" opacity="0.5" />
                      <line x1="10" y1="1" x2="10" y2="4" />
                      <line x1="10" y1="16" x2="10" y2="19" />
                      <line x1="1" y1="10" x2="4" y2="10" />
                      <line x1="16" y1="10" x2="19" y2="10" />
                    </svg>
                  </div>
                  <div
                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-100"
                    style={{
                      transform: "translate(-50%, -50%)",
                      boxShadow: "0 0 8px rgba(165,243,252,0.7)",
                    }}
                  />
                </div>
                <div
                  className="absolute h-1.5 w-12 overflow-hidden rounded-full border border-cyan-200/20 bg-slate-950/80"
                  style={{
                    top: 26,
                    left: -24,
                    boxShadow: `0 0 10px ${color}18`,
                  }}
                >
                  <div
                    key={turretLastFiredAt}
                    className="h-full rounded-full bg-cyan-300/85"
                    style={
                      turretLastFiredAt != null
                        ? {
                            animation: `reload-drain ${turretCooldownMs}ms linear forwards`,
                          }
                        : { width: "100%" }
                    }
                  />
                </div>
              </>
            ) : isTesla ? (
              /* ── Tesla Coil: rotating plasma ring + coil core ── */
              <>
                {/* Field radius indicator */}
                <div
                  className="pointer-events-none absolute rounded-full border border-dashed [animation:turret-scan_1.4s_ease-in-out_infinite]"
                  style={{
                    width: effectR * 2,
                    height: effectR * 2,
                    left: -effectR,
                    top: -effectR,
                    borderColor: `${color}40`,
                  }}
                />
                {/* Outer ambient ring */}
                <div
                  className="pointer-events-none absolute rounded-full border [animation:structure-pulse_2s_ease-in-out_infinite]"
                  style={{
                    width: 64,
                    height: 64,
                    left: -32,
                    top: -32,
                    borderColor: `${color}60`,
                    boxShadow: `0 0 22px ${color}30`,
                  }}
                />
                {/* Inner plasma rotating ring */}
                <div
                  className="pointer-events-none absolute rounded-full border-2 border-dashed"
                  style={{
                    width: 46,
                    height: 46,
                    left: -23,
                    top: -23,
                    borderColor: `${color}90`,
                    animation: "agent-ring-spin 1.8s linear infinite",
                    boxShadow: `0 0 14px ${color}50, inset 0 0 10px ${color}20`,
                  }}
                />
                {/* Core */}
                <div
                  className="absolute flex h-10 w-10 items-center justify-center rounded-full border-2"
                  style={{
                    left: -20,
                    top: -20,
                    borderColor: `${color}80`,
                    background: `radial-gradient(circle at 38% 36%, ${color}40 0%, ${color}18 50%, rgba(3,7,18,0.9) 100%)`,
                    boxShadow: `0 0 22px ${color}70`,
                  }}
                >
                  <span className="text-lg leading-none">⚡</span>
                </div>
                {/* Reload bar */}
                <div
                  className="absolute h-1.5 w-12 overflow-hidden rounded-full border border-yellow-400/20 bg-slate-950/80"
                  style={{
                    top: 26,
                    left: -24,
                    boxShadow: `0 0 10px ${color}18`,
                  }}
                >
                  <div
                    key={teslaLastFiredAt}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                      ...(teslaLastFiredAt != null
                        ? {
                            animation: `reload-drain ${teslaCooldownMs}ms linear forwards`,
                          }
                        : { width: "100%" }),
                    }}
                  />
                </div>
              </>
            ) : isFirewall ? (
              /* ── Firewall: arc-slash energy blades rotating each tick ── */
              <>
                {(() => {
                  const slashPhase = Math.floor(now / 380);
                  const angles = [0, 1, 2].map(
                    (i) => (slashPhase * 137 + i * 127) % 360,
                  );
                  return angles.map((angle, i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute"
                      style={{
                        width: 6,
                        height: 160,
                        left: -3,
                        top: -80,
                        background: `linear-gradient(to bottom, transparent 0%, ${color}00 5%, ${color}88 35%, ${color}cc 50%, ${color}88 65%, ${color}00 95%, transparent 100%)`,
                        borderRadius: "50%",
                        filter: "blur(2px)",
                        transform: `rotate(${angle}deg)`,
                        boxShadow: `0 0 12px 2px ${color}44`,
                        opacity: 0.9,
                      }}
                    />
                  ));
                })()}
                {/* Core icon */}
                <div
                  className="absolute flex h-10 w-10 items-center justify-center rounded-full border-2"
                  style={{
                    left: -20,
                    top: -20,
                    borderColor: `${color}80`,
                    background: `radial-gradient(circle, ${color}30 0%, rgba(3,7,18,0.9) 100%)`,
                    boxShadow: `0 0 24px ${color}70`,
                  }}
                >
                  <span className="text-xl leading-none">🔥</span>
                </div>
                {/* Lifetime indicator bar */}
                <div
                  className="absolute h-1.5 w-12 overflow-hidden rounded-full border border-orange-400/25 bg-slate-950/80"
                  style={{ top: 26, left: -24 }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${color}, ${color}bb)`,
                      animation: `reload-drain 8000ms linear forwards`,
                    }}
                  />
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
