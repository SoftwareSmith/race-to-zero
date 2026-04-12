/**
 * WeaponEffectLayer — a full-screen fixed overlay that renders on-screen fire
 * effect animations when the player fires a weapon.
 *
 * Each weapon has a visually distinctive effect — no two effects are just
 * an expanding circle.
 */

import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WeaponEffectEvent } from "@game/types";

// ── Freeze Blast: expanding ice ring + fade ──────────────────────────────────

function FreezeEffect({ x, y }: { x: number; y: number; angle?: number }) {
  const R = 180;
  const margin = 12;
  const svgSize = (R + margin) * 2;
  const cx = R + margin;
  const cy = R + margin;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:freeze-radial-fade_700ms_ease-out_forwards]"
      style={{
        left: x - (R + margin),
        top: y - (R + margin),
        width: svgSize,
        height: svgSize,
        overflow: "visible",
      }}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
    >
      {/* Outer expanding ring */}
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="rgba(147,197,253,0.08)"
        stroke="rgba(147,197,253,0.65)"
        strokeWidth="2"
        filter="drop-shadow(0 0 8px rgba(147,197,253,0.5))"
      />
      {/* Mid ring */}
      <circle
        cx={cx}
        cy={cy}
        r={R * 0.55}
        fill="rgba(186,230,253,0.10)"
        stroke="rgba(186,230,253,0.4)"
        strokeWidth="1.5"
      />
      {/* Core burst */}
      <circle
        cx={cx}
        cy={cy}
        r={18}
        fill="rgba(224,242,254,0.35)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1"
        filter="drop-shadow(0 0 5px rgba(186,230,253,0.8))"
      />
      {/* 8 ice shard radials */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const len = 24 + (i % 3) * 8;
        const x1 = cx + Math.cos(a) * 20;
        const y1 = cy + Math.sin(a) * 20;
        const x2 = cx + Math.cos(a) * (20 + len);
        const y2 = cy + Math.sin(a) * (20 + len);
        return (
          <line
            key={i}
            x1={x1.toFixed(1)}
            y1={y1.toFixed(1)}
            x2={x2.toFixed(1)}
            y2={y2.toFixed(1)}
            stroke="rgba(186,230,253,0.55)"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={
              {
                animation: `sparkle-appear 400ms ease-out forwards`,
                animationDelay: `${i * 30}ms`,
                opacity: 0,
              } as CSSProperties
            }
          />
        );
      })}
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

// ── Tracer Bloom: linked route of pulse blooms ───────────────────────────────

function TracerBloomEffect({
  x,
  y,
  chainNodes,
}: {
  x: number;
  y: number;
  chainNodes?: Array<{ x: number; y: number }>;
}) {
  const nodes = chainNodes && chainNodes.length > 0 ? chainNodes : [{ x, y }];
  const allX = nodes.map((node) => node.x);
  const allY = nodes.map((node) => node.y);
  const svgLeft = Math.min(...allX) - 48;
  const svgTop = Math.min(...allY) - 48;
  const svgW = Math.max(...allX) - svgLeft + 96;
  const svgH = Math.max(...allY) - svgTop + 96;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:laser-beam-fade_520ms_ease-out_forwards]"
      style={{
        left: svgLeft,
        top: svgTop,
        width: svgW,
        height: svgH,
        overflow: "visible",
      }}
      viewBox={`0 0 ${svgW} ${svgH}`}
    >
      {nodes.map((node, index) => {
        const cx = node.x - svgLeft;
        const cy = node.y - svgTop;
        const radius = 16 + index * 1.5;
        return (
          <g key={index}>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="rgba(251,113,133,0.14)"
              stroke="rgba(251,113,133,0.55)"
              strokeWidth="1.5"
            />
            <circle
              cx={cx}
              cy={cy}
              r="5"
              fill="#ffe4e6"
              filter="drop-shadow(0 0 8px rgba(251,113,133,0.95))"
            />
          </g>
        );
      })}
    </svg>
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

// ── Void Pulse: animated spinning black hole ──────────────────────────────────

