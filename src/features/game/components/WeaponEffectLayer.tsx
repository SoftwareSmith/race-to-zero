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

// ── Per-weapon overlay imports ────────────────────────────────────────────────

import { FreezeOverlay } from "@game/weapons/freeze-cone/overlay";
import { ChainOverlay } from "@game/weapons/chain-zap/overlay";
import { TracerBloomOverlay } from "@game/weapons/tracer-bloom/overlay";
import { NullPointerOverlay } from "@game/weapons/null-pointer/overlay";
import { StaticNetOverlay } from "@game/weapons/static-net/overlay";
import { ForkBombOverlay } from "@game/weapons/fork-bomb/overlay";
import { VoidPulseOverlay } from "@game/weapons/void-pulse/overlay";

// ── Handler map: weaponId → render function ───────────────────────────────────
//
// Each handler receives the WeaponEffectEvent and returns a ReactNode.
// Weapons without a visual overlay are not listed (returns null by default).

type OverlayRenderer = (effect: WeaponEffectEvent) => ReactNode;

const overlayHandlers: Partial<
  Record<WeaponEffectEvent["weapon"], OverlayRenderer>
> = {
  freeze: (e) => <FreezeOverlay key={e.id} x={e.x} y={e.y} angle={e.angle} />,
  chain: (e) => (
    <ChainOverlay
      key={e.id}
      x={e.x}
      y={e.y}
      chainNodes={e.chainNodes}
      jagOffsets={e.jagOffsets}
    />
  ),
  laser: (e) => (
    <TracerBloomOverlay key={e.id} x={e.x} y={e.y} chainNodes={e.chainNodes} />
  ),
  nullpointer: (e) => (
    <NullPointerOverlay
      key={e.id}
      x={e.x}
      y={e.y}
      targetX={e.targetX}
      targetY={e.targetY}
    />
  ),
  shockwave: (e) => <StaticNetOverlay key={e.id} x={e.x} y={e.y} />,
  plasma: (e) => (
    <ForkBombOverlay key={e.id} x={e.x} y={e.y} chainNodes={e.chainNodes} />
  ),
  void: (e) => <VoidPulseOverlay key={e.id} x={e.x} y={e.y} />,
};

// ── Layer component ───────────────────────────────────────────────────────────

interface WeaponEffectLayerProps {
  effects: WeaponEffectEvent[];
}

export default function WeaponEffectLayer({ effects }: WeaponEffectLayerProps) {
  if (effects.length === 0) return null;

  const layer: ReactNode = (
    <>
      {effects.map(
        (effect) => overlayHandlers[effect.weapon]?.(effect) ?? null,
      )}
    </>
  );

  if (typeof document === "undefined") return layer;
  return createPortal(layer, document.body);
}
