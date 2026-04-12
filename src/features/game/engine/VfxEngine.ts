/**
 * VfxEngine — World-class WebGL particle & decal engine powered by Pixi.js v8.
 *
 * Architecture:
 *  - Additive blend container: fire, sparks, plasma (layered glow)
 *  - Normal blend container: smoke, debris chunks
 *  - Decal container: persistent cracks, char marks, frost, burn scars
 *  - Lightning graphics: live-redrawn per-frame with noise displacement
 */

import {
  Application,
  Container,
  Graphics,
  type ColorSource,
} from "pixi.js";
// ── Particle types ────────────────────────────────────────────────────────────

const enum PType {
  FIRE = 0,
  SPARK = 1,
  EMBER = 2,
  SMOKE = 3,
  DEBRIS = 4,
  PLASMA = 5,
  MIST = 6,
}

const MAX_PARTICLES = 1400;
const MAX_DECALS = 180;
const MAX_FIRE_TRAIL_DECALS = 36;

interface Particle {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  life: number; // ms remaining
  maxLife: number; // total ms
  size: number;
  maxSize: number;
  type: PType;
  r: number;
  g: number;
  b: number;
  rotation: number;
  rotSpeed: number;
}

// ── Decal types ───────────────────────────────────────────────────────────────

interface Decal {
  gfx: Graphics;
  createdAt: number;
  lifetime: number;
  initialAlpha: number;
  container: Container;
}

// ── Lightning arc ─────────────────────────────────────────────────────────────

interface LightningArc {
  nodes: Array<{ x: number; y: number }>;
  noiseSeeds: number[]; // per-segment wiggle seeds for flicker
  createdAt: number;
  lifetime: number;
  color: number; // hex int
}

// ── Noise helper ──────────────────────────────────────────────────────────────

function hash(n: number): number {
  let x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}

function noise1(t: number): number {
  return (hash(t) - 0.5) * 2;
}

// ── Color lerp ───────────────────────────────────────────────────────────────

function lerpColor(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number,
): [number, number, number] {
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ];
}

