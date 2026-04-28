/**
 * screenShake — lightweight translate-based screen shake utility.
 *
 * Call triggerShake(element, intensity, durationMs) to shake any DOM element.
 * Element returns to translate 0 0 after the shake completes.
 */

/** Per-weapon shake presets (intensity in px, duration in ms). */
export const SHAKE_PRESETS: Partial<Record<string, { intensity: number; duration: number }>> = {
  nullpointer: { intensity: 6,  duration: 300 },
  plasma:      { intensity: 5,  duration: 280 },
  void:        { intensity: 10, duration: 500 },
  weak:        { intensity: 2,  duration: 120 },
  "hammer-overdrive": { intensity: 11, duration: 260 },
  tierup:      { intensity: 12, duration: 560 },
};

let activeShake:
  | {
      frameId: number;
      element: HTMLElement;
    }
  | null = null;

function resetShake(element: HTMLElement) {
  element.style.translate = "0 0";
}

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

  if (activeShake) {
    window.cancelAnimationFrame(activeShake.frameId);
    resetShake(activeShake.element);
  }

  const startedAt = performance.now();

  const tick = (timestamp: number) => {
    const elapsedMs = timestamp - startedAt;
    const progress = Math.min(1, elapsedMs / durationMs);

    if (progress >= 1) {
      resetShake(el);
      activeShake = null;
      return;
    }

    const falloff = 1 - progress;
    const x = Math.sin(elapsedMs * 0.085) * intensity * falloff;
    const y = Math.cos(elapsedMs * 0.11) * intensity * 0.45 * falloff;
    el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;

    activeShake = {
      element: el,
      frameId: window.requestAnimationFrame(tick),
    };
  };

  activeShake = {
    element: el,
    frameId: window.requestAnimationFrame(tick),
  };
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

export function triggerNamedShake(
  el: HTMLElement,
  presetName: string,
): void {
  const preset = SHAKE_PRESETS[presetName];
  if (preset) {
    triggerShake(el, preset.intensity, preset.duration);
  }
}
