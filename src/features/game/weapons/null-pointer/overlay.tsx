/**
 * Null Pointer overlay — targeting beam from cursor to the locked bug,
 * plus an impact shockwave ring at the target position.
 *
 * Rendered by WeaponEffectLayer via the overlayHandlers map.
 */

export interface NullPointerOverlayProps {
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
}

export function NullPointerOverlay({
  x,
  y,
  targetX,
  targetY,
}: NullPointerOverlayProps) {
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
          {/* Soft glow line */}
          <line
            x1={lx1}
            y1={ly1}
            x2={lx2}
            y2={ly2}
            stroke="rgba(251,113,133,0.2)"
            strokeWidth="8"
          />
          {/* Sharp targeting beam */}
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
          {/* Target reticle ring */}
          <circle
            cx={lx2}
            cy={ly2}
            r="14"
            fill="none"
            stroke="#fb7185"
            strokeWidth="1.5"
            opacity="0.6"
          />
          {/* Crosshair lines around target */}
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
      {/* Impact shockwave at target */}
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
