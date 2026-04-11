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
  // Wrap in a 0×0 div so React-controlled `opacity` is never overridden by the
  // CSS animation (which must only animate `transform`).
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={{
        left: x,
        top: y,
        width: 0,
        height: 0,
        opacity,
        filter: "drop-shadow(0 0 8px rgba(253,224,71,0.55))",
      }}
    >
      <svg
        className="[animation:hammer-crack_280ms_ease-out_forwards]"
        style={{
          position: "absolute",
          left: -27,
          top: -27,
          width: 54,
          height: 54,
          overflow: "visible",
        }}
        viewBox="-27 -27 54 54"
      >
        <polygon
          points="-2,-1 1,-4 4,-1 2,3 -2,4 -5,1"
          fill="rgba(251,191,36,0.22)"
          stroke="rgba(253,230,138,0.55)"
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
    </div>
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
  // The coneAngle from BackgroundField points TOWARD center; flip so fire sprays outward.
  const rad = angle !== undefined ? angle + Math.PI : 0;
  const CONE_DEG = 76;
  const HALF = (CONE_DEG / 2) * (Math.PI / 180);
  const MAX_LEN = 175;
  const N_JETS = 13;
  const SVG = 400;
  const ox = SVG / 2;
  const oy = SVG / 2;

  const jetColors = [
    "rgba(255,255,210,0.94)",
    "rgba(255,200,60,0.90)",
    "rgba(255,130,25,0.85)",
    "rgba(240,75,15,0.78)",
    "rgba(190,45,10,0.70)",
  ];

  const jets = Array.from({ length: N_JETS }, (_, i) => {
    const mix = i / (N_JETS - 1);
    const a = rad - HALF + mix * HALF * 2;
    const centredness = 1 - Math.abs(mix - 0.5) * 2;
    const len = MAX_LEN * (0.48 + centredness * 0.52 + (i % 3) * 0.07);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const size = 13 + centredness * 11 + (i % 3) * 4;
    const colorIdx = Math.min(
      Math.floor(centredness * 2 + (i % 2)),
      jetColors.length - 1,
    );
    return {
      cos,
      sin,
      dx: cos * len,
      dy: sin * len,
      size,
      color: jetColors[colorIdx],
      a,
      len,
    };
  });

  return (
    <>
      {/* Ambient heat cone behind jets */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed [animation:flame-cone-glow_2600ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: MAX_LEN * 1.9,
          height: MAX_LEN * 0.82,
          background:
            "radial-gradient(ellipse at 14% 50%, rgba(255,170,0,0.65) 0%, rgba(255,70,0,0.38) 38%, transparent 70%)",
          transform: `translate(-18%, -50%) rotate(${rad}rad)`,
          filter: "blur(18px)",
          borderRadius: "40%",
          pointerEvents: "none",
        }}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed"
        style={{
          left: x - SVG / 2,
          top: y - SVG / 2,
          width: SVG,
          height: SVG,
          overflow: "visible",
          filter: "drop-shadow(0 0 16px rgba(249,115,22,0.9))",
        }}
        viewBox={`0 0 ${SVG} ${SVG}`}
      >
        {/* Streak lines from origin to each jet tip */}
        {jets.map(({ cos, sin, len, color }, i) => (
          <line
            key={`sk-${i}`}
            x1={ox}
            y1={oy}
            x2={(ox + cos * len * 0.82).toFixed(1)}
            y2={(oy + sin * len * 0.82).toFixed(1)}
            stroke={color}
            strokeWidth={2 + (i % 3)}
            strokeLinecap="round"
            opacity="0"
            style={{
              animation: `flame-streak ${195 + i * 24}ms ease-out forwards`,
              animationDelay: `${i * 12}ms`,
            }}
          />
        ))}
        {/* Fire jet circles: start at origin, travel to destination */}
        {jets.map(({ dx, dy, size, color }, i) => (
          <circle
            key={i}
            cx={ox}
            cy={oy}
            r={size}
            fill={color}
            opacity="0"
            style={
              {
                animation: `flame-jet-travel ${235 + i * 26}ms ease-out forwards`,
                animationDelay: `${i * 12}ms`,
                "--jx": `${dx.toFixed(1)}px`,
                "--jy": `${dy.toFixed(1)}px`,
              } as React.CSSProperties
            }
          />
        ))}
        {/* Embers */}
        {Array.from({ length: 10 }, (_, i) => {
          const a = rad + ((i - 4.5) * (HALF * 1.5)) / 5;
          const dist = 50 + (i % 4) * 22;
          return (
            <circle
              key={`e-${i}`}
              cx={ox}
              cy={oy}
              r={i % 3 === 0 ? 5 : 3}
              fill={i % 2 === 0 ? "#fef3c7" : "#fb923c"}
              opacity="0"
              style={
                {
                  animation: `ember-rise ${390 + i * 36}ms ease-out forwards`,
                  animationDelay: `${i * 20}ms`,
                  "--dx": `${(Math.cos(a) * dist).toFixed(1)}px`,
                  "--dy": `${(Math.sin(a) * dist - 16).toFixed(1)}px`,
                } as React.CSSProperties
              }
            />
          );
        })}
        {/* Hot core at origin */}
        <circle
          cx={ox}
          cy={oy}
          r="22"
          fill="rgba(255,255,230,0.95)"
          style={{
            animation: "flame-core-flash 340ms ease-out forwards",
            transformOrigin: `${ox}px ${oy}px`,
          }}
        />
      </svg>
    </>
  );
}

