/**
 * WeaponEffectLayer — a full-screen fixed overlay that renders on-screen fire
 * effect animations when the player fires a weapon.
 *
 * Each weapon has a visually distinctive effect — no two effects are just
 * an expanding circle.
 */

import { useEffect, useRef, useState } from "react";
import type { WeaponEffectEvent } from "@game/types";

// ── Wrench impact cracks (persistent) ───────────────────────────────────────

const CRACK_PATHS = [
  { d: "M 0 0 L 3 -4 L 7 -11 L 10 -16", opacity: 0.82, width: 1.9 },
  { d: "M 3 -4 L 1 -8 L -1 -11", opacity: 0.54, width: 1.25 },
  { d: "M 0 0 L -4 3 L -9 8 L -13 11", opacity: 0.76, width: 1.7 },
  { d: "M -4 3 L -3 7 L -6 11", opacity: 0.48, width: 1.15 },
  { d: "M 0 0 L 5 1 L 11 2 L 16 1", opacity: 0.64, width: 1.5 },
  { d: "M 11 2 L 13 6 L 16 9", opacity: 0.42, width: 1.05 },
  { d: "M 0 0 L -1 -4 L -2 -8", opacity: 0.38, width: 1.05 },
];

interface PersistentCrack {
  createdAt: number;
  id: string;
  x: number;
  y: number;
}

const CRACK_LIFETIME_MS = 6500;
const CRACK_MAX_VISIBLE = 4;

function WrenchCrackEffect({
  x,
  y,
  opacity,
}: {
  opacity: number;
  x: number;
  y: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:hammer-crack_320ms_ease-out_forwards]"
      style={{
        left: x,
        top: y,
        width: 54,
        height: 54,
        overflow: "visible",
        transform: "translate(-50%, -50%)",
        opacity,
        filter: "drop-shadow(0 0 5px rgba(251,191,36,0.24))",
      }}
      viewBox="-27 -27 54 54"
    >
      <polygon
        points="-2,-1 1,-4 4,-1 2,3 -2,4 -5,1"
        fill="rgba(251,191,36,0.18)"
        stroke="rgba(253,230,138,0.45)"
        strokeWidth="0.9"
      />
      {CRACK_PATHS.map((segment, i) => (
        <path
          key={i}
          d={segment.d}
          stroke={i < 3 ? "#fbbf24" : "#fde68a"}
          strokeWidth={segment.width}
          strokeLinecap="round"
          fill="none"
          opacity={segment.opacity}
        />
      ))}
    </svg>
  );
}

// ── Bug Zapper: electric spark burst ────────────────────────────────────────

