/**
 * useWeaponEffects — lightweight React hook that manages the weaponEffects
 * state array used by WeaponEffectLayer.
 *
 * Provides a stable enqueueOverlay callback compatible with ExecutionContext
 * that replaces the inline handleWeaponFire logic in BackgroundField.
 *
 * Responsibilities:
 *   - Create WeaponEffectEvent entries for OVERLAY_EFFECT_WEAPONS
 *   - Prune expired events on each enqueue
 *   - Update cursor last-fire times for all weapons
 *   - Trigger hammer-swing animation for wrench
 */

import { useState, useCallback, useRef, type MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import { WeaponId } from "@game/types";
import type { SiegeWeaponId, WeaponEffectEvent } from "@game/types";
import type { OverlayExtras } from "@game/weapons/runtime/types";
import { getOverlayRenderer } from "@game/weapons/runtime/registry";
import { createEffectEvent, isEffectAlive } from "@game/utils/weaponEffects";

export interface WeaponEffectsState {
  /** Current overlay effect events for WeaponEffectLayer. */
  weaponEffects: WeaponEffectEvent[];
  /** Per-weapon last-fire timestamps for cursor reload animations. */
  cursorLastFireTimes: Partial<Record<SiegeWeaponId, number>>;
  /** Whether the wrench hammer swing is active. */
  hammerSwing: boolean;
  setHammerSwing: Dispatch<SetStateAction<boolean>>;
  /**
   * Enqueue an overlay event for the given weapon.
   * Safe to call for any weapon — non-overlay weapons only update cursor times.
   */
  enqueueOverlay: (
    weaponId: SiegeWeaponId,
    viewportX: number,
    viewportY: number,
    extras?: OverlayExtras,
  ) => void;
  /** Callback passed to parent to notify of weapon fire (reload bar). */
  onWeaponFiredCallback: MutableRefObject<
    ((weapon: SiegeWeaponId, firedAt: number) => void) | null
  >;
}

export function useWeaponEffects(): WeaponEffectsState {
  const [weaponEffects, setWeaponEffects] = useState<WeaponEffectEvent[]>([]);
  const [cursorLastFireTimes, setCursorLastFireTimes] = useState<
    Partial<Record<SiegeWeaponId, number>>
  >({});
  const [hammerSwing, setHammerSwing] = useState(false);
  const onWeaponFiredCallback = useRef<
    ((weapon: SiegeWeaponId, firedAt: number) => void) | null
  >(null);

  const enqueueOverlay = useCallback(
    (
      weaponId: SiegeWeaponId,
      viewportX: number,
      viewportY: number,
      extras?: OverlayExtras,
    ) => {
      let startedAt = performance.now();

      if (getOverlayRenderer(weaponId)) {
        const event = createEffectEvent(weaponId, viewportX, viewportY, extras);
        startedAt = event.startedAt;
        setWeaponEffects((prev) => {
          const now = performance.now();
          return [...prev.filter((e) => isEffectAlive(e, now)), event];
        });
      }

      setCursorLastFireTimes((prev) => ({
        ...prev,
        [weaponId]: startedAt,
      }));

      if (weaponId === WeaponId.Hammer) {
        setHammerSwing(true);
      }

      onWeaponFiredCallback.current?.(weaponId, startedAt);
    },
    [],
  );

  return {
    weaponEffects,
    cursorLastFireTimes,
    hammerSwing,
    setHammerSwing,
    enqueueOverlay,
    onWeaponFiredCallback,
  };
}
