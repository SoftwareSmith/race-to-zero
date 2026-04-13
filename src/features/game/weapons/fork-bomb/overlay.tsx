/**
 * Fork Bomb overlay — clustered duplicate detonation circles.
 */

export interface ForkBombOverlayProps {
  x: number;
  y: number;
  chainNodes?: Array<{ x: number; y: number }>;
}

export function ForkBombOverlay({ x, y, chainNodes }: ForkBombOverlayProps) {
  const nodes = chainNodes && chainNodes.length > 0 ? chainNodes : [{ x, y }];
  const allX = nodes.map((n) => n.x);
  const allY = nodes.map((n) => n.y);
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
