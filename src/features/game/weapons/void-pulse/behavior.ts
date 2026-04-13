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

const DAMAGE = 2; // collapse shockring damage
const BLACK_HOLE_RADIUS = 300;
const CORE_RADIUS = 80;
const DURATION_MS = 2000;
const T2_BURN_PEAK_DPS = 1.5;
const T2_BURN_DURATION_MS = 3000;
const T3_EVENT_HORIZON_RADIUS = 200;
const T3_EVENT_HORIZON_DURATION_MS = 5000;

export function createSession(ctx: WeaponContext): PersistentFireSession {
  const { targetX, targetY, viewportX, viewportY, engine } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;

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

    begin(_ctx: WeaponContext): WeaponCommand[] {
      const started = engine.startBlackHole(
        targetX,
        targetY,
        BLACK_HOLE_RADIUS,
        CORE_RADIUS,
        DURATION_MS,
        DAMAGE,
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
            T3_EVENT_HORIZON_RADIUS,
            T3_EVENT_HORIZON_DURATION_MS,
          );
        }
      }, DURATION_MS + 100);

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
          radius: CORE_RADIUS * 2,
          peakDps: T2_BURN_PEAK_DPS,
          durationMs: T2_BURN_DURATION_MS,
          decayPerSecond: 0.5,
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
