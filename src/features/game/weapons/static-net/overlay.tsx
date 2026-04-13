/**
 * Static Net overlay — expanding wire-mesh ring with spokes.
 */

export interface StaticNetOverlayProps {
  x: number;
  y: number;
}

export function StaticNetOverlay({ x, y }: StaticNetOverlayProps) {
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
