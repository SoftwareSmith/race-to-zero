/**
 * WeaponEffectLayer — a full-screen fixed overlay that renders on-screen fire
 * effect animations when the player fires a weapon.
 *
 * Each weapon has a visually distinctive effect — no two effects are just
 * an expanding circle.
 */

import type { WeaponEffectEvent } from "@game/types";

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

// ── Layer component ──────────────────────────────────────────────

interface WeaponEffectLayerProps {
  effects: WeaponEffectEvent[];
}

export default function WeaponEffectLayer({ effects }: WeaponEffectLayerProps) {
  if (effects.length === 0) return null;

  return (
    <>
      {effects.map((effect) => {
        switch (effect.weapon) {
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
              <LaserBeamEffect
                key={effect.id}
                x={effect.x}
                y={effect.y}
                angle={effect.angle}
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
}