function toHex(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

// ── VfxEngine ────────────────────────────────────────────────────────────────

export class VfxEngine {
  readonly app: Application;

  private additiveContainer!: Container;   // fire, sparks, plasma
  private normalContainer!: Container;     // smoke, debris
  private decalContainer!: Container;      // persistent marks
  private lightningGfx!: Graphics;         // redrawn each tick

  private particles: Particle[] = [];
  private decals: Decal[] = [];
  private lightningArcs: LightningArc[] = [];

  private gfxPool: Graphics[] = [];
  private initialized = false;
  private _w = 800;
  private _h = 600;

  constructor() {
    this.app = new Application();
  }

  /** Async init — must be called before any spawn method. */
  async init(width: number, height: number): Promise<void> {
    this._w = width;
    this._h = height;

    await this.app.init({
      width,
      height,
      backgroundAlpha: 0,
      antialias: false,
      resolution: 1,
      powerPreference: "high-performance",
      preference: "webgl",
    });

    // ── Layering ─────────────────────────────────────────────
    this.decalContainer = new Container();
    this.normalContainer = new Container();
    this.lightningGfx = new Graphics();
    this.additiveContainer = new Container();

    this.app.stage.addChild(this.decalContainer);
    this.app.stage.addChild(this.normalContainer);
    this.app.stage.addChild(this.lightningGfx);
    this.app.stage.addChild(this.additiveContainer);

    this.initialized = true;
  }

  // ── Pool helpers ──────────────────────────────────────────────────────────

  private acquireGfx(): Graphics {
    return this.gfxPool.pop() ?? new Graphics();
  }

  private releaseParticle(p: Particle): void {
    p.gfx.clear();
    p.gfx.removeFromParent();
    this.gfxPool.push(p.gfx);
  }

  private releaseDecal(d: Decal): void {
    d.gfx.clear();
    d.gfx.removeFromParent();
    this.gfxPool.push(d.gfx);
  }

  // ── Particle factory ──────────────────────────────────────────────────────

  private spawnParticle(opts: {
    x: number; y: number;
    vx: number; vy: number;
    ax?: number; ay?: number;
    life: number;
    size: number;
    type: PType;
    r: number; g: number; b: number;
    rotSpeed?: number;
    additive?: boolean;
  }): void {
    if (!this.initialized) return;
    if (this.particles.length >= MAX_PARTICLES) {
      const oldest = this.particles.shift();
      if (oldest) this.releaseParticle(oldest);
    }
    const gfx = this.acquireGfx();
    const p: Particle = {
      gfx,
      x: opts.x, y: opts.y,
      vx: opts.vx, vy: opts.vy,
      ax: opts.ax ?? 0, ay: opts.ay ?? 0,
      life: opts.life, maxLife: opts.life,
      size: opts.size, maxSize: opts.size,
      type: opts.type,
      r: opts.r, g: opts.g, b: opts.b,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: opts.rotSpeed ?? (Math.random() - 0.5) * 0.12,
    };
    const container = opts.additive !== false
      ? this.additiveContainer
      : this.normalContainer;
    container.addChild(gfx);
    this.particles.push(p);
  }

  // ── Public spawn methods ──────────────────────────────────────────────────

  /**
   * Spawn a cone of fire particles — additive blend stacks for inferno effect.
   * @param x,y      Origin (viewport coords)
   * @param angleDeg Direction in degrees (0=right, 90=down)
   * @param coneDeg  Full cone opening angle
   * @param count    Number of particles
   */
  spawnFire(
    x: number, y: number,
    angleDeg: number, coneDeg: number,
    count = 28,
  ): void {
    const half = (coneDeg / 2) * (Math.PI / 180);
    const baseRad = (angleDeg * Math.PI) / 180;
    for (let i = 0; i < count; i++) {
      const a = baseRad + (Math.random() - 0.5) * 2 * half;
      const speed = 180 + Math.random() * 280;
      const life = 800 + Math.random() * 1400;
      const size = 10 + Math.random() * 14;
      // Colour: orange → yellow → white gradient based on speed
      const hot = speed / 460;
      const [r, g, b] = lerpColor(220, 80, 20, 255, 255, 200, hot);
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        ay: -38,          // fire rises slightly
        life, size, type: PType.FIRE,
        r, g, b,
        additive: true,
      });
    }
    // Embers
    for (let i = 0; i < Math.ceil(count * 0.6); i++) {
      const a = baseRad + (Math.random() - 0.5) * 2 * half * 1.2;
      const speed = 60 + Math.random() * 120;
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed + (Math.random() - 0.5) * 30,
        vy: Math.sin(a) * speed - 20,
        ay: -15,
        life: 1800 + Math.random() * 1200,
        size: 2 + Math.random() * 4,
        type: PType.EMBER,
        r: 255, g: 160, b: 40,
        additive: true,
      });
    }
  }

  /**
   * Radial explosion of mixed fire/debris/smoke.
   */
  spawnExplosion(
    x: number, y: number,
    radius: number,
    colorHex = 0xff6600,
  ): void {
    const r = (colorHex >> 16) & 0xff;
    const g = (colorHex >> 8) & 0xff;
    const b = colorHex & 0xff;
    const count = Math.floor(radius * 0.45);
    // Fire fountain
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * radius * 1.4;
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        ay: 60,
        life: 500 + Math.random() * 700,
        size: 6 + Math.random() * 10,
        type: PType.FIRE, r, g, b,
        additive: true,
      });
    }
    // Debris
    for (let i = 0; i < Math.ceil(count * 0.4); i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * radius * 0.8;
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        ay: 180,
        life: 400 + Math.random() * 500,
        size: 4 + Math.random() * 8,
        type: PType.DEBRIS, r: 180, g: 80, b: 20,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        additive: false,
      });
    }
    // Smoke
    for (let i = 0; i < Math.ceil(count * 0.25); i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40,
        ax: 0, ay: -20,
        life: 1000 + Math.random() * 800,
        size: 12 + Math.random() * 18,
        type: PType.SMOKE, r: 90, g: 90, b: 100,
        additive: false,
      });
    }
  }

  /**
   * EMP burst — radial sparks with additive glow.
   */
  spawnEMP(x: number, y: number, count = 60): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 120 + Math.random() * 220;
      // Cyan/white/yellow EMP palette
      const palette: [number, number, number][] = [
        [50, 220, 240], [255, 255, 100], [200, 255, 255], [255, 255, 255],
      ];
      const [r, g, b] = palette[i % palette.length];
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 300 + Math.random() * 400,
        size: 2 + Math.random() * 5,
        type: PType.SPARK, r, g, b,
        additive: true,
      });
    }
  }

  /**
   * Plasma fountain — blue/white orbs radiate outward.
   */
  spawnPlasmaFountain(x: number, y: number, count = 80): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 300;
      const hot = Math.random();
      const [r, g, b] = lerpColor(20, 120, 255, 220, 240, 255, hot);
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        ay: 30,
        life: 400 + Math.random() * 700,
        size: 3 + Math.random() * 9,
        type: PType.PLASMA, r, g, b,
        additive: true,
      });
    }
  }

  /**
   * Lightning arc — 3 noise-displaced strands per segment, redrawn each tick.
   */
  spawnLightning(
    nodes: Array<{ x: number; y: number }>,
    lifetimeMs = 800,
    color = 0x6ee7b7,
  ): void {
    if (!this.initialized || nodes.length < 2) return;
    const seeds: number[] = [];
    for (let i = 0; i < (nodes.length - 1) * 8; i++) {
      seeds.push(Math.random() * 999);
    }
    this.lightningArcs.push({
      nodes,
      noiseSeeds: seeds,
      createdAt: performance.now(),
      lifetime: lifetimeMs,
      color,
    });
    // Spark burst at each node
    for (const n of nodes) {
      const cr = (color >> 16) & 0xff;
      const cg = (color >> 8) & 0xff;
      const cb = color & 0xff;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawnParticle({
          x: n.x, y: n.y,
          vx: Math.cos(a) * (60 + Math.random() * 120),
          vy: Math.sin(a) * (60 + Math.random() * 120),
          life: 200 + Math.random() * 300,
          size: 2 + Math.random() * 4,
          type: PType.SPARK, r: cr, g: cg, b: cb,
          additive: true,
        });
      }
    }
  }

  // ── Decal spawners ────────────────────────────────────────────────────────

  /**
   * Fractal crack network at (x, y) — persists 8 seconds.
   */
  addCrack(x: number, y: number): void {
    if (!this.initialized) return;
    const gfx = this.acquireGfx();
    gfx.x = x;
    gfx.y = y;
    this._drawCrack(gfx);
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: 8000,
      initialAlpha: 0.92,
      container: this.decalContainer,
    });
  }

  private _drawCrack(gfx: Graphics): void {
    const armCount = 5 + Math.floor(Math.random() * 3);
    for (let arm = 0; arm < armCount; arm++) {
      const baseAngle = (arm / armCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      let cx = 0, cy = 0;
      let angle = baseAngle;
      const mainLen = 18 + Math.random() * 22;
      const steps = 4 + Math.floor(Math.random() * 3);
      const stepLen = mainLen / steps;

      gfx.moveTo(cx, cy);
      // Main arm — jagged polyline
      for (let s = 0; s < steps; s++) {
        angle += (Math.random() - 0.5) * 0.6;
        cx += Math.cos(angle) * stepLen;
        cy += Math.sin(angle) * stepLen;
        gfx.lineTo(cx, cy);
      }
      gfx.stroke({ color: 0xfbbf24, width: 1.6, alpha: 0.85 });

      // Sub-crack from midpoint of main arm
      const midX = cx * 0.5;
      const midY = cy * 0.5;
      const subAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
      const subLen = mainLen * 0.45;
      gfx.moveTo(midX, midY);
      gfx.lineTo(
        midX + Math.cos(subAngle) * subLen,
        midY + Math.sin(subAngle) * subLen,
      );
      gfx.stroke({ color: 0xfde68a, width: 0.9, alpha: 0.6 });

      // Micro-crack from sub-crack midpoint
      const mcX = midX + Math.cos(subAngle) * subLen * 0.5;
      const mcY = midY + Math.sin(subAngle) * subLen * 0.5;
      const mcAngle = subAngle + (Math.random() - 0.5) * 1.2;
      gfx.moveTo(mcX, mcY);
      gfx.lineTo(
        mcX + Math.cos(mcAngle) * subLen * 0.35,
        mcY + Math.sin(mcAngle) * subLen * 0.35,
      );
      gfx.stroke({ color: 0xfef3c7, width: 0.6, alpha: 0.4 });
    }
    // Impact center dot
    gfx.circle(0, 0, 3.5);
    gfx.fill({ color: 0xfbbf24, alpha: 0.7 });
  }

  /**
   * Black char ellipse at fire impact point — persists 6 seconds.
   */
  addCharMark(x: number, y: number, radius = 40): void {
    if (!this.initialized) return;
    const MAX_CHAR = 12;
    while (this.decals.filter(d => d.gfx.label === "char").length >= MAX_CHAR) {
      const oldest = this.decals.find(d => d.gfx.label === "char");
      if (oldest) {
        this.releaseDecal(oldest);
        this.decals = this.decals.filter(d => d !== oldest);
      } else break;
    }
    const gfx = this.acquireGfx();
    gfx.label = "char";
    gfx.x = x;
    gfx.y = y;
    // Char ellipse — multiple overlapping gradients
    gfx.ellipse(0, 0, radius * 1.1, radius * 0.55);
    gfx.fill({ color: 0x1a0a00, alpha: 0.7 });
    gfx.ellipse(0, 0, radius * 0.65, radius * 0.32);
    gfx.fill({ color: 0x0a0500, alpha: 0.85 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: 6000,
      initialAlpha: 0.85,
      container: this.decalContainer,
    });
  }

  /**
   * Orange-red glowing burn scar along a laser beam — fades over 2 seconds.
   */
  addBurnScar(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.initialized) return;
    const gfx = this.acquireGfx();
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.stroke({ color: 0xff4400, width: 3, alpha: 0.75 });
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.stroke({ color: 0xff8800, width: 1.2, alpha: 0.9 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: 2000,
      initialAlpha: 0.9,
      container: this.decalContainer,
    });
  }

  // ── Bug Spray: lime-green aerosol cone ──────────────────────────────────────

  spawnSprayParticles(x: number, y: number, angleDeg: number, coneDeg = 50, count = 28): void {
    if (!this.initialized) return;
    const half = (coneDeg / 2) * (Math.PI / 180);
    const baseAngle = angleDeg * (Math.PI / 180);
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (Math.random() - 0.5) * 2 * half;
      const speed = 120 + Math.random() * 160;
      const life = 350 + Math.random() * 300;
      this.spawnParticle({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        ax: 0, ay: 20,
        life,
        size: 4 + Math.random() * 5,
        type: PType.SMOKE,
        r: 100 + Math.floor(Math.random() * 60),
        g: 200 + Math.floor(Math.random() * 55),
        b: 50 + Math.floor(Math.random() * 60),
        additive: false,
      });
    }
    // Extra bright sparks at nozzle
    for (let i = 0; i < 8; i++) {
      const a = baseAngle + (Math.random() - 0.5) * half;
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * (200 + Math.random() * 80),
        vy: Math.sin(a) * (200 + Math.random() * 80),
        ax: 0, ay: 30,
        life: 200 + Math.random() * 150,
        size: 2.5 + Math.random() * 2,
        type: PType.SPARK,
        r: 160, g: 255, b: 80,
        additive: true,
      });
    }
  }

  addToxicCloud(
    x: number,
    y: number,
    radiusPx: number,
    durationMs: number,
  ): void {
    if (!this.initialized) return;
    // Emitter: spawn a fine mist (no decal circle)
    const start = performance.now();
    const end = start + durationMs;

    const spawnMist = (count = 8) => {
      for (let i = 0; i < count; i++) {
        const dist = Math.random() * radiusPx * 0.7;
        const ang = Math.random() * Math.PI * 2;
        const sx = x + Math.cos(ang) * dist + (Math.random() - 0.5) * 6;
        const sy = y + Math.sin(ang) * dist + (Math.random() - 0.5) * 6;
        const vx = (Math.random() - 0.5) * 24; // gentle horizontal drift
        const vy = -8 + (Math.random() - 0.5) * 8; // slow upward drift
        const life = 2000 + Math.random() * 2200;
        const size = 6 + Math.random() * 10;
        const r = 120 + Math.floor(Math.random() * 40);
        const g = 210 + Math.floor(Math.random() * 45);
        const b = 70 + Math.floor(Math.random() * 40);
        this.spawnParticle({
          x: sx, y: sy,
          vx, vy,
          ax: 0, ay: -6,
          life,
          size,
          type: PType.MIST,
          r, g, b,
          additive: false,
        });
      }
    };

    // Initial seeding: fill cloud with a fine mist
    spawnMist(40);

    const tickerFn = () => {
      const now = performance.now();
      if (now >= end) {
        this.app.ticker.remove(tickerFn);
        return;
      }
      // occasional gentle mist puffs to keep the cloud alive
      if (Math.random() < 0.45) spawnMist(4 + Math.floor(Math.random() * 6));
    };

    this.app.ticker.add(tickerFn);
  }

  // ── Freeze Blast: scattered snowflake decals ──────────────────────────────

  spawnSnowflakeDecals(x: number, y: number, count = 10, radius = 160): void {
    if (!this.initialized) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = (0.3 + Math.random() * 0.7) * radius;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist;
      const gfx = this.acquireGfx();
      gfx.x = sx;
      gfx.y = sy;
      const spikes = 6;
    const outerLen = 4 + Math.random() * 14;
      const innerLen = outerLen * 0.38;
      for (let s = 0; s < spikes; s++) {
        const a = (s / spikes) * Math.PI * 2;
        // Main arm
        gfx.moveTo(0, 0);
        gfx.lineTo(Math.cos(a) * outerLen, Math.sin(a) * outerLen);
        gfx.stroke({ color: 0xbae6fd, width: 1.5, alpha: 0.9 });
        // Cross-bars on each arm
        const mx = Math.cos(a) * outerLen * 0.55;
        const my = Math.sin(a) * outerLen * 0.55;
        const ca = a + Math.PI / 2;
        gfx.moveTo(mx + Math.cos(ca) * innerLen, my + Math.sin(ca) * innerLen);
        gfx.lineTo(mx - Math.cos(ca) * innerLen, my - Math.sin(ca) * innerLen);
        gfx.stroke({ color: 0xe0f2fe, width: 1, alpha: 0.7 });
      }
      gfx.circle(0, 0, 2.5);
      gfx.fill({ color: 0xffffff, alpha: 0.9 });
      this.decalContainer.addChild(gfx);
      this.decals.push({
        gfx,
        createdAt: performance.now(),
        lifetime: 2200 + Math.random() * 800,
        initialAlpha: 0.88,
        container: this.decalContainer,
      });
    }
  }

  // ── Flamethrower: ground fire patch ──────────────────────────────────────

  /**
   * Fire patch with persistent ember/micro-flame emitter.
   * Emits small fire/ember particles within the patch for the given duration.
   */
  addFirePatch(x: number, y: number, radiusPx: number, durationMs = 700): void {
    if (!this.initialized) return;
    const gfx = this.acquireGfx();
    gfx.x = x;
    gfx.y = y;
    // Keep a subtle scorch decal as base (more translucent)
    gfx.ellipse(0, 0, radiusPx, radiusPx * 0.45);
    gfx.fill({ color: 0xff6a00, alpha: 0.24 });
    gfx.ellipse(0, 0, radiusPx * 0.5, radiusPx * 0.22);
    gfx.fill({ color: 0xffd200, alpha: 0.18 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: durationMs,
      initialAlpha: 0.75,
      container: this.decalContainer,
    });

    // Emitter: spawn gentle embers/small flames inside the patch
    const end = performance.now() + durationMs;

    const spawnEmbers = (count = 8) => {
      for (let i = 0; i < count; i++) {
        const dist = Math.random() * radiusPx * 0.75;
        const ang = Math.random() * Math.PI * 2;
        const sx = x + Math.cos(ang) * dist + (Math.random() - 0.5) * 8;
        const sy = y + Math.sin(ang) * dist + (Math.random() - 0.5) * 8;
        // gentle outward drift + upward lift
        const vx = (Math.random() - 0.5) * 36 + Math.cos(ang) * 6;
        const vy = -12 + (Math.random() - 0.5) * 18;
        const life = 400 + Math.random() * 1800;
        const size = 2 + Math.random() * 14;
        // Ember color leans bright yellow/orange
        const heat = 0.7 + Math.random() * 0.3;
        const [r, g, b] = lerpColor(250, 250, 7, 200, 70, 12, heat);
        // bright additive ember
        this.spawnParticle({
          x: sx, y: sy,
          vx, vy,
          ay: -10,
          life,
          size,
          type: PType.FIRE,
          r, g, b,
          additive: true,
        });

        // occasional larger glow blob to simulate bloom
        if (Math.random() < 0.25) {
          this.spawnParticle({
            x: sx + (Math.random() - 0.5) * 10, y: sy + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 10, vy: -6 + (Math.random() - 0.5) * 8,
            ay: -6,
            life: 500 + Math.random() * 900,
            size: 10 + Math.random() * 18,
            type: PType.PLASMA,
            r: 255, g: 200 + Math.floor(Math.random() * 55), b: 90,
            additive: true,
          });
        }

        // small smoke puffs for volume
        if (Math.random() < 0.6) {
          this.spawnParticle({
            x: sx + (Math.random() - 0.5) * 8, y: sy + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 14, vy: -8 + (Math.random() - 0.5) * 8,
            ay: -6,
            life: 1200 + Math.random() * 2000,
            size: 8 + Math.random() * 14,
            type: PType.SMOKE,
            r: 110 + Math.floor(Math.random() * 40), g: 100 + Math.floor(Math.random() * 50), b: 90,
            additive: false,
          });
        }
      }
    };

    // Seed initial embers and keep occasional bursts while lifetime remains
    spawnEmbers(40);
    const tickerFn = () => {
      const now = performance.now();
      if (now >= end) {
        this.app.ticker.remove(tickerFn);
        return;
      }
      // more frequent gentle bursts for a sustained flamethrower look
      if (Math.random() < 0.75) spawnEmbers(4 + Math.floor(Math.random() * 8));
    };
    this.app.ticker.add(tickerFn);
  }

  addFireTrailStamp(x: number, y: number, radiusPx = 56, durationMs = 180): void {
    if (!this.initialized) return;

    while (this.decals.filter((d) => d.gfx.label === "fireTrail").length >= MAX_FIRE_TRAIL_DECALS) {
      const oldest = this.decals.find((d) => d.gfx.label === "fireTrail");
      if (!oldest) break;
      this.releaseDecal(oldest);
      this.decals = this.decals.filter((d) => d !== oldest);
    }

    if (this.decals.length >= MAX_DECALS) {
      const oldest = this.decals.shift();
      if (oldest) this.releaseDecal(oldest);
    }

    const gfx = this.acquireGfx();
    gfx.label = "fireTrail";
    gfx.x = x;
    gfx.y = y;
    gfx.ellipse(0, 0, radiusPx, radiusPx * 0.38);
    gfx.fill({ color: 0xff7a18, alpha: 0.16 });
    gfx.ellipse(0, 0, radiusPx * 0.45, radiusPx * 0.18);
    gfx.fill({ color: 0xffd86b, alpha: 0.1 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: durationMs,
      initialAlpha: 0.55,
      container: this.decalContainer,
    });

    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * radiusPx * 0.45;
      const sx = x + Math.cos(ang) * dist;
      const sy = y + Math.sin(ang) * dist;
      this.spawnParticle({
        x: sx,
        y: sy,
        vx: (Math.random() - 0.5) * 22,
        vy: -18 + (Math.random() - 0.5) * 10,
        ay: -8,
        life: 180 + Math.random() * 180,
        size: 4 + Math.random() * 5,
        type: PType.FIRE,
        r: 255,
        g: 190 + Math.floor(Math.random() * 40),
        b: 80,
        additive: true,
      });
    }
  }

  spawnFlameTrailBurst(x: number, y: number, angleDeg: number, count = 4): void {
    if (!this.initialized) return;
    const half = 18 * (Math.PI / 180);
    const baseRad = (angleDeg * Math.PI) / 180;
    for (let i = 0; i < count; i++) {
      const a = baseRad + (Math.random() - 0.5) * 2 * half;
      const speed = 70 + Math.random() * 110;
      this.spawnParticle({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 10,
        ay: -18,
        life: 90 + Math.random() * 120,
        size: 5 + Math.random() * 4,
        type: PType.FIRE,
        r: 255,
        g: 200 + Math.floor(Math.random() * 30),
        b: 90 + Math.floor(Math.random() * 20),
        additive: true,
      });
    }
  }

  // ── Static Net: expanding wire-mesh ring ──────────────────────────────────

  spawnNetCast(x: number, y: number, radiusPx: number, durationMs: number): void {
    if (!this.initialized) return;
    const gfx = this.acquireGfx();
    gfx.x = x;
    gfx.y = y;
    // Radial spokes
    const spokes = 10;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      gfx.moveTo(0, 0);
      gfx.lineTo(Math.cos(a) * radiusPx, Math.sin(a) * radiusPx);
      gfx.stroke({ color: 0xe2e8f0, width: 1.2, alpha: 0.7 });
    }
    // Concentric rings
    const rings = 3;
    for (let r = 1; r <= rings; r++) {
      gfx.circle(0, 0, radiusPx * (r / rings));
      gfx.stroke({ color: 0xffffff, width: 1, alpha: 0.55 });
    }
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: durationMs,
      initialAlpha: 0.85,
      container: this.decalContainer,
    });
  }

  // ── Chain Zap: spark crown at bounce point ────────────────────────────────

  spawnSparkCrown(x: number, y: number, colorHex = 0xfbbf24): void {
    if (!this.initialized) return;
    const spokes = 8;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const speed = 90 + Math.random() * 70;
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        ax: 0, ay: 0,
        life: 200 + Math.random() * 150,
        size: 3 + Math.random() * 3,
        type: PType.SPARK,
        r: (colorHex >> 16) & 0xff,
        g: (colorHex >> 8) & 0xff,
        b: colorHex & 0xff,
        additive: true,
      });
    }
  }

  // ── Legacy implosion spiral effect (unused by current loadout) ───────────

  spawnPlasmaImplosion(x: number, y: number, radiusPx: number): void {
    if (!this.initialized) return;
    for (let i = 0; i < 40; i++) {
      const startAngle = Math.random() * Math.PI * 2;
      const r = radiusPx * (0.5 + Math.random() * 0.5);
      const sx = x + Math.cos(startAngle) * r;
      const sy = y + Math.sin(startAngle) * r;
      // Velocity points inward + clockwise tangent
      const inwardX = x - sx;
      const inwardY = y - sy;
      const tangX = -inwardY;
      const tangY = inwardX;
      const len = Math.hypot(inwardX, inwardY) || 1;
      const speed = 80 + Math.random() * 120;
      const mix = 0.7;
      this.spawnParticle({
        x: sx, y: sy,
        vx: (inwardX / len * mix + tangX / len * (1 - mix)) * speed,
        vy: (inwardY / len * mix + tangY / len * (1 - mix)) * speed,
        ax: 0, ay: 0,
        life: 300 + Math.random() * 250,
        size: 3.5 + Math.random() * 4,
        type: PType.PLASMA,
        r: 96, g: 165, b: 250,
        additive: true,
      });
    }
  }

  addPlasmaCrater(x: number, y: number): void {
    if (!this.initialized) return;
    const gfx = this.acquireGfx();
    gfx.x = x;
    gfx.y = y;
    // Radial gradient-like rings
    gfx.circle(0, 0, 60);
    gfx.fill({ color: 0x1e3a5f, alpha: 0.55 });
    gfx.circle(0, 0, 35);
    gfx.fill({ color: 0x3b82f6, alpha: 0.35 });
    gfx.circle(0, 0, 14);
    gfx.fill({ color: 0x93c5fd, alpha: 0.45 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: 4000,
      initialAlpha: 0.9,
      container: this.decalContainer,
    });
  }

  // ── Void Pulse: persistent black-hole visual ─────────────────────────────

  private blackHoleGfxMap = new Map<string, Graphics>();
  private bhIdCounter = 0;

  createBlackHole(x: number, y: number): string {
    if (!this.initialized) return "";
    const id = `bh_${++this.bhIdCounter}`;
    const gfx = this.acquireGfx();
    gfx.x = x;
    gfx.y = y;
    this._drawBlackHole(gfx);
    // Insert between decal and normal layers so it renders under sparks
    this.decalContainer.addChild(gfx);
    this.blackHoleGfxMap.set(id, gfx);
    return id;
  }

  destroyBlackHole(id: string): void {
    const gfx = this.blackHoleGfxMap.get(id);
    if (!gfx) return;
    gfx.clear();
    gfx.removeFromParent();
    this.gfxPool.push(gfx);
    this.blackHoleGfxMap.delete(id);
  }

  /** Call each tick to animate the black hole rings. */
  tickBlackHoleVfx(id: string): void {
    const gfx = this.blackHoleGfxMap.get(id);
    if (!gfx) return;
    gfx.clear();
    this._drawBlackHole(gfx);
  }

  private _drawBlackHole(gfx: Graphics): void {
    const t = performance.now() * 0.001;
    // Accretion rings: pulsing alpha
    const rings = [{ r: 80, color: 0x4c1d95, a: 0.25 }, { r: 55, color: 0x7c3aed, a: 0.35 }, { r: 35, color: 0xa855f7, a: 0.45 }];
    for (const ring of rings) {
      const pulse = 0.15 * Math.sin(t * 3 + ring.r * 0.05);
      gfx.circle(0, 0, ring.r);
      gfx.fill({ color: ring.color, alpha: ring.a + pulse });
    }
    // Hard black core
    gfx.circle(0, 0, 22);
    gfx.fill({ color: 0x000000, alpha: 0.95 });
    // Photon ring
    gfx.circle(0, 0, 28);
    gfx.stroke({ color: 0xc084fc, width: 2.5, alpha: 0.85 });
  }

  spawnVoidCollapse(x: number, y: number, radiusPx: number): void {
    if (!this.initialized) return;
    // Thick violet shock-ring via decal
    const gfx = this.acquireGfx();
    gfx.x = x;
    gfx.y = y;
    gfx.circle(0, 0, radiusPx);
    gfx.stroke({ color: 0xc084fc, width: 8, alpha: 0.9 });
    gfx.circle(0, 0, radiusPx * 0.85);
    gfx.fill({ color: 0x4c1d95, alpha: 0.22 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: 600,
      initialAlpha: 1.0,
      container: this.decalContainer,
    });
    // Plasma burst particles
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 160 + Math.random() * 220;
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        ax: 0, ay: 0,
        life: 400 + Math.random() * 400,
        size: 4 + Math.random() * 6,
        type: PType.PLASMA,
        r: 192, g: 132, b: 252,
        additive: true,
      });
    }
  }

  // ── Null Pointer: binary burst ────────────────────────────────────────────

  spawnBinaryBurst(x: number, y: number): void {
    if (!this.initialized) return;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 60 + Math.random() * 100;
      // Create a tiny Pixi text node using a Graphics approach (draw "0"/"1" as simple rects)
      const gfx = this.acquireGfx();
      gfx.x = x;
      gfx.y = y;
      // Draw a small pixel "1" or "0" shape
      const isBit1 = Math.random() < 0.5;
      if (isBit1) {
        gfx.rect(-1.5, -5, 3, 10);
      } else {
        gfx.rect(-3.5, -5, 7, 10);
        gfx.stroke({ color: 0x00ff88, width: 1.5, alpha: 0.9 });
        gfx.rect(-2.5, -3.5, 5, 7);
        gfx.fill({ color: 0x000000, alpha: 1 });
      }
      gfx.fill({ color: 0x00ff88, alpha: 0.9 });
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      const life = 600 + Math.random() * 400;
      // Simulate via the particle hack: store in normalContainer, tick manually via decal
      this.additiveContainer.addChild(gfx);
      // Animate position via decal lifetime trick (position updated outside normal particle loop)
      this.decals.push({
        gfx,
        createdAt: performance.now(),
        lifetime: life,
        initialAlpha: 0.9,
        container: this.additiveContainer,
      });
      // Store vx/vy on gfx via custom property for the update loop
      (gfx as any).__bvx = vx;
      (gfx as any).__bvy = vy;
    }
  }

  // ── Laser: tracer line ────────────────────────────────────────────────────

  addTracerLine(x1: number, y1: number, x2: number, y2: number, durationMs: number): void {
    if (!this.initialized) return;
    const gfx = this.acquireGfx();
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.stroke({ color: 0xff3333, width: 2.5, alpha: 0.85 });
    // Core bright line
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.stroke({ color: 0xffe4e4, width: 0.8, alpha: 0.7 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: durationMs,
      initialAlpha: 0.9,
      container: this.decalContainer,
    });
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  tick(dtMs: number): void {
    if (!this.initialized) return;
    const now = performance.now();

    // Update particles
    const deadParticles: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dtMs;
      if (p.life <= 0) {
        deadParticles.push(p);
        continue;
      }
      p.x += p.vx * (dtMs / 1000);
      p.y += p.vy * (dtMs / 1000);
      p.vx += p.ax * (dtMs / 1000);
      p.vy += p.ay * (dtMs / 1000);
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.rotation += p.rotSpeed * (dtMs / 1000) * 60;

      const t = Math.max(0, p.life / p.maxLife); // 1=fresh, 0=dead

      // Size curve by type
      let sz: number;
      if (p.type === PType.FIRE) {
        sz = p.maxSize * (t < 0.3 ? t / 0.3 : t);
      } else if (p.type === PType.SMOKE) {
        sz = p.maxSize * (2 - t);
      } else {
        sz = p.maxSize * t;
      }
      sz = Math.max(0.3, sz);

      // Colour fade
      let alpha: number;
      if (p.type === PType.FIRE) {
        // Fire: very quick bright core then fast fade. Use an age-based ease-out fade
        const ageMs = p.maxLife - p.life;
        const fadeMs = Math.min(180, p.maxLife);
        const frac = Math.max(0, Math.min(1, ageMs / fadeMs));
        // stronger ease-out for faster disappearance
        alpha = Math.max(0, Math.pow(1 - frac, 2.4));
      } else if (p.type === PType.SMOKE) {
        // smoke should be relatively soft
        alpha = t * 0.36;
      } else if (p.type === PType.MIST) {
        // mist should be very translucent and lingering
        alpha = t * 0.22;
      } else if (p.type === PType.EMBER) {
        alpha = t * 0.9;
      } else {
        alpha = t;
      }

      // Colour and temperature shifts
      let [r, g, b] = [p.r, p.g, p.b];
      if (p.type === PType.FIRE) {
        // lifeProgress: 0 at birth -> 1 at death
        const lifeProgress = 1 - p.life / p.maxLife;
        // hotter at birth (bright yellow/white), cooler toward end (deep orange/red)
        const [sr, sg, sb] = [255, 240, 160];
        const [er, eg, eb] = [90, 30, 10];
        const mix = Math.min(1, Math.max(0, lifeProgress));
        [r, g, b] = lerpColor(sr, sg, sb, er, eg, eb, mix);
        // Slight darkening as it cools
        const darken = 0.25 * mix;
        r = Math.max(0, Math.floor(r * (1 - darken)));
        g = Math.max(0, Math.floor(g * (1 - darken * 0.9)));
        b = Math.max(0, Math.floor(b * (1 - darken * 0.6)));
      }

      const gfx = p.gfx;
      gfx.clear();
      gfx.x = p.x;
      gfx.y = p.y;
      gfx.alpha = Math.max(0, Math.min(1, alpha));
      gfx.rotation = 0;

      if (p.type === PType.FIRE) {
        const speed = Math.hypot(p.vx, p.vy);
        const stretch = Math.min(2.8, 1.2 + speed / 180);
        gfx.rotation = Math.atan2(p.vy, p.vx);
        gfx.ellipse(0, 0, sz * stretch, sz * 0.72);
        gfx.fill({ color: toHex(r, g, b), alpha: 0.92 });
        gfx.circle(sz * 0.45, 0, sz * 0.42);
        gfx.fill({ color: toHex(Math.min(255, r + 30), Math.min(255, g + 24), Math.min(255, b + 18)), alpha: 0.75 });
      } else if (p.type === PType.PLASMA) {
        gfx.circle(0, 0, sz * 1.15);
        gfx.fill({ color: toHex(r, g, b), alpha: 0.42 });
        gfx.circle(0, 0, sz * 0.7);
        gfx.fill({ color: toHex(Math.min(255, r + 20), Math.min(255, g + 30), Math.min(255, b + 45)), alpha: 0.95 });
        gfx.circle(0, 0, Math.max(1.2, sz * 0.24));
        gfx.fill({ color: 0xffffff, alpha: 0.82 });
      } else if (p.type === PType.SPARK) {
        const speed = Math.hypot(p.vx, p.vy);
        const stretch = Math.min(4.5, 1.6 + speed / 110);
        gfx.rotation = Math.atan2(p.vy, p.vx);
        gfx.roundRect(-sz * 0.35, -sz * 0.22, sz * stretch, sz * 0.44, sz * 0.16);
        gfx.fill({ color: toHex(r, g, b), alpha: 1 });
        gfx.circle(sz * (stretch - 0.25), 0, Math.max(0.8, sz * 0.26));
        gfx.fill({ color: 0xffffff, alpha: 0.8 });
      } else if (p.type === PType.EMBER) {
        gfx.circle(0, 0, sz);
        gfx.fill({ color: toHex(r, g, b), alpha: 0.95 });
        gfx.circle(0, 0, Math.max(0.5, sz * 0.35));
        gfx.fill({ color: 0xfff7d6, alpha: 0.7 });
      } else if (p.type === PType.SMOKE) {
        gfx.ellipse(0, 0, sz * 1.1, sz * 0.86);
        gfx.fill({ color: toHex(r, g, b), alpha: 0.5 });
      } else if (p.type === PType.MIST) {
        // Fine, translucent mist for toxic clouds
        gfx.ellipse(0, 0, sz * 1.2, sz * 0.9);
        gfx.fill({ color: toHex(r, g, b), alpha: 0.36 });
      } else if (p.type === PType.DEBRIS) {
        gfx.rotation = p.rotation;
        gfx.roundRect(-sz * 0.55, -sz * 0.4, sz * 1.1, sz * 0.8, sz * 0.14);
        gfx.fill({ color: toHex(r, g, b), alpha: 1 });
      }
    }
    for (const p of deadParticles) {
      this.releaseParticle(p);
      this.particles = this.particles.filter(x => x !== p);
    }

    // Update decals (fade out)
    const deadDecals: Decal[] = [];
    for (const d of this.decals) {
      const age = now - d.createdAt;
      if (age >= d.lifetime) {
        deadDecals.push(d);
        continue;
      }
      const progress = age / d.lifetime;
      d.gfx.alpha = d.initialAlpha * (1 - progress);
      // Animate binary-burst bits position
      const bvx = (d.gfx as any).__bvx;
      if (bvx !== undefined) {
        const bvy = (d.gfx as any).__bvy;
        d.gfx.x += bvx * (dtMs / 1000);
        d.gfx.y += bvy * (dtMs / 1000);
      }
    }
    for (const d of deadDecals) {
      this.releaseDecal(d);
      this.decals = this.decals.filter(x => x !== d);
    }

    // Update lightning arcs (redraw per frame for flicker)
    this.lightningGfx.clear();
    const deadArcs: LightningArc[] = [];
    for (const arc of this.lightningArcs) {
      const age = now - arc.createdAt;
      if (age >= arc.lifetime) {
        deadArcs.push(arc);
        continue;
      }
      const progress = age / arc.lifetime;
      const alpha = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
      this._drawLightningArc(arc, alpha * 0.9, now);
    }
    for (const a of deadArcs) {
      this.lightningArcs = this.lightningArcs.filter(x => x !== a);
    }
  }

  private _drawLightningArc(arc: LightningArc, alpha: number, now: number): void {
    const t = now * 0.018; // time-based flicker
    for (let seg = 0; seg < arc.nodes.length - 1; seg++) {
      const from = arc.nodes[seg];
      const to = arc.nodes[seg + 1];
      const seedBase = seg * 8;

      // 3 parallel strands with different noise offsets
      const strands: Array<{ offset: number; width: number; colorHex: ColorSource; alpha: number }> = [
        { offset: 0,  width: 2.5, colorHex: arc.color, alpha },
        { offset: 1,  width: 1.2, colorHex: 0xffffff, alpha: alpha * 0.7 },
        { offset: 2,  width: 0.8, colorHex: 0xffffff, alpha: alpha * 0.3 },
      ];

      for (const strand of strands) {
        const pts = this._noisyLine(
          from.x, from.y, to.x, to.y,
          6,
          arc.noiseSeeds.slice(seedBase, seedBase + 8),
          strand.offset,
          t,
        );
        if (pts.length < 2) continue;
        this.lightningGfx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          this.lightningGfx.lineTo(pts[i].x, pts[i].y);
        }
        this.lightningGfx.stroke({ color: strand.colorHex, width: strand.width, alpha: strand.alpha });
      }
    }
  }

  private _noisyLine(
    x1: number, y1: number, x2: number, y2: number,
    segments: number,
    seeds: number[],
    strandOffset: number,
    t: number,
  ): Array<{ x: number; y: number }> {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const perpX = -dy / len;
    const perpY = dx / len;
    const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
    const maxDisplace = Math.min(len * 0.18, 22);
    for (let i = 1; i < segments; i++) {
      const frac = i / segments;
      const bx = x1 + dx * frac;
      const by = y1 + dy * frac;
      const seed = (seeds[i % seeds.length] ?? 0) + strandOffset * 31.7;
      const displacement = noise1(seed + t) * maxDisplace;
      pts.push({
        x: bx + perpX * displacement,
        y: by + perpY * displacement,
      });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  // ── Canvas lifecycle ──────────────────────────────────────────────────────

  resize(w: number, h: number): void {
    if (!this.initialized) return;
    this._w = w;
    this._h = h;
    this.app.renderer.resize(w, h);
  }

  destroy(): void {
    if (!this.initialized) return;
    this.particles.forEach(p => this.releaseParticle(p));
    this.particles = [];
    this.decals.forEach(d => this.releaseDecal(d));
    this.decals = [];
    this.lightningArcs = [];
    this.gfxPool.forEach(g => g.destroy());
    this.gfxPool = [];
    this.app.destroy(true, { children: true, texture: true });
    this.initialized = false;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }
}
