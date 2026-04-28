/**
 * Chain Zap overlay — double-bolt arcs with stable jag offsets + draw animation.
 */

export interface ChainOverlayProps {
  x: number;
  y: number;
  chainNodes?: Array<{ x: number; y: number }>;
  jagOffsets?: number[];
  beamWidth?: number;
  beamGlowWidth?: number;
  chaosScale?: number;
}

export function ChainOverlay({
  beamGlowWidth = 7.2,
  beamWidth = 2.4,
  chaosScale = 1,
  x,
  y,
  chainNodes,
  jagOffsets,
}: ChainOverlayProps) {
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
              strokeWidth={(beamWidth * 0.7).toFixed(1)}
              strokeLinecap="round"
              opacity="0.8"
            />
          );
        })}
        <circle
          cx="0"
          cy="0"
          r={4 + (chaosScale - 1) * 4}
          fill="#6ee7b7"
          opacity="0.95"
        />
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
        animation: "chain-flicker 1200ms ease-out 200ms forwards",
      }}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
    >
      {nodes.slice(1).map((node, i) => {
        const from = nodes[i];
        const fx = from.x - svgLeft,
          fy = from.y - svgTop;
        const tx = node.x - svgLeft,
          ty = node.y - svgTop;
        const mx =
          (fx + tx) / 2 +
          (jagOffsets ? (jagOffsets[i * 2] ?? 0) * chaosScale : 0);
        const my =
          (fy + ty) / 2 +
          (jagOffsets ? (jagOffsets[i * 2 + 1] ?? 0) * chaosScale : 0);
        const dx = tx - fx,
          dy = ty - fy;
        const len = Math.hypot(dx, dy) || 1;
        const px = (-dy / len) * (beamWidth + chaosScale),
          py = (dx / len) * (beamWidth + chaosScale);
        const approxLen = len + 50;
        return (
          <g key={i}>
            <path
              d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
              stroke="rgba(110,231,183,0.35)"
              strokeWidth={beamGlowWidth}
              strokeLinecap="round"
              fill="none"
              opacity="0.9"
              filter={`drop-shadow(0 0 ${beamGlowWidth}px rgba(110,231,183,0.72))`}
              strokeDasharray={approxLen}
              strokeDashoffset={approxLen}
              style={{
                animation: `chain-bolt-draw ${280 + i * 60}ms ease-out forwards`,
              }}
            />
            <path
              d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
              stroke="#6ee7b7"
              strokeWidth={beamWidth}
              strokeLinecap="round"
              fill="none"
              opacity="0.9"
              filter={`drop-shadow(0 0 ${Math.max(4, beamGlowWidth * 0.7)}px rgba(110,231,183,0.82))`}
              strokeDasharray={approxLen}
              strokeDashoffset={approxLen}
              style={{
                animation: `chain-bolt-draw ${280 + i * 60}ms ease-out forwards`,
              }}
            />
            <path
              d={`M ${fx + px} ${fy + py} Q ${mx + px} ${my + py} ${tx + px} ${ty + py}`}
              stroke="#a7f3d0"
              strokeWidth={Math.max(1, beamWidth * 0.44)}
              strokeLinecap="round"
              fill="none"
              opacity={Math.min(0.72, 0.48 + chaosScale * 0.08)}
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
            r={i === 0 ? 9 + (chaosScale - 1) * 4 : 6 + (chaosScale - 1) * 3}
            fill={i === 0 ? "rgba(110,231,183,0.22)" : "rgba(167,243,208,0.18)"}
            filter="drop-shadow(0 0 4px rgba(110,231,183,0.5))"
          />
          <circle
            cx={node.x - svgLeft}
            cy={node.y - svgTop}
            r={
              i === 0 ? 5 + (chaosScale - 1) * 2.5 : 3 + (chaosScale - 1) * 1.5
            }
            fill={i === 0 ? "#6ee7b7" : "#a7f3d0"}
            opacity="0.95"
          />
        </g>
      ))}
      {(() => {
        if (nodes.length < 2) return null;
        const last = nodes[nodes.length - 1];
        const prev = nodes[nodes.length - 2];
        const lx = last.x - svgLeft,
          ly = last.y - svgTop;
        const inAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
        const forkSpread = 0.42 + chaosScale * 0.24;
        const forkAngles =
          chaosScale >= 1.35
            ? [
                inAngle - forkSpread,
                inAngle - forkSpread * 0.42,
                inAngle + forkSpread * 0.42,
                inAngle + forkSpread,
              ]
            : chaosScale >= 1.1
              ? [inAngle - forkSpread, inAngle, inAngle + forkSpread]
              : [inAngle - forkSpread, inAngle + forkSpread];
        const forkLength = 28 + (chaosScale - 1) * 18;
        return forkAngles.map((a, fi) => (
          <line
            key={`fork-${fi}`}
            x1={lx}
            y1={ly}
            x2={(lx + Math.cos(a) * forkLength).toFixed(1)}
            y2={(ly + Math.sin(a) * forkLength).toFixed(1)}
            stroke="#a7f3d0"
            strokeWidth={Math.max(1.3, beamWidth * 0.55)}
            strokeLinecap="round"
            opacity="0.7"
            strokeDasharray={forkLength + 4}
            strokeDashoffset={forkLength + 4}
            style={{
              animation: `chain-bolt-draw 400ms ease-out ${nodes.length * 60}ms forwards`,
            }}
          />
        ));
      })()}
    </svg>
  );
}
