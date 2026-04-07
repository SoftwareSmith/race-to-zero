import { Bug, type BugBounds, type DamageSource } from "./Bug";
import { Spawner } from "./Spawner";
import { UI } from "./UI";
import { UpgradeSystem } from "./Upgrades";
import { WeaponsSystem } from "./Weapons";

function formatRuntime(seconds: number) {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (wholeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export class Game {
  private readonly bugs: Bug[] = [];
  private canvasBounds: BugBounds = { width: 960, height: 620 };
  private ctx: CanvasRenderingContext2D;
  private readonly createdTimestamps: number[] = [];
  private readonly hammerCursor: HTMLElement;
  private totalFixed = 0;
  private readonly fixedTimestamps: number[] = [];
  private lastFrameTime = 0;
  private lastStatusMessage = "Booting incident simulation.";
  private realTimeSeconds = 0;
  private readonly resizeObserver: ResizeObserver;
  private screenShake = 0;
  private simTimeSeconds = 0;
  private readonly splatLayer: HTMLElement;

  private readonly spawner = new Spawner();
  private readonly ui: UI;
  private readonly upgrades = new UpgradeSystem();
  private readonly weapons = new WeaponsSystem();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: { initialBugCount: number },
  ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2D canvas context was not available");
    }

    const hammerCursor = document.getElementById("hammer-cursor");
    const splatLayer = document.getElementById("splat-layer");
    if (!hammerCursor || !splatLayer) {
      throw new Error("Interactive cursor layers were not found");
    }

    this.ctx = context;
    this.hammerCursor = hammerCursor;
    this.splatLayer = splatLayer;
    this.ui = new UI();

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
  }

  start() {
    document.body.classList.add("interactive-mode");
    this.resize();
    this.attachEvents();
    this.seedInitialBugs();
    this.resizeObserver.observe(this.canvas);
    window.requestAnimationFrame((timestamp) => {
      this.lastFrameTime = timestamp;
      this.loop(timestamp);
    });
  }

  private attachEvents() {
    window.addEventListener("mousemove", (event) => {
      this.hammerCursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    });

    window.addEventListener("mousedown", () => {
      this.hammerCursor.classList.remove("app-hammer-swing");
      window.requestAnimationFrame(() => {
        this.hammerCursor.classList.add("app-hammer-swing");
      });
    });

    this.canvas.addEventListener("click", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.handleCanvasClick(x, y);
    });
  }

  private addStatus(text: string) {
    this.lastStatusMessage = text;
  }

  private addSplat(x: number, y: number) {
    const splat = document.createElement("span");
    splat.className = "app-bug-splat";
    splat.style.left = `${x}px`;
    splat.style.top = `${y}px`;
    this.splatLayer.appendChild(splat);
    window.setTimeout(() => {
      splat.remove();
    }, 420);
  }

  private getCurrentBugsPerMinute() {
    this.pruneTimestamps(this.createdTimestamps);
    return this.createdTimestamps.length;
  }

  private getFixedPerMinute() {
    this.pruneTimestamps(this.fixedTimestamps);
    return this.fixedTimestamps.length;
  }

  private getWeaponOrigin() {
    return {
      x: this.canvasBounds.width * 0.5,
      y: this.canvasBounds.height - 44,
    };
  }

  private applyDamageToBug(
    bug: Bug,
    amount: number,
    source: DamageSource,
    hitX: number,
    hitY: number,
  ) {
    const result = bug.hit(amount, source);
    if (result.immune) {
      return false;
    }

    if (result.appliedDamage > 0) {
      this.screenShake = Math.min(20, this.screenShake + 7);
    }

    if (result.killed) {
      this.addSplat(hitX, hitY);
      this.resolveKill(bug);
    }

    return result.killed;
  }

  private handleCanvasClick(x: number, y: number) {
    const bug = [...this.bugs].reverse().find((entry) => entry.containsPoint(x, y));
    if (!bug) {
      this.addStatus("Missed. Find a live bug and smash it.");
      return;
    }

    const damage = this.upgrades.getCombatStats(this.totalFixed).hammerDamage;
    const killed = this.applyDamageToBug(bug, damage, "click", x, y);

    if (!killed) {
      this.addStatus("Impact registered. Keep pressure on the queue.");
    }
  }

  private loop(timestamp: number) {
    const realDt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = timestamp;
    this.realTimeSeconds += realDt;

    const timeScale = this.weapons.getTimeScale(this.realTimeSeconds);
    const simDt = realDt * timeScale;
    this.simTimeSeconds += simDt;

    this.update(realDt, simDt);
    this.render();

    window.requestAnimationFrame((nextTimestamp) => {
      this.loop(nextTimestamp);
    });
  }

  private removeDeadBugs() {
    for (let index = this.bugs.length - 1; index >= 0; index -= 1) {
      if (this.bugs[index].currentHp <= 0) {
        this.bugs.splice(index, 1);
      }
    }
  }

  private resolveKill(bug: Bug) {
    this.totalFixed += 1;
    this.fixedTimestamps.push(this.realTimeSeconds);
    this.addStatus(`${bug.level >= 4 ? "Critical" : "Live"} bug resolved.`);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvasBounds = {
      width: Math.max(320, rect.width),
      height: Math.max(360, rect.height),
    };
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.canvasBounds.width * dpr);
    this.canvas.height = Math.floor(this.canvasBounds.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private seedInitialBugs() {
    this.spawner.buildInitialWave(this.options.initialBugCount, this.canvasBounds).forEach((config) => {
      this.spawnBug(config);
    });
    if (this.options.initialBugCount === 0) {
      this.addStatus("No open bugs detected. Stand by for incoming incidents.");
    } else {
      this.addStatus(`${this.options.initialBugCount} open bugs imported into the arena.`);
    }
  }

  private spawnBug(config: ConstructorParameters<typeof Bug>[0]) {
    this.bugs.push(new Bug(config));
  }

  private pruneTimestamps(timestamps: number[]) {
    const cutoff = this.realTimeSeconds - 60;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  private update(realDt: number, simDt: number) {
    const combatStats = this.upgrades.getCombatStats(this.totalFixed);
    const { difficulty, configs } = this.spawner.spawn(
      simDt,
      this.simTimeSeconds,
      this.bugs.length,
      this.canvasBounds,
    );
    configs.forEach((config) => {
      this.createdTimestamps.push(this.realTimeSeconds);
      this.spawnBug(config);
    });

    this.bugs.forEach((bug) => {
      bug.update(simDt, this.canvasBounds);
    });

    const weaponUpdate = this.weapons.update({
      bugs: this.bugs,
      now: this.realTimeSeconds,
      origin: this.getWeaponOrigin(),
      overwhelmed: this.bugs.length > 180,
      realDt,
      simDt,
      stats: combatStats,
    });
    weaponUpdate.statusMessages.forEach((message) => this.addStatus(message));
    weaponUpdate.hitEvents.forEach((event) => {
      const bug = this.bugs.find((entry) => entry.id === event.bugId);
      if (!bug) {
        return;
      }

      this.applyDamageToBug(bug, event.amount, event.source, event.x, event.y);
    });

    this.removeDeadBugs();
    this.screenShake = Math.max(0, this.screenShake - realDt * 28);

    if (this.bugs.length === 0 && this.options.initialBugCount > 0) {
      this.addStatus("Backlog at zero. Hold the line while new bugs try to spawn.");
    }

    this.ui.render(
      {
        bugsFixed: this.totalFixed,
        createdPerMinute: this.getCurrentBugsPerMinute(),
        currentBugCount: this.bugs.length,
        currentToolLabel: combatStats.currentToolLabel,
        fixedPerMinute: this.getFixedPerMinute(),
        pressureLabel: difficulty.pressureLabel,
        runtimeLabel: formatRuntime(this.simTimeSeconds),
        statusText: this.lastStatusMessage,
      },
      this.upgrades.getSnapshots(this.totalFixed),
    );
  }

  private render() {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvasBounds.width, this.canvasBounds.height);

    const offsetX = randomBetween(-this.screenShake, this.screenShake);
    const offsetY = randomBetween(-this.screenShake, this.screenShake);
    this.ctx.translate(offsetX, offsetY);

    const now = this.simTimeSeconds;
    this.bugs.forEach((bug) => {
      bug.render(this.ctx, now);
    });
    this.weapons.render(this.ctx);

    this.ctx.restore();
  }
}