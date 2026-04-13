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

// ── Layer component ───────────────────────────────────────────────────────────

interface WeaponEffectLayerProps {
  effects: WeaponEffectEvent[];
}

export default function WeaponEffectLayer({ effects }: WeaponEffectLayerProps) {
  if (effects.length === 0) return null;

  const layer: ReactNode = (
    <>
      {effects.map(
        (effect) => getOverlayRenderer(effect.weapon)?.(effect) ?? null,
      )}
    </>
  );

  if (typeof document === "undefined") return layer;
  return createPortal(layer, document.body);
}
