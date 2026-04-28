/**
 * Null Pointer overlay — targeting beam from cursor to the locked bug,
 * plus an impact shockwave ring at the target position.
 *
 * Rendered by WeaponEffectLayer via the overlayHandlers map.
 */

export interface NullPointerOverlayProps {
  x: number;
  y: number;
  beamGlowWidth?: number;
  beamWidth?: number;
  chaosScale?: number;
  reticleRadius?: number;
  shockwaveRadius?: number;
  targetPoints?: Array<{ x: number; y: number }>;
  targetX?: number;
  targetY?: number;
}

export function NullPointerOverlay({
  beamGlowWidth = 8,
  beamWidth = 1.5,
  chaosScale = 1,
  reticleRadius = 14,
  shockwaveRadius = 160,
  targetPoints,
  x,
  y,
  targetX,
  targetY,
}: NullPointerOverlayProps) {
  const resolvedTargets =
    targetPoints && targetPoints.length > 0
      ? targetPoints
      : [{ x: targetX ?? x, y: targetY ?? y }];
  const hasTarget = resolvedTargets.some(
    (target) => target.x !== x || target.y !== y,
  );
  const targetXs = resolvedTargets.map((target) => target.x);
  const targetYs = resolvedTargets.map((target) => target.y);

  const padding = 16 + shockwaveRadius * 0.12;
  const svgLeft = Math.min(x, ...targetXs) - padding;
  const svgTop = Math.min(y, ...targetYs) - padding;
  const svgW = Math.max(x, ...targetXs) - svgLeft + padding;
  const svgH = Math.max(y, ...targetYs) - svgTop + padding;
  const lx1 = x - svgLeft;
  const ly1 = y - svgTop;

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
          {resolvedTargets.map((target, index) => {
            const lx2 = target.x - svgLeft;
            const ly2 = target.y - svgTop;
            const beamOffset = index * 0.16;
            const ringRadius = reticleRadius + index * 2.5 * chaosScale;
            const crosshairLength = ringRadius + 6 + index * 2;

            return (
              <g key={`${target.x}-${target.y}-${index}`}>
                <line
                  x1={lx1}
                  y1={ly1}
                  x2={lx2}
                  y2={ly2}
                  stroke="rgba(251,113,133,0.2)"
                  strokeWidth={beamGlowWidth + index * chaosScale * 1.4}
                  opacity={0.95 - beamOffset}
                />
                <line
                  x1={lx1}
                  y1={ly1}
                  x2={lx2}
                  y2={ly2}
                  stroke="#fb7185"
                  strokeWidth={beamWidth + index * 0.28 * chaosScale}
                  strokeLinecap="round"
                  opacity={0.92 - beamOffset}
                  filter="drop-shadow(0 0 3px rgba(251,113,133,0.7))"
                />
                <circle
                  cx={lx2}
                  cy={ly2}
                  r={ringRadius}
                  fill="none"
                  stroke="#fb7185"
                  strokeWidth={beamWidth}
                  opacity={0.66 - beamOffset * 0.6}
                />
                <line
                  x1={lx2 - crosshairLength}
                  y1={ly2}
                  x2={lx2 - ringRadius * 0.6}
                  y2={ly2}
                  stroke="#fb7185"
                  strokeWidth={beamWidth}
                  opacity={0.74 - beamOffset * 0.5}
                />
                <line
                  x1={lx2 + ringRadius * 0.6}
                  y1={ly2}
                  x2={lx2 + crosshairLength}
                  y2={ly2}
                  stroke="#fb7185"
                  strokeWidth={beamWidth}
                  opacity={0.74 - beamOffset * 0.5}
                />
                <line
                  x1={lx2}
                  y1={ly2 - crosshairLength}
                  x2={lx2}
                  y2={ly2 - ringRadius * 0.6}
                  stroke="#fb7185"
                  strokeWidth={beamWidth}
                  opacity={0.74 - beamOffset * 0.5}
                />
                <line
                  x1={lx2}
                  y1={ly2 + ringRadius * 0.6}
                  x2={lx2}
                  y2={ly2 + crosshairLength}
                  stroke="#fb7185"
                  strokeWidth={beamWidth}
                  opacity={0.74 - beamOffset * 0.5}
                />
              </g>
            );
          })}
        </svg>
      )}
      {resolvedTargets.map((target, index) => {
        const radius = shockwaveRadius + index * 24 * chaosScale;
        const pulseRadius = Math.max(70, radius * 0.48);
        return (
          <div key={`shock-${target.x}-${target.y}-${index}`}>
            <div
              aria-hidden="true"
              className="pointer-events-none fixed rounded-full [animation:shockwave-expand_1200ms_ease-out_forwards]"
              style={{
                left: target.x,
                top: target.y,
                width: radius * 2,
                height: radius * 2,
                background:
                  "radial-gradient(circle, rgba(251,113,133,0.35) 0%, rgba(244,63,94,0.12) 50%, transparent 70%)",
                boxShadow: `0 0 ${44 + index * 8}px ${10 + index * 3}px rgba(251,113,133,0.22)`,
                transform: "translate(-50%, -50%)",
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none fixed rounded-full border-2 border-rose-400/55 [animation:pulse-expand_900ms_ease-out_forwards]"
              style={{
                left: target.x,
                top: target.y,
                width: pulseRadius * 2,
                height: pulseRadius * 2,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        );
      })}
    </>
  );
}