function ZapperEffect({ x, y }: { x: number; y: number }) {
  const arms = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 8;
    const len = 38 + Math.sin(i * 1.3) * 12;
    const kink1 = len * 0.38;
    const kink2 = len * 0.72;
    const jag1 = (i % 2 === 0 ? 1 : -1) * (5 + (i % 3) * 2);
    const jag2 = -jag1 * 0.6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpCos = Math.cos(angle + Math.PI / 2);
    const perpSin = Math.sin(angle + Math.PI / 2);
    const x1 = cos * kink1 + perpCos * jag1;
    const y1 = sin * kink1 + perpSin * jag1;
    const x2 = cos * kink2 + perpCos * jag2;
    const y2 = sin * kink2 + perpSin * jag2;
    const ex = cos * len;
    const ey = sin * len;
    return `M 0 0 L ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  });

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:spark-burst_700ms_ease-out_forwards]"
      style={{
        left: x,
        top: y,
        width: 100,
        height: 100,
        overflow: "visible",
        transform: "translate(-50%, -50%)",
        filter: "drop-shadow(0 0 6px rgba(253,224,71,0.8))",
      }}
      viewBox="-50 -50 100 100"
    >
      {arms.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={i % 2 === 0 ? "#fde047" : "#ffffff"}
          strokeWidth={i % 3 === 0 ? 2 : 1.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.7 + (i % 3) * 0.1}
        />
      ))}
      <circle
        cx="0"
        cy="0"
        r="8"
        fill="rgba(253,224,71,0.25)"
        stroke="#fde047"
        strokeWidth="1.5"
        className="[animation:pulse-expand_500ms_ease-out_forwards]"
        style={{ transformOrigin: "0 0" }}
      />
      <circle cx="0" cy="0" r="2.5" fill="#ffffff" opacity="0.95" />
    </svg>
  );
}

// ── Pulse Cannon: 3 staggered rings + screen flash ───────────────────────────

function PulseRingEffect({ x, y }: { x: number; y: number }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 [animation:screen-flash_280ms_ease-out_forwards]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(56,189,248,0.07) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border-2 border-sky-400/70 [animation:pulse-expand_600ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 360,
          height: 360,
          boxShadow: "0 0 28px 4px rgba(56,189,248,0.28)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border border-cyan-300/50 [animation:pulse-expand_520ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 220,
          height: 220,
          transform: "translate(-50%, -50%)",
          animationDelay: "80ms",
          opacity: 0,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border border-sky-200/40 [animation:pulse-expand_420ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 120,
          height: 120,
          transform: "translate(-50%, -50%)",
          animationDelay: "160ms",
          opacity: 0,
        }}
      />
      {/* Particle spray */}
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed"
        style={{ left: x, top: y, width: 1, height: 1, overflow: "visible" }}
        viewBox="0 0 1 1"
      >
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 6;
          const dist = 90 + (i % 3) * 30;
          const px = (Math.cos(angle) * dist).toFixed(1);
          const py = (Math.sin(angle) * dist).toFixed(1);
          return (
            <rect
              key={i}
              x="-3"
              y="-5"
              width="6"
              height="10"
              rx="2"
              fill={i % 2 === 0 ? "#38bdf8" : "#7dd3fc"}
              opacity="0"
              transform={`rotate(${(angle * 180) / Math.PI})`}
              style={
                {
                  animation: "particle-spray 500ms ease-out forwards",
                  animationDelay: `${i * 35}ms`,
                  // @ts-ignore
                  "--px": `${px}px`,
                  "--py": `${py}px`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </svg>
    </>
  );
}

// ── Debug Pointer: targeting line from click to target ───────────────────────

function PointerEffect({
  color,
  x,
  y,
  targetX,
  targetY,
}: {
  color?: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
}) {
  const accent = color ?? "#f87171";
  const accentRgb = color === "#22d3ee" ? "34,211,238" : "248,113,113";
  const tx = targetX ?? x;
  const ty = targetY ?? y;
  const hasTarget = tx !== x || ty !== y;

  const svgLeft = Math.min(x, tx) - 10;
  const svgTop = Math.min(y, ty) - 10;
  const svgW = Math.abs(tx - x) + 20;
  const svgH = Math.abs(ty - y) + 20;
  const lx1 = x - svgLeft;
  const ly1 = y - svgTop;
  const lx2 = tx - svgLeft;
  const ly2 = ty - svgTop;

  return (
    <>
      {hasTarget ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed [animation:pointer-line-fade_380ms_ease-out_forwards]"
          style={{
            left: svgLeft,
            top: svgTop,
            width: svgW,
            height: svgH,
            overflow: "visible",
          }}
          viewBox={`0 0 ${svgW} ${svgH}`}
        >
          <line
            x1={lx1}
            y1={ly1}
            x2={lx2}
            y2={ly2}
            stroke={accent}
            strokeWidth="1.5"
            strokeDasharray="6 4"
            strokeLinecap="round"
            opacity="0.8"
            filter={`drop-shadow(0 0 3px rgba(${accentRgb},0.6))`}
          />
          {/* Dart that travels from click to target */}
          <circle
            cx={lx2}
            cy={ly2}
            r="5"
            fill={accent}
            style={
              {
                animation: "dart-travel 260ms ease-in forwards",
                // @ts-ignore css custom properties
                "--dx": `${(lx1 - lx2).toFixed(1)}px`,
                "--dy": `${(ly1 - ly2).toFixed(1)}px`,
              } as React.CSSProperties
            }
          />
          <circle
            cx={lx2}
            cy={ly2}
            r="10"
            fill={`rgba(${accentRgb},0.25)`}
            stroke={accent}
            strokeWidth="1.5"
            className="[animation:pulse-expand_320ms_ease-out_forwards]"
            style={{ transformOrigin: `${lx2}px ${ly2}px` }}
          />
          <circle cx={lx2} cy={ly2} r="3" fill={accent} opacity="0.9" />
        </svg>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-full border [animation:pulse-expand_320ms_ease-out_forwards]"
          style={{
            left: x,
            top: y,
            width: 80,
            height: 80,
            borderColor: `${accent}b3`,
            background: `radial-gradient(circle, rgba(${accentRgb},0.35) 0%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </>
  );
}

// ── Freeze Cone: SVG cone + ice shard triangles ──────────────────────────────

