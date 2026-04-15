/**
 * effects/adapter.ts — maps WeaponEffectDescriptor values to concrete
 * VfxEngine calls and overlay event enqueueing.
 *
 * The adapter is intentionally kept thin: it translates the weapon plugin's
 * declarative intent into imperative VFX calls with no business logic.
 */

import type { WeaponEffectDescriptor, ExecutionContext } from "@game/weapons/runtime/types";
import { triggerNamedShake, triggerWeaponShake } from "@game/utils/screenShake";

/**
 * Apply a single WeaponEffectDescriptor using the execution context.
 * Safe to call with a null vfx (tests, server-side rendering).
 */
export function applyEffectDescriptor(
  descriptor: WeaponEffectDescriptor,
  ctx: ExecutionContext,
): void {
  // Cast to any for internal VfxEngine methods accessed as private (as any)
   
  const vfx = ctx.vfx as any;

  switch (descriptor.type) {
    case "sprayParticles":
      vfx?.spawnSprayParticles(
        descriptor.x,
        descriptor.y,
        descriptor.angleDeg,
        descriptor.coneDeg,
        descriptor.count,
      );
      break;

    case "toxicCloud":
      vfx?.addToxicCloud(
        descriptor.x,
        descriptor.y,
        descriptor.radius,
        descriptor.durationMs,
      );
      break;

    case "firePatch":
      vfx?.addFirePatch(
        descriptor.x,
        descriptor.y,
        descriptor.radius,
        descriptor.durationMs,
      );
      break;

    case "burnScar":
      vfx?.addBurnScar(
        descriptor.x1,
        descriptor.y1,
        descriptor.x2,
        descriptor.y2,
      );
      break;

    case "crack":
      vfx?.addCrack(descriptor.x, descriptor.y);
      break;

    case "explosion":
      vfx?.spawnExplosion(
        descriptor.x,
        descriptor.y,
        descriptor.radius,
        descriptor.colorHex,
      );
      break;

    case "lightning":
      vfx?.spawnLightning(
        descriptor.nodes,
        descriptor.lifetimeMs,
        descriptor.colorHex,
      );
      break;

    case "sparkCrown":
      vfx?.spawnSparkCrown(descriptor.x, descriptor.y, descriptor.colorHex);
      break;

    case "binaryBurst":
      vfx?.spawnBinaryBurst(descriptor.x, descriptor.y);
      break;

    case "empBurst":
      vfx?.spawnEMP(descriptor.x, descriptor.y, descriptor.count);
      break;

    case "plasmaImplosion":
      vfx?.spawnPlasmaImplosion(descriptor.x, descriptor.y, descriptor.radius);
      break;

    case "plasmaExplosion": {
      const ex = descriptor.x;
      const ey = descriptor.y;
      const delay = descriptor.delayMs;
      setTimeout(() => {
        vfx?.spawnPlasmaFountain(ex, ey);
        vfx?.addPlasmaCrater(ex, ey);
      }, delay);
      break;
    }

    case "createBlackHole": {
      if (vfx && typeof vfx.createBlackHole === "function") {
        const bhId: string = vfx.createBlackHole(descriptor.x, descriptor.y);
        ctx.blackHoleVfxIdRef.current = bhId;
      }
      break;
    }

    case "voidCollapse": {
      const bhId = ctx.blackHoleVfxIdRef.current;
      if (bhId && vfx && typeof vfx.destroyBlackHole === "function") {
        vfx.destroyBlackHole(bhId);
        ctx.blackHoleVfxIdRef.current = null;
      }
      vfx?.spawnVoidCollapse(descriptor.x, descriptor.y, descriptor.radius);
      vfx?.spawnExplosion(
        descriptor.x,
        descriptor.y,
        descriptor.radius * 0.6,
        0xc084fc,
      );
      break;
    }

    case "tracerLine":
      vfx?.addTracerLine(
        descriptor.x1,
        descriptor.y1,
        descriptor.x2,
        descriptor.y2,
        descriptor.durationMs,
      );
      break;

    case "overlayEffect":
      ctx.enqueueOverlay(
        descriptor.weaponId,
        descriptor.viewportX,
        descriptor.viewportY,
        descriptor.extras,
      );
      break;

    default: {
      // Exhaustive check — TypeScript will error if a case is missing
      const _exhaustive: never = descriptor;
      void _exhaustive;
    }
  }
}

/** Trigger the screen shake preset for a weapon (no-op if no preset defined). */
export function triggerShakeForWeapon(
  canvas: HTMLElement | null,
  weaponId: string,
): void {
  if (canvas) triggerWeaponShake(canvas, weaponId);
}

export function triggerNamedScreenShake(
  canvas: HTMLElement | null,
  presetName: string,
): void {
  if (canvas) triggerNamedShake(canvas, presetName);
}
