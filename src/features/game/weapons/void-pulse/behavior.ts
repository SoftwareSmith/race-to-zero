/**
 * Void Pulse — behavior plugin (PersistentFireSession)
 *
 * Creates a black hole gravity well for 2s, pulling all bugs within 300px.
 * Core contact deals 1 dmg/tick (handled by Engine.tickBlackHole).
 * On collapse: 300px shockring deals 2 dmg to all bugs in radius.
 *
 * Only one black hole can be active at a time — active gate enforced by
 * checking engine.getBlackHole() before begin().
 *
 * The VFX createBlackHole descriptor stores the Pixi ID in blackHoleVfxIdRef
 * so the renderFrame loop can call tickBlackHoleVfx each frame.
 * The voidCollapse descriptor destroys the Pixi black hole when it fires.
 */

import type {
  WeaponContext,
  PersistentFireSession,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { WeaponId, WeaponTier } from "@game/types";
import { BASE_TOGGLES } from "./constants";

export function createSession(ctx: WeaponContext): PersistentFireSession {
  const { targetX, targetY, viewportX, viewportY, engine } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const damage = ctx.config?.damage ?? BASE_TOGGLES.damage;
  const blackHoleRadius =
    ctx.config?.blackHoleRadius ?? BASE_TOGGLES.blackHoleRadius;
  const coreRadius =
    ctx.config?.blackHoleCoreRadius ?? BASE_TOGGLES.blackHoleCoreRadius;
  const durationMs =
    ctx.config?.blackHoleDurationMs ?? BASE_TOGGLES.blackHoleDurationMs;
  const burnDps = ctx.config?.burnDps ?? BASE_TOGGLES.burnDps;
  const burnDurationMs =
    ctx.config?.burnDurationMs ?? BASE_TOGGLES.burnDurationMs;
  const burnDecayPerSecond =
    ctx.config?.burnDecayPerSecond ?? BASE_TOGGLES.burnDecayPerSecond;
  const eventHorizonRadius =
    ctx.config?.eventHorizonRadius ?? BASE_TOGGLES.eventHorizonRadius;
  const eventHorizonDurationMs =
    ctx.config?.eventHorizonDurationMs ?? BASE_TOGGLES.eventHorizonDurationMs;

  // Singleton guard — refuse if a black hole is already active
  if (engine.getBlackHole()?.active) {
    // Return an inert session that does nothing
    return {
      mode: "persistent",
      begin: () => [],
      abort: () => void 0,
      get active() {
        return false;
      },
    };
  }

  let _active = false;
  let _collapseTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    mode: "persistent",

    begin(): WeaponCommand[] {
      const started = engine.startBlackHole(
        targetX,
        targetY,
        blackHoleRadius,
        coreRadius,
        durationMs,
        damage,
        WeaponId.VoidPulse,
      );

      if (!started) {
        return [];
      }

      _active = true;

      // Schedule the collapse VFX slightly before Engine clears the black hole
      _collapseTimer = setTimeout(() => {
        _active = false;
        _collapseTimer = null;
        // T3: spawn persistent event horizon trap after collapse
        if (tier >= WeaponTier.TIER_THREE) {
          engine.startEventHorizon(
            targetX,
            targetY,
            eventHorizonRadius,
            eventHorizonDurationMs,
            WeaponId.VoidPulse,
          );
        }
      }, durationMs + 100);

      const commands: WeaponCommand[] = [];

      // Pixi: create gravitational lensing effect (id stored in blackHoleVfxIdRef)
      commands.push({
        kind: "spawnEffect",
        descriptor: { type: "createBlackHole", x: targetX, y: targetY },
      });

      // SVG overlay — void is in OVERLAY_EFFECT_WEAPONS
      commands.push({
        kind: "spawnEffect",
        descriptor: {
          type: "overlayEffect",
          weaponId: WeaponId.VoidPulse,
          viewportX,
          viewportY,
        },
      });

      // T2+: burn DoT ring during the gravity well phase
      if (tier >= WeaponTier.TIER_TWO) {
        commands.push({
          kind: "burnRadius",
          cx: targetX,
          cy: targetY,
          radius: coreRadius * 2,
          peakDps: burnDps,
          durationMs: burnDurationMs,
          decayPerSecond: burnDecayPerSecond,
        });
      }

      return commands;
    },

    abort(): void {
      if (_collapseTimer !== null) {
        clearTimeout(_collapseTimer);
        _collapseTimer = null;
      }
      _active = false;
    },

    get active(): boolean {
      return _active;
    },
  };
}
