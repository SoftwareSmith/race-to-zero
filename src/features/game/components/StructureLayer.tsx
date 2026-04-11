/**
 * StructureLayer — renders placed structures (Lantern, Bug Agent, Turret) as an
 * absolute-positioned layer inside BackgroundField, aligned with canvas-local coords.
 */

import { useEffect, useState } from "react";
import type { AgentCaptureState, PlacedStructure } from "@game/types";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { STRUCTURE_DEFS } from "@config/structureConfig";

interface StructureLayerProps {
  structures: PlacedStructure[];
  agentCaptures?: Record<string, AgentCaptureState>;
  turretLastFireTimes?: Record<string, number>;
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
}: StructureLayerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(intervalId);
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
                    <WeaponGlyph className="h-5 w-5" id="laser" />
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
              </>
            ) : isFirewall ? (
              /* ── Firewall: flame column + countdown bar ── */
              <>
                {/* Flame tongue 1 — central, tallest */}
                <div
                  className="pointer-events-none absolute [animation:fire-flicker_380ms_ease-in-out_infinite]"
                  style={{
                    width: 28,
                    height: 180,
                    left: -26,
                    top: -90,
                    background: `linear-gradient(to top, ${color}00 0%, ${color}66 30%, ${color}99 60%, ${color}55 80%, ${color}00 100%)`,
                    boxShadow: `0 0 22px 6px ${color}30`,
                    borderRadius: "50%",
                    filter: "blur(3px)",
                  }}
                />
                {/* Flame tongue 2 — left, shorter */}
                <div
                  className="pointer-events-none absolute [animation:fire-flicker-2_420ms_ease-in-out_infinite]"
                  style={{
                    width: 20,
                    height: 140,
                    left: -14,
                    top: -85,
                    background: `linear-gradient(to top, ${color}00 0%, ${color}44 35%, ${color}77 65%, ${color}33 85%, ${color}00 100%)`,
                    borderRadius: "50%",
                    filter: "blur(3.5px)",
                    opacity: 0.85,
                  }}
                />
                {/* Flame tongue 3 — right, narrowest */}
                <div
                  className="pointer-events-none absolute [animation:fire-flicker-3_350ms_ease-in-out_infinite]"
                  style={{
                    width: 16,
                    height: 120,
                    left: -8,
                    top: -88,
                    background: `linear-gradient(to top, ${color}00 0%, ${color}33 40%, ${color}66 70%, ${color}22 90%, ${color}00 100%)`,
                    borderRadius: "50%",
                    filter: "blur(4px)",
                    opacity: 0.7,
                  }}
                />
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
              /* ── Agent: progress ring + commentary text ── */
              <>
                {/* Rotating dashed ambient ring */}
                <div
                  className="pointer-events-none absolute rounded-full border-2 border-dashed border-cyan-400/25"
                  style={{
                    width: 72,
                    height: 72,
                    left: -36,
                    top: -36,
                    animation: "agent-ring-spin 8s linear infinite",
                  }}
                />
                {/* Progress ring overlay */}
                {isAbsorbing || isDone || isFailed ? (
                  <div
                    className="pointer-events-none absolute"
                    style={{ width: 52, height: 52, left: -26, top: -26 }}
                  >
                    <svg
                      viewBox="0 0 52 52"
                      width="52"
                      height="52"
                      style={{ position: "absolute", inset: 0 }}
                    >
                      <circle
                        cx="26"
                        cy="26"
                        r="22"
                        fill="none"
                        stroke={`${color}22`}
                        strokeWidth="3"
                      />
                      {isAbsorbing ? (
                        <circle
                          cx="26"
                          cy="26"
                          r="22"
                          fill="none"
                          stroke={color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 22}`}
                          strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress)}`}
                          style={{
                            transformOrigin: "center",
                            transform: "rotate(-90deg)",
                            transition: "stroke-dashoffset 0.1s linear",
                          }}
                        />
                      ) : isDone ? (
                        <circle
                          cx="26"
                          cy="26"
                          r="22"
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
                          cx="26"
                          cy="26"
                          r="22"
                          fill="none"
                          stroke="#f87171"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${(2 * Math.PI * 22 * progress * 360) / 360} ${2 * Math.PI * 22}`}
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
                ) : null}
                {/* Icon */}
                <div
                  className="absolute flex h-9 w-9 items-center justify-center rounded-full border text-sm"
                  style={{
                    left: -18,
                    top: -18,
                    borderColor: `${color}60`,
                    background: `${color}18`,
                    boxShadow: `0 0 12px ${color}40`,
                  }}
                >
                  <span className="leading-none text-base">🤖</span>
                  {/* Done/fail badge */}
                  {isDone ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-xs font-bold text-green-400"
                      style={{
                        animation: "agent-absorb-done 0.9s ease-out forwards",
                      }}
                    >
                      ✓
                    </div>
                  ) : isFailed ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-xs font-bold text-red-400"
                      style={{
                        animation: "agent-absorb-fail 0.7s ease-out forwards",
                      }}
                    >
                      ✕
                    </div>
                  ) : null}
                </div>
                {/* Commentary text */}
                {agentLabel ? (
                  <div
                    className="absolute whitespace-nowrap rounded-full border border-white/10 bg-black/78 px-2 py-1 font-mono text-[0.68rem] font-semibold shadow-[0_6px_16px_rgba(0,0,0,0.3)]"
                    style={{
                      bottom: 26,
                      left: 0,
                      transform: "translateX(-50%)",
                      color: agentLabel.color,
                    }}
                  >
                    {agentLabel.text}
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
