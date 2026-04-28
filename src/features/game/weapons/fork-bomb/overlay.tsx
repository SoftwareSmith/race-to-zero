/**
 * Fork Bomb overlay — smoky multi-burst flash with sparks instead of target rings.
 */

export interface ForkBombOverlayProps {
  chaosScale?: number;
  impactRadius?: number;
  reticleRadius?: number;
  shockwaveRadius?: number;
  x: number;
  y: number;
  targetPoints?: Array<{ x: number; y: number }>;
}

export function ForkBombOverlay({
  chaosScale = 1,
  impactRadius = 22,
  reticleRadius = 52,
  shockwaveRadius = 90,
  x,
  y,
  targetPoints,
}: ForkBombOverlayProps) {
  void shockwaveRadius;
  const nodes =
    targetPoints && targetPoints.length > 0 ? targetPoints : [{ x, y }];
  const sparkCount = Math.max(5, Math.round(6 + chaosScale * 4));

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
      {nodes.map((node, index) => {
        const localImpact =
          index === 0 ? reticleRadius * 0.44 : impactRadius + chaosScale * 3;
        const smokeScale = 1 + index * 0.08;
        const linkDx = x - node.x;
        const linkDy = y - node.y;
        const linkLength = Math.hypot(linkDx, linkDy);

        return (
          <div
            key={`${node.x}-${node.y}-${index}`}
            className="absolute [animation:core-dump-fade_720ms_ease-out_forwards]"
            style={{
              left: node.x,
              top: node.y,
              width: 0,
              height: 0,
              overflow: "visible",
            }}
          >
            {Array.from({ length: 5 }).map((_, plumeIndex) => {
              const angle = (plumeIndex / 5) * Math.PI * 2 + index * 0.24;
              const offset =
                localImpact * (0.3 + plumeIndex * 0.16) * smokeScale;
              const plumeSize = localImpact * (1.15 + plumeIndex * 0.16);
              return (
                <div
                  key={`smoke-${plumeIndex}`}
                  style={{
                    position: "absolute",
                    left: Math.cos(angle) * offset - plumeSize / 2,
                    top: Math.sin(angle) * offset * 0.7 - plumeSize / 2,
                    width: plumeSize,
                    height: plumeSize,
                    borderRadius: "50% 46% 58% 42%",
                    background:
                      "radial-gradient(circle, rgba(219,234,254,0.46) 0%, rgba(96,165,250,0.24) 28%, rgba(15,23,42,0.18) 68%, transparent 100%)",
                    filter: `blur(${4 + plumeIndex * 1.8}px)`,
                    animation: `core-dump-fade ${420 + plumeIndex * 90}ms ease-out forwards`,
                    transform: `rotate(${28 + plumeIndex * 37}deg) scale(${1 + chaosScale * 0.08})`,
                  }}
                />
              );
            })}

            {Array.from({ length: sparkCount }).map((_, sparkIndex) => {
              const angle =
                (sparkIndex / sparkCount) * Math.PI * 2 + index * 0.12;
              const length = localImpact * (0.6 + (sparkIndex % 3) * 0.18);
              return (
                <div
                  key={`spark-${sparkIndex}`}
                  style={{
                    position: "absolute",
                    left: Math.cos(angle) * (localImpact * 0.22),
                    top: Math.sin(angle) * (localImpact * 0.22),
                    width: Math.max(10, length),
                    height: 2,
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(125,211,252,0.88) 35%, rgba(56,189,248,0.16) 100%)",
                    boxShadow: "0 0 12px rgba(125,211,252,0.72)",
                    transform: `translate(-50%, -50%) rotate(${(angle * 180) / Math.PI}deg)`,
                    transformOrigin: "0 50%",
                    animation: `core-dump-fade ${360 + sparkIndex * 24}ms ease-out forwards`,
                  }}
                />
              );
            })}

            <div
              style={{
                position: "absolute",
                left: -localImpact,
                top: -localImpact,
                width: localImpact * 2,
                height: localImpact * 2,
                borderRadius: "44% 56% 58% 42%",
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(147,197,253,0.58) 26%, rgba(56,189,248,0.18) 58%, transparent 78%)",
                filter: `blur(${2 + chaosScale * 2}px)`,
                animation: "core-dump-fade 420ms ease-out forwards",
              }}
            />

            {index > 0 && linkLength > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: linkLength,
                  height: 3,
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, rgba(56,189,248,0.08) 0%, rgba(125,211,252,0.58) 45%, rgba(255,255,255,0.12) 100%)",
                  filter: "blur(1.2px)",
                  transform: `translate(-50%, -50%) rotate(${Math.atan2(linkDy, linkDx)}rad)`,
                  transformOrigin: "0 50%",
                  animation: "core-dump-fade 280ms ease-out forwards",
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