function FreezeEffect({
  x,
  y,
  angle,
}: {
  x: number;
  y: number;
  angle?: number;
}) {
  const rad = angle ?? 0;
  const DEPTH = 180;
  const HALF_ARC = Math.PI / 4;
  const leftAngle = rad - HALF_ARC;
  const rightAngle = rad + HALF_ARC;

  const margin = 20;
  const svgLeft = x - DEPTH - margin;
  const svgTop = y - DEPTH - margin;
  const svgSize = (DEPTH + margin) * 2;
  const ox = DEPTH + margin;
  const oy = DEPTH + margin;
  const lx = ox + Math.cos(leftAngle) * DEPTH;
  const ly = oy + Math.sin(leftAngle) * DEPTH;
  const rx = ox + Math.cos(rightAngle) * DEPTH;
  const ry = oy + Math.sin(rightAngle) * DEPTH;
  const conePath = `M ${ox} ${oy} L ${lx.toFixed(1)} ${ly.toFixed(1)} A ${DEPTH} ${DEPTH} 0 0 1 ${rx.toFixed(1)} ${ry.toFixed(1)} Z`;

  const shards = Array.from({ length: 7 }, (_, i) => {
    const shardAngle = leftAngle + ((i + 0.5) * (HALF_ARC * 2)) / 7;
    const dist = 30 + i * 20;
    const size = 7 + (i % 3) * 4;
    const sx = ox + Math.cos(shardAngle) * dist;
    const sy = oy + Math.sin(shardAngle) * dist;
    const rot = (shardAngle * 180) / Math.PI + 90;
    return { sx, sy, size, rot };
  });

  const sparkles = Array.from({ length: 5 }, (_, i) => {
    const a = leftAngle + ((i + 1) * (HALF_ARC * 2)) / 6;
    const d = 50 + (i % 3) * 30;
    return {
      cx: ox + Math.cos(a) * d,
      cy: oy + Math.sin(a) * d,
      r: 3 + (i % 2) * 2,
    };
  });

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:freeze-cone-fade_700ms_ease-out_forwards]"
      style={{
        left: svgLeft,
        top: svgTop,
        width: svgSize,
        height: svgSize,
        overflow: "visible",
      }}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
    >
      <path
        d={conePath}
        fill="rgba(186,230,253,0.22)"
        stroke="rgba(147,210,255,0.55)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="drop-shadow(0 0 8px rgba(186,230,253,0.4))"
      />
      {shards.map((s, i) => (
        <g
          key={i}
          transform={`translate(${s.sx.toFixed(1)},${s.sy.toFixed(1)}) rotate(${s.rot.toFixed(1)})`}
          style={
            {
              animation: "sparkle-appear 500ms ease-out forwards",
              animationDelay: `${i * 65}ms`,
              opacity: 0,
            } as React.CSSProperties
          }
        >
          <polygon
            points={`0,${-s.size} ${s.size * 0.4},${s.size * 0.5} ${-s.size * 0.4},${s.size * 0.5}`}
            fill={
              i % 2 === 0 ? "rgba(224,242,254,0.7)" : "rgba(147,210,255,0.55)"
            }
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.8"
          />
        </g>
      ))}
      {sparkles.map((sp, i) => (
        <circle
          key={`sp-${i}`}
          cx={sp.cx}
          cy={sp.cy}
          r={sp.r}
          fill="#e0f2fe"
          opacity="0"
          style={
            {
              animation: "sparkle-appear 420ms ease-out forwards",
              animationDelay: `${i * 50 + 80}ms`,
            } as React.CSSProperties
          }
        />
      ))}
      <circle cx={ox} cy={oy} r="4" fill="#bfdbfe" opacity="0.85" />
    </svg>
  );
}

// ── Chain Zap: double-bolt arcs with stable jag offsets + draw animation ─────

