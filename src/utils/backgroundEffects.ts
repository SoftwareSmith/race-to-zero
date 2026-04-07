import { BUG_VARIANT_CONFIG, getBugVariantColor, normalizeBugCounts } from "../constants/bugs";
import type { BugCounts, BugParticle, BugVariant } from "../types/dashboard";
import { drawBugSprite } from "./bugSprite";

export interface BugState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  variant: BugVariant;
  opacity: number;
}

export interface BugSwarmOptions {
  counts: BugCounts;
  width: number;
  height: number;
}

/**
 * BugSwarm manages a swarm of bugs moving around the screen.
 * Each bug has a variant (low, medium, high, urgent) which affects size, opacity, and color.
 */
export class BugSwarm {
  bugs: BugState[] = [];
  width: number;
  height: number;

  constructor(options: BugSwarmOptions) {
    this.width = options.width;
    this.height = options.height;

    // create bugs for each variant count
    Object.entries(normalizeBugCounts(options.counts)).forEach(([variant, count]) => {
      for (let i = 0; i < count; i++) {
        const bugVariant = variant as BugVariant;
        const variantConfig = BUG_VARIANT_CONFIG[bugVariant];

        // randomized swarming velocity
        const speed = 0.5 + Math.random() * 1;
        const angle = Math.random() * Math.PI * 2;

        this.bugs.push({
          variant: bugVariant,
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 4 + variantConfig.sizeBoost,
          opacity: 0.4 + Math.random() * 0.5,
        });
      }
    });
  }

  /** Move all bugs and handle simple edge bounce */
  update() {
    this.bugs.forEach((b) => {
      b.x += b.vx;
      b.y += b.vy;

      // slight random jitter for natural swarm
      b.vx += (Math.random() - 0.5) * 0.05;
      b.vy += (Math.random() - 0.5) * 0.05;

      // edge bounce
      if (b.x < 0) { b.x = 0; b.vx *= -1; }
      if (b.x > this.width) { b.x = this.width; b.vx *= -1; }
      if (b.y < 0) { b.y = 0; b.vy *= -1; }
      if (b.y > this.height) { b.y = this.height; b.vy *= -1; }

      // clamp max speed for smooth motion
      const maxSpeed = 2;
      b.vx = Math.max(Math.min(b.vx, maxSpeed), -maxSpeed);
      b.vy = Math.max(Math.min(b.vy, maxSpeed), -maxSpeed);
    });
  }

  /** Draw all bugs to canvas */
  draw(ctx: CanvasRenderingContext2D) {
    this.bugs.forEach((b) => {
      drawBugSprite(ctx, {
        x: b.x,
        y: b.y,
        size: b.size,
        color: getBugVariantColor(b.variant),
        opacity: b.opacity,
        variant: b.variant,
      });
    });
  }

  /** Return bug under click or null */
  getClickedBug(x: number, y: number): BugState | null {
    for (const b of this.bugs) {
      const dx = b.x - x;
      const dy = b.y - y;
      const r = b.size / 2;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  /** Returns a snapshot of all bugs for game logic */
  getAllBugs(): BugState[] {
    return this.bugs;
  }
}

/** Convenience function to generate BugParticles for React state */
export function createBugParticlesFromCounts(counts: BugCounts): BugParticle[] {
  const swarm = new BugSwarm({ counts, width: 800, height: 600 });
  return swarm.getAllBugs().map((b) => ({
    x: (b.x / 800) * 100,
    y: (b.y / 600) * 100,
    size: b.size,
    variant: b.variant,
    opacity: b.opacity,
    driftX: b.vx,
    driftY: b.vy,
    delay: Math.random() * 6,
    duration: 8 + Math.random() * 6,
  }));
}