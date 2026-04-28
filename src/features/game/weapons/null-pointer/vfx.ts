import { WeaponId } from "@game/types";
import type { WeaponCommand } from "@game/weapons/runtime/types";
import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 1500;

export const NULL_POINTER_TIER_VFX: Record<"base" | "tierOne" | "tierTwo" | "tierThree" | "tierFour", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Precise beam, compact reticle, and focused impact pulse.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Adds broader mark-propagation energy and heavier impact bloom.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Layers a global auto-scaler pulse over the full targeting beam package.",
  },
  tierThree: {
    intensity: "catastrophic",
    summary: "Vector execution adds staged reticle ghosts and linked puncture trails.",
  },
  tierFour: {
    intensity: "catastrophic",
    summary: "Deletion-line overdrive carves a single immaculate seam through marked targets.",
  },
};

export function createTargetingOverlay(
  viewportX: number,
  viewportY: number,
  targetPoints: Array<{ x: number; y: number }>,
  options?: {
    beamGlowWidth?: number;
    beamWidth?: number;
    chaosScale?: number;
    reticleRadius?: number;
    shockwaveRadius?: number;
  },
): WeaponCommand {
  const primaryTarget = targetPoints[0] ?? { x: viewportX, y: viewportY };

  return {
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: WeaponId.NullPointer,
      viewportX,
      viewportY,
      extras: {
        targetPoints,
        targetX: primaryTarget.x,
        targetY: primaryTarget.y,
        beamGlowWidth: options?.beamGlowWidth,
        beamWidth: options?.beamWidth,
        reticleRadius: options?.reticleRadius,
        shockwaveRadius: options?.shockwaveRadius,
        chaosScale: options?.chaosScale,
      },
    },
  };
}

export function createImpactExplosion(
  x: number,
  y: number,
  radius = 120,
  colorHex = 0xfb7185,
): WeaponCommand {
  return {
    kind: "spawnEffect",
    descriptor: {
      type: "explosion",
      x,
      y,
      radius,
      colorHex,
    },
  };
}

export function createBinaryBurst(x: number, y: number): WeaponCommand {
  return {
    kind: "spawnEffect",
    descriptor: { type: "binaryBurst", x, y },
  };
}