function ChainEffect({
  x,
  y,
  chainNodes,
  jagOffsets,
}: {
  x: number;
  y: number;
  chainNodes?: Array<{ x: number; y: number }>;
  jagOffsets?: number[];
}) {
  const nodes = chainNodes && chainNodes.length > 1 ? chainNodes : null;

  if (!nodes) {
    return (
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed [animation:chain-flicker_900ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 80,
          height: 80,
          overflow: "visible",
          transform: "translate(-50%, -50%)",
          filter: "drop-shadow(0 0 6px rgba(110,231,183,0.7))",
        }}
        viewBox="-40 -40 80 80"
      >
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI * 2) / 6;
          return (
            <line
              key={i}
              x1="0"
              y1="0"
              x2={(Math.cos(a) * 28).toFixed(1)}
              y2={(Math.sin(a) * 28).toFixed(1)}
              stroke="#6ee7b7"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.8"
            />
          );
        })}
        <circle cx="0" cy="0" r="4" fill="#6ee7b7" opacity="0.95" />
      </svg>
    );
  }

  const svgLeft = Math.min(...nodes.map((n) => n.x)) - 24;
  const svgTop = Math.min(...nodes.map((n) => n.y)) - 24;
  const svgWidth = Math.max(...nodes.map((n) => n.x)) - svgLeft + 48;
  const svgHeight = Math.max(...nodes.map((n) => n.y)) - svgTop + 48;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={{
        left: svgLeft,
        top: svgTop,
        width: svgWidth,
        height: svgHeight,
        overflow: "visible",
        /* overall fade: draw in over 700ms then flicker-fade over 500ms */
        animation: "chain-flicker 1200ms ease-out 200ms forwards",
      }}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
    >
      {nodes.slice(1).map((node, i) => {
        const from = nodes[i];
        const fx = from.x - svgLeft;
        const fy = from.y - svgTop;
        const tx = node.x - svgLeft;
        const ty = node.y - svgTop;
        const mx = (fx + tx) / 2 + (jagOffsets ? (jagOffsets[i * 2] ?? 0) : 0);
        const my =
          (fy + ty) / 2 + (jagOffsets ? (jagOffsets[i * 2 + 1] ?? 0) : 0);
        const dx = tx - fx;
        const dy = ty - fy;
        const len = Math.hypot(dx, dy) || 1;
        const px = (-dy / len) * 3;
        const py = (dx / len) * 3;
        const approxLen = len + 50; // generous dasharray so bolt draws fully
        return (
          <g key={i}>
            {/* Primary bolt: draws in then flickers */}
            <path
              d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
              stroke="#6ee7b7"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.9"
              filter="drop-shadow(0 0 5px rgba(110,231,183,0.8))"
              strokeDasharray={approxLen}
              strokeDashoffset={approxLen}
              style={{
                animation: `chain-bolt-draw ${280 + i * 60}ms ease-out forwards`,
              }}
            />
            {/* Halo bolt (offset) */}
            <path
              d={`M ${fx + px} ${fy + py} Q ${mx + px} ${my + py} ${tx + px} ${ty + py}`}
              stroke="#a7f3d0"
              strokeWidth="1"
              strokeLinecap="round"
              fill="none"
              opacity="0.55"
              strokeDasharray={approxLen}
              strokeDashoffset={approxLen}
              style={{
                animation: `chain-bolt-draw ${320 + i * 60}ms ease-out forwards`,
              }}
            />
          </g>
        );
      })}
      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          <circle
            cx={node.x - svgLeft}
            cy={node.y - svgTop}
            r={i === 0 ? 9 : 6}
            fill={i === 0 ? "rgba(110,231,183,0.22)" : "rgba(167,243,208,0.18)"}
            filter="drop-shadow(0 0 4px rgba(110,231,183,0.5))"
          />
          <circle
            cx={node.x - svgLeft}
            cy={node.y - svgTop}
            r={i === 0 ? 5 : 3}
            fill={i === 0 ? "#6ee7b7" : "#a7f3d0"}
            opacity="0.95"
          />
        </g>
      ))}
      {/* Y-fork branches from the last node */}
      {(() => {
        if (nodes.length < 2) return null;
        const last = nodes[nodes.length - 1];
        const prev = nodes[nodes.length - 2];
        const lx = last.x - svgLeft;
        const ly = last.y - svgTop;
        const inAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
        const FORK_LEN = 28;
        return [inAngle - 0.5, inAngle + 0.5].map((a, fi) => (
          <line
            key={`fork-${fi}`}
            x1={lx}
            y1={ly}
            x2={(lx + Math.cos(a) * FORK_LEN).toFixed(1)}
            y2={(ly + Math.sin(a) * FORK_LEN).toFixed(1)}
            stroke="#a7f3d0"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
            strokeDasharray={FORK_LEN + 4}
            strokeDashoffset={FORK_LEN + 4}
            style={{
              animation: `chain-bolt-draw 400ms ease-out ${nodes.length * 60}ms forwards`,
            }}
          />
        ));
      })()}
    </svg>
  );
}

// ── Directional Laser: beam with glow halo ───────────────────────────────────

function LaserBeamEffect({
  x,
  y,
  angle,
}: {
  x: number;
  y: number;
  angle?: number;
}) {
  const rad = angle ?? 0;
  const length = Math.max(window.innerWidth, window.innerHeight) * 1.5;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x1 = x - cos * length;
  const y1 = y - sin * length;
  const x2 = x + cos * length;
  const y2 = y + sin * length;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 [animation:laser-beam-fade_320ms_ease-out_forwards]"
      style={{
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        overflow: "visible",
      }}
      viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgba(248,113,113,0.18)"
        strokeWidth="14"
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#f87171"
        strokeWidth="3"
        filter="drop-shadow(0 0 5px rgba(248,113,113,0.7))"
        strokeLinecap="round"
      />
      <circle
        cx={x}
        cy={y}
        r="5"
        fill="#fff"
        opacity="0.8"
        filter="drop-shadow(0 0 6px rgba(248,113,113,1))"
      />
    </svg>
  );
}

// ── Pixel Bomb: radial glow + debris shards ──────────────────────────────────

