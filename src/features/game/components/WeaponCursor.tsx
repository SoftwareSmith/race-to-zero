/**
 * WeaponCursor — a per-weapon SVG cursor that tracks the mouse position.
 *
 * Position is updated imperatively via direct DOM style mutation (no React
 * state on mouse-move) for zero-jank cursor tracking. The `swinging` prop
 * is used to play the hammer-swing animation on click.
 */

import { useEffect, useRef } from "react";
import type { SiegeWeaponId } from "@game/types";

interface WeaponCursorProps {
  weaponId: SiegeWeaponId;
  swinging?: boolean;
}

// ── Hammer ──────────────────────────────────────────────────────

function HammerIcon({ swinging }: { swinging: boolean }) {
  return (
    <span
      className={[
        "inline-flex text-[1.9rem]",
        "[filter:drop-shadow(0_8px_18px_rgba(0,0,0,0.35))]",
        "[transform:translate3d(-6px,-6px,0)]",
        "[transform-origin:18px_14px]",
        swinging ? "[animation:weapon-cursor-swing_180ms_ease-out]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      🔨
    </span>
  );
}

// ── Laser crosshair ──────────────────────────────────────────────

function LaserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="-20 -20 40 40"
      width="40"
      height="40"
      className="[animation:laser-cursor-breathe_2s_ease-in-out_infinite] [transform:translate(-50%,-50%)]"
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      {/* Outer ring */}
      <circle
        cx="0"
        cy="0"
        r="11"
        stroke="#f87171"
        strokeWidth="1"
        fill="none"
        opacity="0.7"
      />
      {/* Four guide lines with gaps */}
      <line
        x1="-19"
        y1="0"
        x2="-14"
        y2="0"
        stroke="#f87171"
        strokeWidth="1.2"
        opacity="0.9"
      />
      <line
        x1="14"
        y1="0"
        x2="19"
        y2="0"
        stroke="#f87171"
        strokeWidth="1.2"
        opacity="0.9"
      />
      <line
        x1="0"
        y1="-19"
        x2="0"
        y2="-14"
        stroke="#f87171"
        strokeWidth="1.2"
        opacity="0.9"
      />
      <line
        x1="0"
        y1="14"
        x2="0"
        y2="19"
        stroke="#f87171"
        strokeWidth="1.2"
        opacity="0.9"
      />
      {/* Center dot */}
      <circle cx="0" cy="0" r="1.5" fill="#f87171" opacity="0.95" />
    </svg>
  );
}

// ── Pulse rings ──────────────────────────────────────────────────

function PulseIcon() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}
    >
      {/* Outer breathing ring */}
      <div
        className="rounded-full border border-sky-400/60 [animation:pulse-cursor-orbit_2s_ease-in-out_infinite]"
        style={{
          position: "absolute",
          width: 32,
          height: 32,
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Inner static ring */}
      <div
        className="rounded-full border border-sky-300/80"
        style={{
          position: "absolute",
          width: 14,
          height: 14,
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Center dot */}
      <div
        className="rounded-full bg-sky-300"
        style={{
          position: "absolute",
          width: 4,
          height: 4,
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

export default function WeaponCursor({
  weaponId,
  swinging = false,
}: WeaponCursorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: -200, y: -200 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          if (containerRef.current) {
            containerRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
          }
        });
      }
    };

    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[95]"
      style={{ transform: "translate3d(-200px, -200px, 0)" }}
    >
      {weaponId === "hammer" && <HammerIcon swinging={swinging} />}
      {weaponId === "laser" && <LaserIcon />}
      {weaponId === "pulse" && <PulseIcon />}
    </div>
  );
}
