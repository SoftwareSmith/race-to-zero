/**
 * WeaponEffectLayer — a full-screen fixed overlay that renders on-screen fire
 * effect animations when the player fires a weapon.
 *
 * - Hammer: SVG spider-crack radiating from the click point
 * - Laser: Full-width horizontal beam through the click Y
 * - Pulse: Expanding ring centred at the click point
 *
 * Effects are keyed by `WeaponEffectEvent.id` and removed by the parent once
 * their duration has elapsed.
 */

import type { WeaponEffectEvent } from "@game/types";

// ── Hammer crack ────────────────────────────────────────────────

// Six jagged rays emanating from centre
const CRACK_PATHS = [
  "M 0 0 L 28 -44 L 18 -70",
  "M 0 0 L 46 -18 L 68 -8",
  "M 0 0 L 48 18  L 72 44",
  "M 0 0 L 22 50  L 6  72",
  "M 0 0 L -36 42 L -54 26",
  "M 0 0 L -50 -10 L -70 18",
];

function HammerCrackEffect({ x, y }: { x: number; y: number }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed [animation:hammer-crack_520ms_ease-out_forwards]"
      style={{ left: x, top: y, width: 160, height: 160, overflow: "visible" }}
      viewBox="-80 -80 160 160"
    >
      {CRACK_PATHS.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="#fbbf24"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.95"
        />
      ))}
      {/* Small burst circle at impact */}
      <circle cx="0" cy="0" r="6" fill="#fbbf24" opacity="0.7" />
    </svg>
  );
}

// ── Laser beam ──────────────────────────────────────────────────

function LaserBeamEffect({ y }: { y: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 [animation:laser-beam-fade_320ms_ease-out_forwards]"
      style={{
        top: y,
        height: 3,
        background:
          "linear-gradient(90deg, transparent 0%, #f87171 15%, #fff8f8 50%, #f87171 85%, transparent 100%)",
        boxShadow: "0 0 12px 3px rgba(248,113,113,0.45)",
        transformOrigin: "center center",
      }}
    />
  );
}

// ── Pulse expand ring ────────────────────────────────────────────

function PulseRingEffect({ x, y }: { x: number; y: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed rounded-full border-2 border-sky-400/70 [animation:pulse-expand_600ms_ease-out_forwards]"
      style={{
        left: x,
        top: y,
        width: 320,
        height: 320,
        boxShadow: "0 0 24px 4px rgba(56,189,248,0.25)",
        transformOrigin: "center center",
      }}
    />
  );
}

// ── Layer component ──────────────────────────────────────────────

interface WeaponEffectLayerProps {
  effects: WeaponEffectEvent[];
}

export default function WeaponEffectLayer({ effects }: WeaponEffectLayerProps) {
  if (effects.length === 0) return null;

  return (
    <>
      {effects.map((effect) => {
        if (effect.weapon === "hammer") {
          return (
            <HammerCrackEffect key={effect.id} x={effect.x} y={effect.y} />
          );
        }
        if (effect.weapon === "laser") {
          return <LaserBeamEffect key={effect.id} y={effect.y} />;
        }
        if (effect.weapon === "pulse") {
          return <PulseRingEffect key={effect.id} x={effect.x} y={effect.y} />;
        }
        return null;
      })}
    </>
  );
}
