/**
 * Freeze Blast overlay — expanding ice ring with 8 shard radials.
 */

import type { CSSProperties } from "react";

export interface FreezeOverlayProps {
  x: number;
  y: number;
  angle?: number;
}

export function FreezeOverlay({ x, y }: FreezeOverlayProps) {
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
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="rgba(147,197,253,0.08)"
        stroke="rgba(147,197,253,0.65)"
        strokeWidth="2"
        filter="drop-shadow(0 0 8px rgba(147,197,253,0.5))"
      />
      <circle
        cx={cx}
        cy={cy}
        r={R * 0.55}
        fill="rgba(186,230,253,0.10)"
        stroke="rgba(186,230,253,0.4)"
        strokeWidth="1.5"
      />
      <circle
        cx={cx}
        cy={cy}
        r={18}
        fill="rgba(224,242,254,0.35)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1"
        filter="drop-shadow(0 0 5px rgba(186,230,253,0.8))"
      />
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