// ── Plasma Orb: detonation rings + shimmer corona ────────────────────────────

function PlasmaEffect({ x, y }: { x: number; y: number }) {
  return (
    <>
      {/* Charge-up orb — briefly pulses then collapses as the detonation begins */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:plasma-charge_260ms_ease-in_forwards]"
        style={{
          left: x,
          top: y,
          width: 52,
          height: 52,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(56,189,248,0.85) 48%, rgba(14,165,233,0.45) 100%)",
          boxShadow: "0 0 24px 8px rgba(56,189,248,0.75)",
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Central orb flash */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:pulse-expand_900ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 360,
          height: 360,
          background:
            "radial-gradient(circle, rgba(56,189,248,0.55) 0%, rgba(14,165,233,0.28) 35%, transparent 68%)",
          boxShadow: "0 0 60px 16px rgba(56,189,248,0.32)",
          transform: "translate(-50%, -50%)",
          animationDelay: "180ms",
          opacity: 0,
        }}
      />
      {/* Inner bright core */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:shockwave-expand_500ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 80,
          height: 80,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(186,230,253,0.8) 40%, transparent 70%)",
          transform: "translate(-50%, -50%)",
          animationDelay: "180ms",
          opacity: 0,
        }}
      />
      {/* 3 expanding rings */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border-2 border-sky-300/70 [animation:pulse-expand_800ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 260,
          height: 260,
          boxShadow:
            "0 0 18px 4px rgba(56,189,248,0.35), inset 0 0 14px rgba(56,189,248,0.18)",
          transform: "translate(-50%, -50%)",
          animationDelay: "180ms",
          opacity: 0,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border border-cyan-400/55 [animation:pulse-expand_700ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 160,
          height: 160,
          transform: "translate(-50%, -50%)",
          animationDelay: "240ms",
          opacity: 0,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border border-blue-200/45 [animation:pulse-expand_550ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 80,
          height: 80,
          transform: "translate(-50%, -50%)",
          animationDelay: "300ms",
          opacity: 0,
        }}
      />
      {/* Spark spray */}
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed [animation:spark-burst_900ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 1,
          height: 1,
          overflow: "visible",
          filter: "drop-shadow(0 0 5px rgba(56,189,248,0.8))",
        }}
        viewBox="0 0 1 1"
      >
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i * Math.PI * 2) / 10;
          const len = 55 + (i % 3) * 22;
          const jag = len * 0.45;
          const jd = i % 2 === 0 ? 6 : -6;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          const perp = a + Math.PI / 2;
          const mx = cos * jag + Math.cos(perp) * jd;
          const my = sin * jag + Math.sin(perp) * jd;
          return (
            <path
              key={i}
              d={`M 0 0 L ${mx.toFixed(1)} ${my.toFixed(1)} L ${(cos * len).toFixed(1)} ${(sin * len).toFixed(1)}`}
              stroke={i % 2 === 0 ? "#38bdf8" : "#e0f2fe"}
              strokeWidth={i % 3 === 0 ? 2 : 1.4}
              strokeLinecap="round"
              fill="none"
              opacity={0.75 + (i % 3) * 0.08}
            />
          );
        })}
        <circle cx="0" cy="0" r="6" fill="rgba(255,255,255,0.9)" />
      </svg>
    </>
  );
}