function BombEffect({ x, y }: { x: number; y: number }) {
  const shards = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 12 + (i % 3) * 0.18;
    const dist = 60 + (i % 4) * 30;
    const size = 6 + (i % 3) * 4;
    const bx = Math.cos(angle) * dist;
    const by = Math.sin(angle) * dist;
    return { angle, size, bx, by };
  });

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:shockwave-expand_1000ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 440,
          height: 440,
          background:
            "radial-gradient(circle, rgba(251,146,60,0.42) 0%, rgba(239,68,68,0.18) 45%, transparent 70%)",
          boxShadow: "0 0 70px 16px rgba(251,146,60,0.28)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed [animation:bomb-debris_900ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 300,
          height: 300,
          overflow: "visible",
          transform: "translate(-50%, -50%)",
        }}
        viewBox="-150 -150 300 300"
      >
        {shards.map((s, i) => (
          <g
            key={i}
            transform={`translate(${s.bx.toFixed(1)},${s.by.toFixed(1)}) rotate(${((s.angle * 180) / Math.PI + 90).toFixed(1)})`}
          >
            <polygon
              points={`0,${-s.size} ${s.size * 0.45},${s.size * 0.6} ${-s.size * 0.45},${s.size * 0.6}`}
              fill={
                i % 3 === 0 ? "#fb923c" : i % 3 === 1 ? "#fbbf24" : "#ef4444"
              }
              opacity={0.6 + (i % 3) * 0.13}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.5"
            />
          </g>
        ))}
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border-2 border-orange-400/45 [animation:pulse-expand_800ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 200,
          height: 200,
          transform: "translate(-50%, -50%)",
        }}
      />
    </>
  );
}

// ── Shockwave: crack lines radiating outward + double rings ──────────────────

