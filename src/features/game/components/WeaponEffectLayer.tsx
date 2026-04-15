/**
 * WeaponEffectLayer — full-screen fixed overlay for weapon fire animations.
 *
 * Each weapon's visual effect lives in its own folder (overlay.tsx).
 * This file is a thin dispatcher: it maps weapon IDs to their overlay
 * component and renders whatever is active.
 *
 * To add a new weapon overlay: create overlay.tsx in its weapon folder
 * and add one entry to overlayHandlers below.
 */

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WeaponEffectEvent } from "@game/types";
import { getOverlayRenderer } from "@game/weapons/runtime/registry";

function HeatImpactBurst({ effect }: { effect: WeaponEffectEvent }) {
  if (!effect.heatColor || !effect.heatCore || !effect.heatScale) {
    return null;
  }

  const size = 108 * effect.heatScale;
  const ringSize = 78 * effect.heatScale;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full [animation:heat-impact-flash_360ms_ease-out_forwards]"
        style={{
          left: effect.x,
          top: effect.y,
          width: size,
          height: size,
          background: `radial-gradient(circle, ${effect.heatCore} 0%, ${effect.heatColor}88 38%, transparent 72%)`,
          boxShadow: `0 0 ${22 * effect.heatScale}px ${effect.heatColor}66`,
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full border [animation:heat-impact-ring_460ms_ease-out_forwards]"
        style={{
          left: effect.x,
          top: effect.y,
          width: ringSize,
          height: ringSize,
          borderColor: `${effect.heatColor}aa`,
          boxShadow: `0 0 18px ${effect.heatColor}55`,
          transform: "translate(-50%, -50%)",
        }}
      />
    </>
  );
}

// ── Layer component ───────────────────────────────────────────────────────────

interface WeaponEffectLayerProps {
  effects: WeaponEffectEvent[];
}

export default function WeaponEffectLayer({ effects }: WeaponEffectLayerProps) {
  if (effects.length === 0) return null;

  const layer: ReactNode = (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[68] [contain:layout_paint] [isolation:isolate]"
      style={{ transform: "translateZ(0)" }}
    >
      {effects.map((effect) => (
        <div key={effect.id}>
          <HeatImpactBurst effect={effect} />
          {getOverlayRenderer(effect.weapon)?.(effect) ?? null}
        </div>
      ))}
    </div>
  );

  if (typeof document === "undefined") return layer;
  return createPortal(layer, document.body);
}