// ── Void Nova: chromatic aberration + dark implosion rings ────────────────────

function VoidEffect({ x, y }: { x: number; y: number }) {
  return (
    <>
      {/* Full-screen chromatic flash overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 [animation:screen-flash_180ms_ease-out_forwards]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.12) 0%, transparent 55%)",
          mixBlendMode: "screen",
        }}
      />
      {/* Dark core implosion */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:shockwave-expand_1200ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 480,
          height: 480,
          background:
            "radial-gradient(circle, rgba(15,0,40,0.9) 0%, rgba(88,28,135,0.45) 30%, rgba(124,58,237,0.18) 55%, transparent 70%)",
          boxShadow: "0 0 80px 20px rgba(124,58,237,0.28)",
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* 3 void rings */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border-2 [animation:pulse-expand_1100ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 380,
          height: 380,
          borderColor: "rgba(192,132,252,0.65)",
          boxShadow:
            "0 0 28px 6px rgba(192,132,252,0.22), inset 0 0 20px rgba(124,58,237,0.18)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border [animation:pulse-expand_850ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 220,
          height: 220,
          borderColor: "rgba(167,139,250,0.5)",
          transform: "translate(-50%, -50%)",
          animationDelay: "80ms",
          opacity: 0,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border [animation:pulse-expand_620ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 110,
          height: 110,
          borderColor: "rgba(245,208,254,0.45)",
          transform: "translate(-50%, -50%)",
          animationDelay: "160ms",
          opacity: 0,
        }}
      />
      {/* Void rift cracks */}
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed [animation:shockwave-cracks_1000ms_ease-out_forwards]"
        style={{
          left: x,
          top: y,
          width: 1,
          height: 1,
          overflow: "visible",
          filter: "drop-shadow(0 0 6px rgba(192,132,252,0.7))",
        }}
        viewBox="0 0 1 1"
      >
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI * 2) / 8 + 0.2;
          const len = 70 + (i % 3) * 28;
          const kink = len * 0.42;
          const jog = (i % 2 === 0 ? 1 : -1) * 14;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          const perp = a + Math.PI / 2;
          const mx = cos * kink + Math.cos(perp) * jog;
          const my = sin * kink + Math.sin(perp) * jog;
          const arcLen = len + 20;
          return (
            <path
              key={i}
              d={`M 0 0 L ${mx.toFixed(1)} ${my.toFixed(1)} L ${(cos * len).toFixed(1)} ${(sin * len).toFixed(1)}`}
              stroke={i % 2 === 0 ? "#c084fc" : "#7c3aed"}
              strokeWidth={i % 2 === 0 ? "2.2" : "1.6"}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={arcLen}
              strokeDashoffset={arcLen}
              style={{
                animation: "draw-crack 360ms ease-out forwards",
                animationDelay: `${i * 45}ms`,
              }}
            />
          );
        })}
        <circle cx="0" cy="0" r="8" fill="rgba(76,29,149,0.85)" />
        <circle cx="0" cy="0" r="3" fill="rgba(245,208,254,0.9)" />
      </svg>
    </>
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
          case "freeze":
            return (
              <FreezeEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                angle={effect.angle}
              />
            );
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
          case "flame":
            return (
              <FlameEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                angle={effect.angle}
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
          case "plasma":
            return <PlasmaEffect key={effect.id} x={effect.x} y={effect.y} />;
          case "void":
            return <VoidEffect key={effect.id} x={effect.x} y={effect.y} />;
          default:
            return null;
        }
      })}
    </>
  );
}
