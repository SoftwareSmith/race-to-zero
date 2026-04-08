// lightweight fallback particle generator (replaces createBugParticles from legacy backgroundEffects)
function createBugParticles(count: number) {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: Math.random() * 100, y: Math.random() * 100 });
  }
  return out;
}
import type { BugBounds, BugSpawnConfig, BugType } from "./Bug";

const BUG_TYPES: BugType[] = ["uiBug", "nullPointer", "http400", "zeroDay"];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getTypePool(simTimeSeconds: number) {
  if (simTimeSeconds >= 135) {
    return BUG_TYPES;
  }

  if (simTimeSeconds >= 85) {
    return BUG_TYPES.slice(0, 3);
  }

  if (simTimeSeconds >= 35) {
    return BUG_TYPES.slice(0, 2);
  }

  return BUG_TYPES.slice(0, 1);
}

function pickWeightedType(typePool: BugType[]) {
  const weights: Record<BugType, number> = {
    uiBug: 0.48,
    nullPointer: 0.24,
    http400: 0.18,
    zeroDay: 0.1,
  };

  const total = typePool.reduce((sum, type) => sum + weights[type], 0);
  let cursor = Math.random() * total;
  for (const type of typePool) {
    cursor -= weights[type];
    if (cursor <= 0) {
      return type;
    }
  }

  return typePool[0] ?? "uiBug";
}

function getTypeBaseStats(type: BugType, level: number) {
  switch (type) {
    case "nullPointer":
      return {
        hp: 1.8 + (level - 1) * 0.75,
        radius: 18 + level,
        speed: 58 + level * 4,
      };
    case "http400":
      return {
        hp: 2.5 + (level - 1) * 0.9,
        radius: 20 + level,
        speed: 46 + level * 3,
      };
    case "zeroDay":
      return {
        hp: 4.2 + (level - 1) * 1.25,
        radius: 22 + level,
        speed: 64 + level * 5,
      };
    case "uiBug":
    default:
      return {
        hp: 1 + (level - 1) * 0.45,
        radius: 15 + level,
        speed: 42 + level * 2,
      };
  }
}

export interface DifficultySnapshot {
  bugLevel: number;
  pressureLabel: string;
  spawnRate: number;
}

export class Spawner {
  private accumulator = 0;
  private idCounter = 0;

  buildInitialWave(initialBugCount: number, bounds: BugBounds) {
    const count = Math.max(0, Math.floor(initialBugCount));
    if (count === 0) {
      return [] as BugSpawnConfig[];
    }

    return createBugParticles(count).map((particle) => {
      const type = "uiBug";
      const stats = getTypeBaseStats(type, 1);

      return {
        id: `seed-${this.idCounter++}`,
        level: 1,
        maxHp: stats.hp,
        radius: stats.radius,
        speed: stats.speed,
        type,
        x: (particle.x / 100) * bounds.width,
        y: (particle.y / 100) * bounds.height,
      } satisfies BugSpawnConfig;
    });
  }

  getDifficulty(simTimeSeconds: number, currentBugCount: number): DifficultySnapshot {
    const spawnRate =
      0.08 +
      Math.min(4.5, currentBugCount * 0.015) +
      simTimeSeconds * 0.0035;
    const bugLevel = Math.min(4, 1 + Math.floor((simTimeSeconds + currentBugCount * 1.2) / 75));

    const pressureLabel =
      currentBugCount > 180
        ? "Overloaded"
        : currentBugCount > 110
          ? "Critical"
          : currentBugCount > 45
            ? "Unstable"
            : currentBugCount > 0
              ? "Contained"
              : "All clear";

    return { bugLevel, pressureLabel, spawnRate };
  }

  spawn(simDt: number, simTimeSeconds: number, currentBugCount: number, bounds: BugBounds) {
    const difficulty = this.getDifficulty(simTimeSeconds, currentBugCount);
    const configs: BugSpawnConfig[] = [];
    this.accumulator += simDt * difficulty.spawnRate;

    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      const typePool = getTypePool(simTimeSeconds);
      const type = pickWeightedType(typePool);
      const stats = getTypeBaseStats(type, difficulty.bugLevel);

      configs.push({
        id: `spawn-${this.idCounter++}`,
        level: difficulty.bugLevel,
        maxHp: stats.hp,
        radius: stats.radius,
        speed: stats.speed,
        type,
        x: randomBetween(stats.radius + 12, bounds.width - stats.radius - 12),
        y: randomBetween(stats.radius + 12, bounds.height - stats.radius - 12),
      });

      if (currentBugCount > 120 && Math.random() < 0.18) {
        this.accumulator += 0.45;
      }
    }

    return { configs, difficulty };
  }

  reset() {
    this.accumulator = 0;
    this.idCounter = 0;
  }
}