function VoidPulseEffect({ x, y }: { x: number; y: number }) {
  // Use a full-screen fixed inset-0 wrapper so the outer element has real
  // viewport dimensions. A zero-size fixed element (width/height 0) can lose
  // its viewport anchor in Chrome's compositing model when WebGL canvas
  // siblings are present, causing the effect to scroll with the page.
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
      {/* Anchor point at the click position; animation applied here */}
      <div
        className="[animation:void-field-pulse_2200ms_ease-out_forwards]"
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 0,
          height: 0,
          overflow: "visible",
        }}
      >
        {/* Outer gravitational field */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            left: -300,
            top: -300,
            borderRadius: "50%",
            pointerEvents: "none",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(76,29,149,0.08) 45%, transparent 70%)",
          }}
        />
        {/* Outer accretion ring – slow spin */}
        <div
          style={{
            position: "absolute",
            width: 180,
            height: 180,
            left: -90,
            top: -90,
            borderRadius: "50%",
            border: "1.5px dashed rgba(167,139,250,0.5)",
            boxShadow: "0 0 24px rgba(139,92,246,0.3)",
            pointerEvents: "none",
            animation: "agent-ring-spin 2.5s linear infinite",
          }}
        />
        {/* Inner accretion ring – fast reverse spin */}
        <div
          style={{
            position: "absolute",
            width: 110,
            height: 110,
            left: -55,
            top: -55,
            borderRadius: "50%",
            border: "2px dashed rgba(192,132,252,0.65)",
            boxShadow: "0 0 14px rgba(147,51,234,0.4)",
            pointerEvents: "none",
            animation: "agent-ring-spin 1.4s linear infinite reverse",
          }}
        />
        {/* Photon ring glow */}
        <div
          style={{
            position: "absolute",
            width: 66,
            height: 66,
            left: -33,
            top: -33,
            borderRadius: "50%",
            pointerEvents: "none",
            boxShadow:
              "0 0 0 2.5px rgba(192,132,252,0.9), 0 0 18px rgba(147,51,234,0.7), 0 0 40px rgba(124,58,237,0.3)",
            animation: "structure-pulse 0.8s ease-in-out infinite",
          }}
        />
        {/* Hard black core */}
        <div
          style={{
            position: "absolute",
            width: 44,
            height: 44,
            left: -22,
            top: -22,
            borderRadius: "50%",
            pointerEvents: "none",
            background:
              "radial-gradient(circle, #000 55%, rgba(76,29,149,0.8) 100%)",
            boxShadow: "0 0 22px rgba(124,58,237,0.7)",
          }}
        />
      </div>
    </div>
  );
}

// ── Static Net: expanding wire mesh ring ──────────────────────────────────────

function StaticNetEffect({ x, y }: { x: number; y: number }) {
  const R = 200;
  const margin = 20;
  const svgSize = (R + margin) * 2;
  const cx = R + margin;
  const cy = R + margin;
  const spokes = 10;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:shockwave-expand_800ms_ease-out_forwards]"
      style={{
        left: x - cx,
        top: y - cy,
        width: svgSize,
        height: svgSize,
        overflow: "visible",
        opacity: 0.9,
      }}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
    >
      {/* Spokes */}
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i / spokes) * Math.PI * 2;
        return (
          <line
            key={`spoke-${i}`}
            x1={cx}
            y1={cy}
            x2={(cx + Math.cos(a) * R).toFixed(1)}
            y2={(cy + Math.sin(a) * R).toFixed(1)}
            stroke="rgba(226,232,240,0.65)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        );
      })}
      {/* Concentric rings */}
      {[1 / 3, 2 / 3, 1].map((frac, i) => (
        <circle
          key={`ring-${i}`}
          cx={cx}
          cy={cy}
          r={R * frac}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
        />
      ))}
      {/* Outer glow ring */}
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="rgba(148,163,184,0.7)"
        strokeWidth="2.5"
        filter="drop-shadow(0 0 6px rgba(148,163,184,0.6))"
      />
    </svg>
  );
}

// ── Fork Bomb: clustered duplicate detonations ───────────────────────────────

function ForkBombEffect({
  x,
  y,
  chainNodes,
}: {
  x: number;
  y: number;
  chainNodes?: Array<{ x: number; y: number }>;
}) {
  const nodes = chainNodes && chainNodes.length > 0 ? chainNodes : [{ x, y }];
  const allX = nodes.map((node) => node.x);
  const allY = nodes.map((node) => node.y);
  const svgLeft = Math.min(...allX) - 56;
  const svgTop = Math.min(...allY) - 56;
  const svgW = Math.max(...allX) - svgLeft + 112;
  const svgH = Math.max(...allY) - svgTop + 112;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:core-dump-fade_650ms_ease-out_forwards]"
      style={{
        left: svgLeft,
        top: svgTop,
        width: svgW,
        height: svgH,
        overflow: "visible",
      }}
      viewBox={`0 0 ${svgW} ${svgH}`}
    >
      {nodes.map((node, index) => {
        const cx = node.x - svgLeft;
        const cy = node.y - svgTop;
        const outerRadius = index === 0 ? 24 : 18;
        return (
          <g key={index}>
            <circle
              cx={cx}
              cy={cy}
              r={outerRadius}
              fill="rgba(96,165,250,0.14)"
              stroke="rgba(147,197,253,0.7)"
              strokeWidth="1.6"
            />
            <circle
              cx={cx}
              cy={cy}
              r={outerRadius * 0.48}
              fill="rgba(219,234,254,0.32)"
              filter="drop-shadow(0 0 8px rgba(96,165,250,0.9))"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── Layer component ──────────────────────────────────────────────

interface WeaponEffectLayerProps {
  effects: WeaponEffectEvent[];
}

export default function WeaponEffectLayer({ effects }: WeaponEffectLayerProps) {
  if (effects.length === 0) return null;

  const layer: ReactNode = (
    <>
      {effects.map((effect) => {
        switch (effect.weapon) {
          case "void":
            return (
              <VoidPulseEffect key={effect.id} x={effect.x} y={effect.y} />
            );
          case "shockwave":
            return (
              <StaticNetEffect key={effect.id} x={effect.x} y={effect.y} />
            );
          case "plasma":
            return (
              <ForkBombEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                chainNodes={effect.chainNodes}
              />
            );
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
          case "laser":
            return (
              <TracerBloomEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                chainNodes={effect.chainNodes}
              />
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
          default:
            return null;
        }
      })}
    </>
  );

  if (typeof document === "undefined") return layer;
  return createPortal(layer, document.body);
}
