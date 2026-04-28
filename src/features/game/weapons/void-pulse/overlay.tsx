/**
 * Void Pulse overlay — compact singularity with tier-scaled shearing debris.
 */

export interface VoidPulseOverlayProps {
  chaosScale?: number;
  impactRadius?: number;
  reticleRadius?: number;
  shockwaveRadius?: number;
  x: number;
  y: number;
}

export function VoidPulseOverlay({
  chaosScale = 1,
  impactRadius = 300,
  reticleRadius = 90,
  shockwaveRadius = 66,
  x,
  y,
}: VoidPulseOverlayProps) {
  const tier = chaosScale >= 1.3 ? 3 : chaosScale >= 1.12 ? 2 : 1;
  const hazeWidth = impactRadius * (0.72 + chaosScale * 0.12);
  const hazeHeight = impactRadius * (0.46 + chaosScale * 0.07);
  const lensWidth = reticleRadius * (1.34 + chaosScale * 0.12);
  const lensHeight = Math.max(30, shockwaveRadius * (0.42 + chaosScale * 0.06));
  const coreDiameter = Math.max(44, shockwaveRadius * (0.78 + chaosScale * 0.06));
  const pulseDiameter = Math.max(88, shockwaveRadius * (1.78 + chaosScale * 0.18));
  const markerCount = tier === 3 ? 10 : tier === 2 ? 8 : 6;
  const orbitRadiusX = reticleRadius * (0.94 + chaosScale * 0.1);
  const orbitRadiusY = shockwaveRadius * (0.62 + chaosScale * 0.06);
  const outerOrbitRadiusX = orbitRadiusX * (1.24 + chaosScale * 0.04);
  const outerOrbitRadiusY = orbitRadiusY * (1.2 + chaosScale * 0.05);
  const svgRadius = outerOrbitRadiusX + 42;
  const svgSize = svgRadius * 2;
  const outerStroke = tier === 3 ? "rgba(56,189,248,0.34)" : tier === 2 ? "rgba(251,191,36,0.3)" : "rgba(196,181,253,0.28)";
  const coreStroke = tier === 3 ? "rgba(56,189,248,0.72)" : tier === 2 ? "rgba(251,191,36,0.64)" : "rgba(226,232,240,0.62)";
  const markerStroke = tier === 3 ? "rgba(56,189,248,0.88)" : tier === 2 ? "rgba(251,191,36,0.82)" : "rgba(226,232,240,0.76)";
  const flareColor = tier === 3 ? "rgba(56,189,248,0.2)" : tier === 2 ? "rgba(251,191,36,0.18)" : "rgba(192,132,252,0.16)";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
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
        <div
          style={{
            position: "absolute",
            width: hazeWidth,
            height: hazeHeight,
            left: -hazeWidth / 2,
            top: -hazeHeight / 2,
            borderRadius: "50%",
            pointerEvents: "none",
            background: `radial-gradient(circle, rgba(192,132,252,${0.12 + (chaosScale - 1) * 0.06}) 0%, rgba(76,29,149,0.14) 30%, rgba(15,23,42,0.06) 58%, transparent 100%)`,
            filter: `blur(${14 + chaosScale * 10}px)`,
            transform: `rotate(${8 + chaosScale * 6}deg) scaleY(${0.86 + chaosScale * 0.04})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: lensWidth,
            height: lensHeight,
            left: -lensWidth / 2,
            top: -lensHeight / 2,
            borderRadius: "50%",
            pointerEvents: "none",
            background:
              tier === 3
                ? "linear-gradient(90deg, rgba(15,23,42,0) 0%, rgba(56,189,248,0.14) 20%, rgba(255,255,255,0.26) 50%, rgba(251,191,36,0.16) 78%, rgba(15,23,42,0) 100%)"
                : "linear-gradient(90deg, rgba(15,23,42,0) 0%, rgba(226,232,240,0.15) 22%, rgba(255,255,255,0.24) 50%, rgba(196,181,253,0.16) 78%, rgba(15,23,42,0) 100%)",
            boxShadow: `0 0 ${14 + chaosScale * 8}px ${flareColor}`,
            filter: `blur(${1.8 + chaosScale * 0.5}px)`,
            transform: `rotate(${-12 - chaosScale * 6}deg)`,
          }}
        />
        <div
          className="absolute rounded-full border [animation:heat-impact-ring_520ms_ease-out_forwards]"
          style={{
            width: pulseDiameter,
            height: pulseDiameter,
            left: -pulseDiameter / 2,
            top: -pulseDiameter / 2,
            borderColor: outerStroke,
            boxShadow: `0 0 ${18 + chaosScale * 10}px ${flareColor}`,
          }}
        />

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: -svgRadius,
            top: -svgRadius,
            width: svgSize,
            height: svgSize,
            overflow: "visible",
          }}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          <ellipse
            cx={svgRadius}
            cy={svgRadius}
            rx={outerOrbitRadiusX}
            ry={outerOrbitRadiusY}
            fill="none"
            stroke={outerStroke}
            strokeWidth="1.5"
          />
          <ellipse
            cx={svgRadius}
            cy={svgRadius}
            rx={orbitRadiusX}
            ry={orbitRadiusY}
            fill="none"
            stroke={coreStroke}
            strokeWidth="1.6"
            opacity="0.82"
          />
          <ellipse
            cx={svgRadius}
            cy={svgRadius}
            rx={orbitRadiusX * 0.78}
            ry={orbitRadiusY * 0.74}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1"
            opacity="0.7"
          />

          <g
            style={{
              transformOrigin: `${svgRadius}px ${svgRadius}px`,
              animation: `agent-ring-spin ${Math.max(2.1, 4.1 - chaosScale * 0.55)}s linear infinite`,
            }}
          >
            {Array.from({ length: markerCount }).map((_, index) => {
              const angle = (index / markerCount) * Math.PI * 2;
              const markerLength = 6 + (index % 3) * 1.8 + chaosScale;
              const cx = svgRadius + Math.cos(angle) * orbitRadiusX;
              const cy = svgRadius + Math.sin(angle) * orbitRadiusY;
              const tangentDx = Math.cos(angle + Math.PI / 2) * markerLength;
              const tangentDy = Math.sin(angle + Math.PI / 2) * markerLength * 0.72;

              return (
                <g key={`marker-${index}`}>
                  <line
                    x1={cx - tangentDx}
                    y1={cy - tangentDy}
                    x2={cx + tangentDx}
                    y2={cy + tangentDy}
                    stroke={markerStroke}
                    strokeWidth={1.8 + chaosScale * 0.2}
                    strokeLinecap="round"
                    opacity={0.86}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={1.6 + (index % 2) * 0.4}
                    fill={
                      tier === 3
                        ? "rgba(251,191,36,0.82)"
                        : "rgba(255,255,255,0.78)"
                    }
                    opacity={0.84}
                  />
                </g>
              );
            })}
          </g>

          {tier >= 2 ? (
            <g
              style={{
                transformOrigin: `${svgRadius}px ${svgRadius}px`,
                animation: `agent-ring-spin ${Math.max(3.2, 5.8 - chaosScale * 0.45)}s linear infinite reverse`,
              }}
            >
              {Array.from({ length: tier === 3 ? 4 : 3 }).map((_, index) => {
                const start = (-40 + index * 104) * (Math.PI / 180);
                const end = start + (tier === 3 ? 0.52 : 0.42);
                const startX = svgRadius + Math.cos(start) * outerOrbitRadiusX;
                const startY = svgRadius + Math.sin(start) * outerOrbitRadiusY;
                const endX = svgRadius + Math.cos(end) * outerOrbitRadiusX;
                const endY = svgRadius + Math.sin(end) * outerOrbitRadiusY;
                const controlX = svgRadius + Math.cos((start + end) / 2) * outerOrbitRadiusX * 1.04;
                const controlY = svgRadius + Math.sin((start + end) / 2) * outerOrbitRadiusY * 1.04;

                return (
                  <path
                    key={`arc-${index}`}
                    d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
                    fill="none"
                    stroke={tier === 3 ? "rgba(56,189,248,0.56)" : "rgba(251,191,36,0.48)"}
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                );
              })}
            </g>
          ) : null}
        </svg>

        <div
          style={{
            position: "absolute",
            width: coreDiameter,
            height: coreDiameter,
            left: -coreDiameter / 2,
            top: -coreDiameter / 2,
            borderRadius: "50%",
            pointerEvents: "none",
            background:
              "radial-gradient(circle, #000 52%, rgba(15,23,42,0.98) 70%, rgba(91,33,182,0.32) 100%)",
            boxShadow:
              tier === 3
                ? "0 0 18px rgba(56,189,248,0.28), 0 0 36px rgba(124,58,237,0.2)"
                : tier === 2
                  ? "0 0 16px rgba(251,191,36,0.18), 0 0 30px rgba(124,58,237,0.18)"
                  : "0 0 14px rgba(124,58,237,0.18)",
          }}
        />

        {tier >= 2 ? (
          <div
            style={{
              position: "absolute",
              width: lensWidth * 0.84,
              height: Math.max(18, lensHeight * 0.72),
              left: -(lensWidth * 0.84) / 2,
              top: -Math.max(18, lensHeight * 0.72) / 2,
              borderRadius: "50%",
              background:
                tier === 2
                  ? "linear-gradient(90deg, rgba(251,191,36,0) 0%, rgba(251,191,36,0.22) 28%, rgba(255,255,255,0.16) 50%, rgba(192,132,252,0.16) 72%, rgba(251,191,36,0) 100%)"
                  : "linear-gradient(90deg, rgba(56,189,248,0) 0%, rgba(56,189,248,0.2) 22%, rgba(255,255,255,0.14) 50%, rgba(251,191,36,0.22) 76%, rgba(56,189,248,0) 100%)",
              filter: `blur(${1.4 + chaosScale * 0.4}px)`,
              transform: `rotate(${10 + chaosScale * 6}deg) scaleX(${1.01 + chaosScale * 0.04})`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
