/**
 * screenShake — GSAP-powered screen shake utility.
 *
 * Call triggerShake(element, intensity, durationMs) to shake any DOM element.
 * Element returns to x=0, y=0 after the shake completes.
 */

import { gsap } from "gsap";

/** Per-weapon shake presets (intensity in px, duration in ms). */
export const SHAKE_PRESETS: Partial<Record<string, { intensity: number; duration: number }>> = {
  laser:       { intensity: 3,  duration: 200 },
  nullpointer: { intensity: 6,  duration: 300 },
  shockwave:   { intensity: 8,  duration: 400 },
  plasma:      { intensity: 5,  duration: 280 },
  void:        { intensity: 10, duration: 500 },
  flame:       { intensity: 2,  duration: 150 },
};

let activeShake: gsap.core.Tween | null = null;

/**
 * Shake a DOM element with lateral + vertical displacement.
 *
 * @param el        Target element (e.g. the game root div)
 * @param intensity Maximum pixel offset
 * @param durationMs Total shake duration in milliseconds
 */
export function triggerShake(
  el: HTMLElement,
  intensity: number,
  durationMs = 300,
): void {
  if (intensity <= 0) return;

  // Kill previous shake so two weapons firing fast don't fight each other
  if (activeShake) {
    activeShake.kill();
    gsap.set(el, { x: 0, y: 0 });
  }

  const repeatCount = Math.max(2, Math.round(durationMs / 50));
  const singleDuration = durationMs / 1000 / (repeatCount * 2);

  activeShake = gsap.to(el, {
    x: intensity,
    y: intensity * 0.45,
    duration: singleDuration,
    repeat: repeatCount,
    yoyo: true,
    ease: "none",
    onComplete: () => {
      gsap.set(el, { x: 0, y: 0 });
      activeShake = null;
    },
  });
}

/**
 * Convenience: trigger shake for a named weapon using SHAKE_PRESETS.
 * No-op if the weapon has no shake preset.
 */
export function triggerWeaponShake(
  el: HTMLElement,
  weaponId: string,
): void {
  const preset = SHAKE_PRESETS[weaponId];
  if (preset) {
    triggerShake(el, preset.intensity, preset.duration);
  }
}
