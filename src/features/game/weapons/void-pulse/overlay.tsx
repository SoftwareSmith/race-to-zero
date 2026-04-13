/**
 * Void Pulse overlay — animated spinning black hole with accretion rings.
 */

export interface VoidPulseOverlayProps {
  x: number;
  y: number;
}

export function VoidPulseOverlay({ x, y }: VoidPulseOverlayProps) {
  // Full-screen fixed wrapper so the overlay keeps its viewport anchor
  // even when WebGL canvas siblings are composited.
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
        {/* Gravitational field glow */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            left: -300,
            top: -300,
            borderRadius: "50%",
            pointerEvents: "none",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(76,29,149,0.08) 45%, transparent 70%)",
          }}
        />
        {/* Outer accretion ring — slow spin */}
        <div
          style={{
            position: "absolute",
            width: 180,
            height: 180,
            left: -90,
            top: -90,
            borderRadius: "50%",
            border: "1.5px dashed rgba(167,139,250,0.5)",
            boxShadow: "0 0 24px rgba(139,92,246,0.3)",
            pointerEvents: "none",
            animation: "agent-ring-spin 2.5s linear infinite",
          }}
        />
        {/* Inner accretion ring — fast reverse spin */}
        <div
          style={{
            position: "absolute",
            width: 110,
            height: 110,
            left: -55,
            top: -55,
            borderRadius: "50%",
            border: "2px dashed rgba(192,132,252,0.65)",
            boxShadow: "0 0 14px rgba(147,51,234,0.4)",
            pointerEvents: "none",
            animation: "agent-ring-spin 1.4s linear infinite reverse",
          }}
        />
        {/* Photon ring glow */}
        <div
          style={{
            position: "absolute",
            width: 66,
            height: 66,
            left: -33,
            top: -33,
            borderRadius: "50%",
            pointerEvents: "none",
            boxShadow:
              "0 0 0 2.5px rgba(192,132,252,0.9), 0 0 18px rgba(147,51,234,0.7), 0 0 40px rgba(124,58,237,0.3)",
            animation: "structure-pulse 0.8s ease-in-out infinite",
          }}
        />
        {/* Hard black core */}
        <div
          style={{
            position: "absolute",
            width: 44,
            height: 44,
            left: -22,
            top: -22,
            borderRadius: "50%",
            pointerEvents: "none",
            background:
              "radial-gradient(circle, #000 55%, rgba(76,29,149,0.8) 100%)",
            boxShadow: "0 0 22px rgba(124,58,237,0.7)",
          }}
        />
      </div>
    </div>
  );
}