function ShockwaveRingEffect({ x, y }: { x: number; y: number }) {
  const cracks = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 6 + 0.26;
    const len = 80 + (i % 2) * 40;
    const kink = len * 0.45;
    const jag = (i % 2 === 0 ? 1 : -1) * 12;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const kx = cos * kink + Math.cos(angle + Math.PI / 2) * jag;
    const ky = sin * kink + Math.sin(angle + Math.PI / 2) * jag;
    const ex = cos * len;
    const ey = sin * len;
    return `M 0 0 L ${kx.toFixed(1)} ${ky.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  });

  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed [animation:shockwave-cracks_900ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 240,
          height: 240,
          overflow: "visible",
          transform: "translate(-50%, -50%)",
          filter: "drop-shadow(0 0 4px rgba(167,139,250,0.6))",
        }}
        viewBox="-120 -120 240 240"
      >
        {cracks.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke={i % 2 === 0 ? "#a78bfa" : "#c4b5fd"}
            strokeWidth={i % 2 === 0 ? "2" : "1.5"}
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
            strokeDasharray="150"
            strokeDashoffset="150"
            style={{
              animation: "draw-crack 280ms ease-out forwards",
              animationDelay: `${i * 55}ms`,
            }}
          />
        ))}
        <circle cx="0" cy="0" r="6" fill="#a78bfa" opacity="0.7" />
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border-2 border-violet-400/60 [animation:shockwave-expand_900ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 500,
          height: 500,
          boxShadow: "0 0 36px 8px rgba(167,139,250,0.25)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border border-violet-300/45 [animation:shockwave-expand_700ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 280,
          height: 280,
          animationDelay: "80ms",
          transform: "translate(-50%, -50%)",
        }}
      />
    </>
  );
}

// ── Null Pointer: targeting beam + impact explosion at bug ───────────────────

function NullPointerEffect({
  x,
  y,
  targetX,
  targetY,
}: {
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
}) {
  const tx = targetX ?? x;
  const ty = targetY ?? y;
  const hasTarget = tx !== x || ty !== y;

  const svgLeft = Math.min(x, tx) - 16;
  const svgTop = Math.min(y, ty) - 16;
  const svgW = Math.abs(tx - x) + 32;
  const svgH = Math.abs(ty - y) + 32;
  const lx1 = x - svgLeft;
  const ly1 = y - svgTop;
  const lx2 = tx - svgLeft;
  const ly2 = ty - svgTop;

  return (
    <>
      {hasTarget && (
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed [animation:pointer-line-fade_500ms_ease-out_forwards]"
          style={{
            left: svgLeft,
            top: svgTop,
            width: svgW,
            height: svgH,
            overflow: "visible",
          }}
          viewBox={`0 0 ${svgW} ${svgH}`}
        >
          <line
            x1={lx1}
            y1={ly1}
            x2={lx2}
            y2={ly2}
            stroke="rgba(251,113,133,0.2)"
            strokeWidth="8"
          />
          <line
            x1={lx1}
            y1={ly1}
            x2={lx2}
            y2={ly2}
            stroke="#fb7185"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.9"
            filter="drop-shadow(0 0 3px rgba(251,113,133,0.7))"
          />
          <circle
            cx={lx2}
            cy={ly2}
            r="14"
            fill="none"
            stroke="#fb7185"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1={lx2 - 20}
            y1={ly2}
            x2={lx2 - 8}
            y2={ly2}
            stroke="#fb7185"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <line
            x1={lx2 + 8}
            y1={ly2}
            x2={lx2 + 20}
            y2={ly2}
            stroke="#fb7185"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <line
            x1={lx2}
            y1={ly2 - 20}
            x2={lx2}
            y2={ly2 - 8}
            stroke="#fb7185"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <line
            x1={lx2}
            y1={ly2 + 8}
            x2={lx2}
            y2={ly2 + 20}
            stroke="#fb7185"
            strokeWidth="1.5"
            opacity="0.7"
          />
        </svg>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:shockwave-expand_1200ms_ease-out_forwards]"
        style={{
          left: tx,
          top: ty,
          width: 320,
          height: 320,
          background:
            "radial-gradient(circle, rgba(251,113,133,0.35) 0%, rgba(244,63,94,0.12) 50%, transparent 70%)",
          boxShadow: "0 0 50px 12px rgba(251,113,133,0.22)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border-2 border-rose-400/55 [animation:pulse-expand_900ms_ease-out_forwards]"
        style={{
          left: tx,
          top: ty,
          width: 140,
          height: 140,
          transform: "translate(-50%, -50%)",
        }}
      />
    </>
  );
}

// ── Flame: napalm cone burst ──────────────────────────────────────────────────

function FlameEffect({
  x,
  y,
  angle,
}: {
  x: number;
  y: number;
  angle?: number;
}) {
  const rad = angle ?? 0;
  const DEPTH = 148;
  const HALF_ARC = (Math.PI * 34) / 180;
  const NUM_TONGUES = 9;
  const svgSize = 320;
  const ox = svgSize / 2;
  const oy = 160;
  const forwardGlowX = x + Math.cos(rad) * 54;
  const forwardGlowY = y + Math.sin(rad) * 54;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:fire-flicker_320ms_ease-out_forwards]"
        style={{
          left: forwardGlowX,
          top: forwardGlowY,
          width: 210,
          height: 118,
          background:
            "radial-gradient(ellipse at 28% 50%, rgba(254,240,138,0.55) 0%, rgba(251,191,36,0.34) 18%, rgba(249,115,22,0.18) 42%, transparent 72%)",
          boxShadow: "0 0 36px 10px rgba(249,115,22,0.22)",
          filter: "blur(7px)",
          transform: `translate(-50%, -50%) rotate(${rad}rad)`,
          transformOrigin: "center",
        }}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed"
        style={{
          left: x - svgSize / 2,
          top: y - svgSize / 2,
          width: svgSize,
          height: svgSize,
          overflow: "visible",
          filter: "drop-shadow(0 0 10px rgba(249,115,22,0.56))",
        }}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
      >
        {Array.from({ length: NUM_TONGUES }, (_, i) => {
          const spread = HALF_ARC * 2;
          const mix = i / (NUM_TONGUES - 1);
          const a = rad - HALF_ARC + mix * spread;
          const tipLen = DEPTH * (0.76 + (i % 4) * 0.08);
          const halfWidth =
            10 +
            (NUM_TONGUES - Math.abs(i - (NUM_TONGUES - 1) / 2) * 1.7) * 2.4;
          const tx = ox + Math.cos(a) * tipLen;
          const ty = oy + Math.sin(a) * tipLen;
          const leftBaseX = ox + Math.cos(a - 1.48) * halfWidth;
          const leftBaseY = oy + Math.sin(a - 1.48) * halfWidth;
          const rightBaseX = ox + Math.cos(a + 1.48) * halfWidth;
          const rightBaseY = oy + Math.sin(a + 1.48) * halfWidth;
          const leftCtrl1X = ox + Math.cos(a - 0.42) * (tipLen * 0.28);
          const leftCtrl1Y = oy + Math.sin(a - 0.42) * (tipLen * 0.28);
          const leftCtrl2X = ox + Math.cos(a - 0.14) * (tipLen * 0.8);
          const leftCtrl2Y = oy + Math.sin(a - 0.14) * (tipLen * 0.8);
          const rightCtrl2X = ox + Math.cos(a + 0.14) * (tipLen * 0.78);
          const rightCtrl2Y = oy + Math.sin(a + 0.14) * (tipLen * 0.78);
          const rightCtrl1X = ox + Math.cos(a + 0.42) * (tipLen * 0.28);
          const rightCtrl1Y = oy + Math.sin(a + 0.42) * (tipLen * 0.28);
          const fill =
            i % 3 === 0
              ? "rgba(254,240,138,0.88)"
              : i % 2 === 0
                ? "rgba(251,191,36,0.8)"
                : "rgba(249,115,22,0.74)";

          return (
            <path
              key={i}
              d={
                `M ${leftBaseX.toFixed(1)} ${leftBaseY.toFixed(1)} ` +
                `C ${leftCtrl1X.toFixed(1)} ${leftCtrl1Y.toFixed(1)} ${leftCtrl2X.toFixed(1)} ${leftCtrl2Y.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} ` +
                `C ${rightCtrl2X.toFixed(1)} ${rightCtrl2Y.toFixed(1)} ${rightCtrl1X.toFixed(1)} ${rightCtrl1Y.toFixed(1)} ${rightBaseX.toFixed(1)} ${rightBaseY.toFixed(1)} Z`
              }
              fill={fill}
              opacity={0.46 + (i % 4) * 0.12}
              style={{
                animation: `flame-tongue ${280 + i * 28}ms ease-out forwards`,
                animationDelay: `${i * 16}ms`,
                transformOrigin: `${ox}px ${oy}px`,
              }}
            />
          );
        })}
        {Array.from({ length: 10 }, (_, i) => {
          const a = rad + (i - 4.5) * 0.08;
          const dist = 50 + (i % 5) * 18;
          const cx = ox + Math.cos(a) * dist;
          const cy = oy + Math.sin(a) * dist - (i % 3) * 8;
          return (
            <circle
              key={`ember-${i}`}
              cx={cx}
              cy={cy}
              r={i % 3 === 0 ? 4 : 2.5}
              fill={
                i % 2 === 0 ? "rgba(254,240,138,0.9)" : "rgba(251,146,60,0.82)"
              }
              opacity="0"
              style={
                {
                  animation: `ember-rise ${420 + i * 40}ms ease-out forwards`,
                  animationDelay: `${i * 22}ms`,
                  "--dx": `${(Math.cos(a) * (20 + i * 2)).toFixed(1)}px`,
                  "--dy": `${(-18 - (i % 4) * 10).toFixed(1)}px`,
                } as React.CSSProperties
              }
            />
          );
        })}
        <ellipse
          cx={ox}
          cy={oy}
          rx="20"
          ry="12"
          fill="rgba(254,240,138,0.7)"
          style={{
            animation: "flame-tongue 260ms ease-out forwards",
            transformOrigin: `${ox}px ${oy}px`,
          }}
        />
        <ellipse
          cx={ox + Math.cos(rad) * 16}
          cy={oy + Math.sin(rad) * 16}
          rx="11"
          ry="8"
          fill="rgba(255,255,255,0.45)"
          style={{
            animation: "flame-tongue 220ms ease-out forwards",
            transformOrigin: `${ox}px ${oy}px`,
          }}
        />
      </svg>
    </>
  );
}

// ── Stomp: massive boot-print impact + shockwave ring ────────────────────────

function StompEffect({ x, y }: { x: number; y: number }) {
  return (
    <>
      {/* Ground shockwave */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:stomp-land_800ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 380,
          height: 380,
          background:
            "radial-gradient(circle, rgba(163,230,53,0.38) 0%, rgba(132,204,22,0.15) 40%, transparent 70%)",
          boxShadow: "0 0 60px 16px rgba(163,230,53,0.25)",
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Outer ring */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border-2 border-lime-400/55 [animation:pulse-expand_700ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 420,
          height: 420,
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Debris shards radial */}
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed [animation:bomb-debris_800ms_ease-out_forwards]"
        style={{ left: x, top: y, width: 1, height: 1, overflow: "visible" }}
        viewBox="0 0 1 1"
      >
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i * Math.PI * 2) / 10 + i * 0.12;
          const dist = 80 + (i % 4) * 25;
          const size = 5 + (i % 3) * 3;
          const px = (Math.cos(a) * dist).toFixed(1);
          const py = (Math.sin(a) * dist).toFixed(1);
          return (
            <rect
              key={i}
              x={-size / 2}
              y={-size / 2}
              width={size}
              height={size}
              rx="1"
              fill={i % 2 === 0 ? "#a3e635" : "#84cc16"}
              opacity={0.65 + (i % 3) * 0.1}
              transform={`translate(${px},${py}) rotate(${i * 36})`}
            />
          );
        })}
      </svg>
    </>
  );
}

// ── Swatter: wide arc sweep stroke ───────────────────────────────────────────

function SwatterEffect({
  x,
  y,
  angle,
}: {
  x: number;
  y: number;
  angle?: number;
}) {
  const rad = angle ?? 0;
  const HALF_ARC = (Math.PI * 60) / 180; // 120° / 2
  const RADIUS = 70;

  const startAngle = rad - HALF_ARC;
  const endAngle = rad + HALF_ARC;
  const sx = Math.cos(startAngle) * RADIUS;
  const sy = Math.sin(startAngle) * RADIUS;
  const ex = Math.cos(endAngle) * RADIUS;
  const ey = Math.sin(endAngle) * RADIUS;
  const arcPath = `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${RADIUS} ${RADIUS} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  const arcLen = RADIUS * HALF_ARC * 2 * 1.05;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={{
        left: x,
        top: y,
        width: 1,
        height: 1,
        overflow: "visible",
        filter: "drop-shadow(0 0 6px rgba(252,211,77,0.7))",
      }}
      viewBox="0 0 1 1"
    >
      {/* Thick glow arc */}
      <path
        d={arcPath}
        stroke="rgba(252,211,77,0.3)"
        strokeWidth="18"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={arcLen}
        strokeDashoffset={arcLen}
        style={{ animation: `swatter-sweep 280ms ease-out forwards` }}
      />
      {/* Core arc */}
      <path
        d={arcPath}
        stroke="#fcd34d"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={arcLen}
        strokeDashoffset={arcLen}
        style={{ animation: `swatter-sweep 240ms ease-out forwards` }}
      />
      {/* Impact flash at click point */}
      <circle cx="0" cy="0" r="6" fill="rgba(252,211,77,0.5)" />
    </svg>
  );
}

