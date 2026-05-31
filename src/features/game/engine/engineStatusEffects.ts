import { WeaponMatchup, EntityState, isTerminalEntityState, type SiegeWeaponId } from "@game/types";
import { getBugWeaponMatchup } from "@game/combat/weaponMatchups";
import type { BugVariant } from "../../../types/dashboard";
import type { Entity } from "./Entity";

export function applyPoisonInRadiusToEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  radius: number,
  dps: number,
  durationMs: number,
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number,
  weaponId?: SiegeWeaponId,
) {
  for (const entity of entities) {
    const bug = entity as any;
    if (isTerminalEntityState(bug.state)) continue;
    if (getDistanceFromPointToEntity(cx, cy, entity) > radius) continue;
    if (weaponId) {
      const matchup = getBugWeaponMatchup(bug.variant as BugVariant, weaponId);
      if (matchup === WeaponMatchup.Immune) continue;
    }
    if (typeof bug.applyPoison === "function") {
      bug.applyPoison(dps, durationMs, weaponId);
    }
  }
}

export function applyBurnInRadiusToEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  radius: number,
  peakDps: number,
  durationMs: number,
  decayPerSecond: number,
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number,
  weaponId?: SiegeWeaponId,
) {
  for (const entity of entities) {
    const bug = entity as any;
    if (isTerminalEntityState(bug.state)) continue;
    const distance = getDistanceFromPointToEntity(cx, cy, entity);
    if (distance > radius) continue;
    if (weaponId) {
      const matchup = getBugWeaponMatchup(bug.variant as BugVariant, weaponId);
      if (matchup === WeaponMatchup.Immune) continue;
    }
    const normalized = distance / Math.max(1, radius);
    const intensity = 0.2 + 0.8 * Math.exp(-3.2 * normalized * normalized);
    if (typeof bug.applyBurn === "function") {
      bug.applyBurn(peakDps * intensity, durationMs, decayPerSecond, weaponId);
    }
  }
}

export function applyEnsnareInRadiusToEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  radius: number,
  durationMs: number,
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number,
  weaponId?: SiegeWeaponId,
) {
  for (const entity of entities) {
    const bug = entity as any;
    if (isTerminalEntityState(bug.state)) continue;
    if (getDistanceFromPointToEntity(cx, cy, entity) > radius) continue;
    if (weaponId) {
      const matchup = getBugWeaponMatchup(bug.variant as BugVariant, weaponId);
      if (matchup === WeaponMatchup.Immune) continue;
    }
    if (typeof bug.applyEnsnare === "function") {
      bug.applyEnsnare(durationMs);
    }
  }
}

function applySimpleStatusInRadius(
  entities: Entity[],
  cx: number,
  cy: number,
  radius: number,
  durationMs: number,
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number,
  methodName: "applyCharged" | "applyMarked" | "applyUnstable",
) {
  for (const entity of entities) {
    const bug = entity as any;
    if (isTerminalEntityState(bug.state)) continue;
    if (getDistanceFromPointToEntity(cx, cy, entity) <= radius && typeof bug[methodName] === "function") {
      bug[methodName](durationMs);
    }
  }
}

export function applyChargedInRadiusToEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  radius: number,
  durationMs: number,
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number,
) {
  applySimpleStatusInRadius(entities, cx, cy, radius, durationMs, getDistanceFromPointToEntity, "applyCharged");
}

export function applyMarkedInRadiusToEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  radius: number,
  durationMs: number,
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number,
) {
  applySimpleStatusInRadius(entities, cx, cy, radius, durationMs, getDistanceFromPointToEntity, "applyMarked");
}

export function applyUnstableInRadiusToEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  radius: number,
  durationMs: number,
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number,
) {
  applySimpleStatusInRadius(entities, cx, cy, radius, durationMs, getDistanceFromPointToEntity, "applyUnstable");
}

export function propagateChargedNetworkOnEntities(
  entities: Entity[],
  damage: number,
  falloff: number,
  weaponId?: SiegeWeaponId,
) {
  let currentDamage = damage;
  for (const entity of entities) {
    const bug = entity as any;
    if (isTerminalEntityState(bug.state)) continue;
    if (bug.charged && currentDamage >= 1) {
      bug.hp = Math.max(0, bug.hp - Math.round(currentDamage));
      bug.lastHitTime = performance.now();
      if (bug.hp === 0) {
        bug.state = EntityState.Dying;
        bug.deathProgress = 0;
        bug.vx = 0;
        bug.vy = 0;
        bug.deathCredited = false;
        if (weaponId) bug.dotSourceWeaponId = weaponId;
      }
      currentDamage *= falloff;
    }
  }
}

export function triggerAutoScalerPulseOnEntities(
  entities: Entity[],
  hpThreshold: number,
  weaponId?: SiegeWeaponId,
) {
  for (const entity of entities) {
    const bug = entity as any;
    if (isTerminalEntityState(bug.state)) continue;
    if (bug.marked && (bug.hp / (bug.maxHp || 1)) <= hpThreshold) {
      bug.hp = 0;
      bug.state = EntityState.Dying;
      bug.deathProgress = 0;
      bug.vx = 0;
      bug.vy = 0;
      bug.deathCredited = false;
      if (weaponId) bug.dotSourceWeaponId = weaponId;
    }
  }
}