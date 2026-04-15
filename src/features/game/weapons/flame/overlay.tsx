import type { CSSProperties } from "react";

export interface FlameOverlayProps {
  x: number;
  y: number;
  angle?: number;
}

const CONE_LENGTH = 220;
const CONE_SPREAD = 96;
const MARGIN = 24;

export function FlameOverlay({ x, y, angle = 0 }: FlameOverlayProps) {
  const width = CONE_LENGTH + MARGIN * 2;
  const height = CONE_SPREAD * 2 + MARGIN * 2;
  const originX = MARGIN;
  const originY = height / 2;
  const tipX = originX + CONE_LENGTH;
  const topY = originY - CONE_SPREAD;
  const bottomY = originY + CONE_SPREAD;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:heat-impact-flash_420ms_ease-out_forwards]"
      style={{
        left: x - originX,
        top: y - originY,
        width,
        height,
        overflow: "visible",
        transform: `rotate(${angle}rad)`,
        transformOrigin: `${originX}px ${originY}px`,
      }}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id="flame-core" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="rgba(254,215,170,0.95)" />
          <stop offset="42%" stopColor="rgba(251,146,60,0.92)" />
          <stop offset="100%" stopColor="rgba(239,68,68,0)" />
        </linearGradient>
        <linearGradient id="flame-glow" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="rgba(251,191,36,0.40)" />
          <stop offset="55%" stopColor="rgba(249,115,22,0.34)" />
          <stop offset="100%" stopColor="rgba(239,68,68,0)" />
        </linearGradient>
      </defs>
      <path
        d={`M ${originX} ${originY} C ${originX + 54} ${topY + 10}, ${originX + 128} ${topY - 6}, ${tipX} ${originY} C ${originX + 132} ${bottomY + 6}, ${originX + 52} ${bottomY - 10}, ${originX} ${originY}`}
        fill="url(#flame-glow)"
        filter="drop-shadow(0 0 18px rgba(249,115,22,0.45))"
      />
      <path
        d={`M ${originX + 8} ${originY} C ${originX + 42} ${originY - 34}, ${originX + 106} ${originY - 28}, ${tipX - 18} ${originY} C ${originX + 110} ${originY + 28}, ${originX + 42} ${originY + 34}, ${originX + 8} ${originY}`}
        fill="url(#flame-core)"
      />
      {Array.from({ length: 3 }, (_, index) => {
        const offset = index * 22;
        return (
          <ellipse
            key={index}
            cx={originX + 48 + offset}
            cy={originY + (index % 2 === 0 ? -10 : 10)}
            rx={22 + index * 8}
            ry={10 + index * 3}
            fill="rgba(255,244,214,0.28)"
            style={
              {
                animation: "sparkle-appear 320ms ease-out forwards",
                animationDelay: `${index * 55}ms`,
                opacity: 0,
              } as CSSProperties
            }
          />
        );
      })}
    </svg>
  );
}
