export type WeaponTierId = "hammer" | "gun" | "laser";

export interface WeaponProgressSnapshot {
  current: boolean;
  detail: string;
  id: WeaponTierId;
  locked: boolean;
  progressText: string;
  title: string;
}

export interface CombatStats {
  currentToolLabel: string;
  gunDamage: number;
  gunFireInterval: number;
  gunPierce: number;
  gunRange: number;
  gunUnlocked: boolean;
  hammerDamage: number;
  laserDps: number;
  laserPierce: number;
  laserUnlocked: boolean;
}

const UNLOCK_THRESHOLDS = {
  hammer: 0,
  gun: 25,
  laser: 100,
} as const;

export class UpgradeSystem {
  getCombatStats(totalFixed: number): CombatStats {
    const gunUnlocked = totalFixed >= UNLOCK_THRESHOLDS.gun;
    const laserUnlocked = totalFixed >= UNLOCK_THRESHOLDS.laser;

    return {
      hammerDamage: 1,
      gunUnlocked,
      gunDamage: 1.2,
      gunFireInterval: Math.max(0.62 - totalFixed * 0.0012, 0.34),
      gunRange: 280,
      gunPierce: laserUnlocked ? 3 : 2,
      laserUnlocked,
      laserDps: 7 + Math.min(4, totalFixed / 120),
      laserPierce: 3,
      currentToolLabel: laserUnlocked
        ? "Hammer + Gun + Laser"
        : gunUnlocked
          ? "Hammer + Gun"
          : "Hammer only",
    };
  }

  getSnapshots(totalFixed: number): WeaponProgressSnapshot[] {
    const stats = this.getCombatStats(totalFixed);

    return [
      {
        id: "hammer",
        title: "Hammer",
        locked: false,
        current: !stats.gunUnlocked,
        detail: "Single-target fixes. 1 damage per click.",
        progressText: "Online from first click",
      },
      {
        id: "gun",
        title: "Gun",
        locked: !stats.gunUnlocked,
        current: stats.gunUnlocked && !stats.laserUnlocked,
        detail: "Auto-projectiles with travel distance and multi-hit penetration.",
        progressText: stats.gunUnlocked
          ? `Unlocked at ${UNLOCK_THRESHOLDS.gun} bugs fixed`
          : `${Math.max(0, UNLOCK_THRESHOLDS.gun - totalFixed)} fixes to unlock`,
      },
      {
        id: "laser",
        title: "Laser",
        locked: !stats.laserUnlocked,
        current: stats.laserUnlocked,
        detail: "Continuous piercing damage across clustered threats.",
        progressText: stats.laserUnlocked
          ? `Unlocked at ${UNLOCK_THRESHOLDS.laser} bugs fixed`
          : `${Math.max(0, UNLOCK_THRESHOLDS.laser - totalFixed)} fixes to unlock`,
      },
    ];
  }
}