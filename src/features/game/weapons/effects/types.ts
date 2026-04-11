/**
 * effects/types.ts — re-exports WeaponEffectDescriptor and related types
 * from the runtime contract so effects code can import from a stable path.
 */
export type {
  WeaponEffectDescriptor,
  ViewportSegment,
  OverlayExtras,
} from "@game/weapons/runtime/types";
