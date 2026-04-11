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
}

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
    for (let i = 0; i < Math.ceil(count * 0.4); i++) {
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
   * Void nova — black/violet/white radial burst.
   */
  spawnVoidNova(x: number, y: number, count = 100): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 360;
      const phase = Math.random();
      const [r, g, b] =
        phase < 0.33
          ? [180, 40, 255] as [number, number, number]   // violet
          : phase < 0.66
          ? [255, 255, 255] as [number, number, number]  // white
          : [20, 0, 60] as [number, number, number];     // deep purple
      this.spawnParticle({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        ay: 20,
        life: 600 + Math.random() * 900,
        size: phase < 0.33 ? 4 + Math.random() * 10 : 2 + Math.random() * 6,
        type: PType.PLASMA, r, g, b,
        additive: phase < 0.66,
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
   * Cyan frost crystal shape at bug hit position — persists 3 seconds.
   */
  addFrostDecal(x: number, y: number): void {
    if (!this.initialized) return;
    const gfx = this.acquireGfx();
    gfx.x = x;
    gfx.y = y;
    const spikes = 6;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const len = 8 + Math.random() * 8;
      gfx.moveTo(0, 0);
      gfx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      gfx.stroke({ color: 0xbfdbfe, width: 1.5, alpha: 0.8 });
      // Small cross at tip
      const tx = Math.cos(a) * len;
      const ty = Math.sin(a) * len;
      const ca = a + Math.PI / 2;
      gfx.moveTo(tx + Math.cos(ca) * 3, ty + Math.sin(ca) * 3);
      gfx.lineTo(tx - Math.cos(ca) * 3, ty - Math.sin(ca) * 3);
      gfx.stroke({ color: 0xe0f2fe, width: 1, alpha: 0.6 });
    }
    gfx.circle(0, 0, 4);
    gfx.fill({ color: 0xbfdbfe, alpha: 0.7 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: 3500,
      initialAlpha: 0.9,
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

  /**
   * Purple void rift swirl — fades after 3 seconds.
   */
  addVoidRift(x: number, y: number): void {
    if (!this.initialized) return;
    const gfx = this.acquireGfx();
    gfx.x = x;
    gfx.y = y;
    // Radiating cracks in void palette
    const crackCount = 8;
    for (let i = 0; i < crackCount; i++) {
      const a = (i / crackCount) * Math.PI * 2 + Math.random() * 0.3;
      const len = 20 + Math.random() * 30;
      gfx.moveTo(0, 0);
      gfx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      gfx.stroke({ color: i % 2 === 0 ? 0xc084fc : 0x7c3aed, width: 1.5, alpha: 0.8 });
    }
    gfx.circle(0, 0, 8);
    gfx.fill({ color: 0x4c1d95, alpha: 0.6 });
    this.decalContainer.addChild(gfx);
    this.decals.push({
      gfx,
      createdAt: performance.now(),
      lifetime: 3000,
      initialAlpha: 0.85,
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
        alpha = t < 0.1 ? t / 0.1 : t;
      } else if (p.type === PType.SMOKE) {
        alpha = t * 0.45;
      } else if (p.type === PType.EMBER) {
        alpha = t * 0.9;
      } else {
        alpha = t;
      }

      // Color shift: fire fades toward red-black
      let [r, g, b] = [p.r, p.g, p.b];
      if (p.type === PType.FIRE) {
        const fade = Math.max(0, 1 - t);
        r = Math.max(0, p.r - fade * 100);
        g = Math.max(0, p.g - fade * p.g * 0.9);
        b = Math.max(0, p.b - fade * p.b);
      }

      const gfx = p.gfx;
      gfx.clear();
      gfx.x = p.x;
      gfx.y = p.y;
      gfx.alpha = Math.max(0, Math.min(1, alpha));

      if (p.type === PType.FIRE || p.type === PType.PLASMA || p.type === PType.SPARK) {
        gfx.circle(0, 0, sz);
        gfx.fill({ color: toHex(r, g, b), alpha: 1 });
      } else if (p.type === PType.EMBER) {
        gfx.circle(0, 0, sz);
        gfx.fill({ color: toHex(r, g, b), alpha: 1 });
      } else if (p.type === PType.SMOKE) {
        gfx.circle(0, 0, sz);
        gfx.fill({ color: toHex(r, g, b), alpha: 1 });
      } else if (p.type === PType.DEBRIS) {
        gfx.rotation = p.rotation;
        gfx.rect(-sz * 0.5, -sz * 0.5, sz, sz);
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
