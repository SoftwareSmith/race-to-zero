import { WeaponId } from "@game/types";
import type { WeaponCommand } from "@game/weapons/runtime/types";
import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 1500;

export const NULL_POINTER_TIER_VFX: Record<"base" | "tierOne" | "tierTwo", WeaponTierVfxDefinition> = {
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
};

export function createTargetingOverlay(
  viewportX: number,
  viewportY: number,
  targetX: number,
  targetY: number,
): WeaponCommand {
  return {
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: WeaponId.NullPointer,
      viewportX,
      viewportY,
      extras: {
        targetX,
        targetY,
      },
    },
  };
}

export function createImpactExplosion(x: number, y: number): WeaponCommand {
  return {
    kind: "spawnEffect",
    descriptor: {
      type: "explosion",
      x,
      y,
      radius: 120,
      colorHex: 0xfb7185,
    },
  };
}

export function createBinaryBurst(x: number, y: number): WeaponCommand {
  return {
    kind: "spawnEffect",
    descriptor: { type: "binaryBurst", x, y },
  };
}