// ── Layer component ──────────────────────────────────────────────

interface WeaponEffectLayerProps {
  effects: WeaponEffectEvent[];
}

export default function WeaponEffectLayer({ effects }: WeaponEffectLayerProps) {
  const seenWrenchEventIdsRef = useRef<Set<string>>(new Set());
  const [persistentCracks, setPersistentCracks] = useState<PersistentCrack[]>(
    [],
  );

  useEffect(() => {
    const wrenchEvents = effects.filter((effect) => effect.weapon === "wrench");
    if (wrenchEvents.length === 0) {
      return;
    }

    setPersistentCracks((previous) => {
      const additions: PersistentCrack[] = [];
      for (const event of wrenchEvents) {
        if (seenWrenchEventIdsRef.current.has(event.id)) {
          continue;
        }
        seenWrenchEventIdsRef.current.add(event.id);
        additions.push({
          createdAt: event.startedAt,
          id: event.id,
          x: event.x,
          y: event.y,
        });
      }

      if (additions.length === 0) {
        return previous;
      }

      const now = performance.now();
      const merged = [...previous, ...additions].filter(
        (crack) => now - crack.createdAt <= CRACK_LIFETIME_MS,
      );

      if (merged.length <= CRACK_MAX_VISIBLE) {
        return merged;
      }

      return merged.slice(-CRACK_MAX_VISIBLE);
    });
  }, [effects]);

  useEffect(() => {
    if (persistentCracks.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      setPersistentCracks((previous) =>
        previous.filter((crack) => now - crack.createdAt <= CRACK_LIFETIME_MS),
      );
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [persistentCracks.length]);

  if (effects.length === 0 && persistentCracks.length === 0) return null;

  const now = performance.now();

  return (
    <>
      {persistentCracks.map((crack, index) => {
        const age = now - crack.createdAt;
        const lifeProgress = Math.min(1, age / CRACK_LIFETIME_MS);
        const rankProgress =
          persistentCracks.length <= 1
            ? 0
            : index / (persistentCracks.length - 1);
        const opacity = Math.max(
          0.08,
          (1 - lifeProgress) * (0.25 + rankProgress * 0.75),
        );

        return (
          <WrenchCrackEffect
            key={crack.id}
            x={crack.x}
            y={crack.y}
            opacity={opacity}
          />
        );
      })}

      {effects.map((effect) => {
        switch (effect.weapon) {
          case "wrench":
            return null; // handled by persistentCracks above
          case "zapper":
            return <ZapperEffect key={effect.id} x={effect.x} y={effect.y} />;
          case "pulse":
            return (
              <PulseRingEffect key={effect.id} x={effect.x} y={effect.y} />
            );
          case "pointer":
            return (
              <PointerEffect
                key={effect.id}
                color={effect.color}
                x={effect.x}
                y={effect.y}
                targetX={effect.targetX}
                targetY={effect.targetY}
              />
            );
          case "freeze":
            return <FreezeEffect key={effect.id} x={effect.x} y={effect.y} />;
          case "chain":
            return (
              <ChainEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                chainNodes={effect.chainNodes}
                jagOffsets={effect.jagOffsets}
              />
            );
          case "laser":
            return (
              <LaserBeamEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                angle={effect.angle}
              />
            );
          case "bomb":
            return <BombEffect key={effect.id} x={effect.x} y={effect.y} />;
          case "shockwave":
            return (
              <ShockwaveRingEffect key={effect.id} x={effect.x} y={effect.y} />
            );
          case "nullpointer":
            return (
              <NullPointerEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                targetX={effect.targetX}
                targetY={effect.targetY}
              />
            );
          case "flame":
            return (
              <FlameEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                angle={effect.angle}
              />
            );
          case "stomp":
            return <StompEffect key={effect.id} x={effect.x} y={effect.y} />;
          case "swatter":
            return (
              <SwatterEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                angle={effect.angle}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
