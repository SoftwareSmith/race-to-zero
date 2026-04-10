/**
 * Canvas-rendered health bar drawn above a bug entity after it takes damage.
 * Fades out after HEALTHBAR_SHOW_DURATION milliseconds.
 */

/** How long (ms) a healthbar remains visible after the last hit. */
export const HEALTHBAR_SHOW_DURATION = 1500;

/** Fade starts at this elapsed ms — bar is fully opaque before this. */
const FADE_START_MS = 800;

/**
 * Draw a health bar above a bug on the game canvas.
 *
 * @param ctx        - Canvas 2D context
 * @param x          - Bug's current render X (canvas-local, already interpolated)
 * @param y          - Bug's current render Y (canvas-local, already interpolated)
 * @param hp         - Current HP
 * @param maxHp      - Maximum HP (bar hidden when maxHp ≤ 1)
 * @param scaledSize - Bug's final rendered size (after all multipliers)
 * @param elapsed    - Milliseconds since the last hit
 */
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  scaledSize: number,
  elapsed: number,
): void {
  // Single-HP bugs don't need a health bar — defeat is immediate
  if (maxHp <= 1 || elapsed >= HEALTHBAR_SHOW_DURATION) return;

  const fadeAlpha =
    elapsed < FADE_START_MS
      ? 1.0
      : 1.0 - (elapsed - FADE_START_MS) / (HEALTHBAR_SHOW_DURATION - FADE_START_MS);

  if (fadeAlpha <= 0) return;

  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const barWidth = Math.max(scaledSize * 1.5, 20);
  const barHeight = 4;
  const barX = x - barWidth / 2;
  const barY = y - scaledSize * 0.9 - barHeight - 2;

  ctx.save();
  ctx.globalAlpha = fadeAlpha * 0.92;

  // Dark background track
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.beginPath();
  ctx.roundRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2, 2);
  ctx.fill();

  // Colored fill — green → amber → red based on remaining HP fraction
  if (ratio > 0.6) {
    ctx.fillStyle = "#4ade80"; // green
  } else if (ratio > 0.3) {
    ctx.fillStyle = "#fb923c"; // amber
  } else {
    ctx.fillStyle = "#f87171"; // red
  }

  if (ratio > 0) {
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth * ratio, barHeight, 2);
    ctx.fill();
  }

  ctx.restore();
}
