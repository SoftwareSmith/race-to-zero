/**
 * Tracer Bloom overlay — linked route of pulse bloom circles.
 */

export interface TracerBloomOverlayProps {
  x: number;
  y: number;
  chainNodes?: Array<{ x: number; y: number }>;
}

export function TracerBloomOverlay({
  x,
  y,
  chainNodes,
}: TracerBloomOverlayProps) {
  const nodes = chainNodes && chainNodes.length > 0 ? chainNodes : [{ x, y }];
  const allX = nodes.map((n) => n.x);
  const allY = nodes.map((n) => n.y);
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
