import { WeaponMatchup } from "@game/types";
import type {
  AppliedStatus,
  BugDefinition,
  InteractionResult,
  InteractionStrength,
  StatusEffectDefinition,
  WeaponConfig,
  WeaponType,
} from "./types";

function hasTypeMatch(list: WeaponType[] | undefined, weaponType: WeaponType) {
  return list?.includes(weaponType) ?? false;
}

function getOutcome(weapon: WeaponConfig, bug: BugDefinition): InteractionStrength {
  if (hasTypeMatch(bug.immuneTo, weapon.type)) {
    return WeaponMatchup.Immune;
  }

  if (hasTypeMatch(bug.weakTo, weapon.type)) {
    return WeaponMatchup.Strong;
  }

  if (weapon.type === "fire" && bug.traits.includes("flammable")) {
    return WeaponMatchup.Strong;
  }

  if (hasTypeMatch(bug.resistantTo, weapon.type)) {
    return WeaponMatchup.Weak;
  }

  if (bug.traits.includes("armored") && weapon.type !== "blunt") {
    return WeaponMatchup.Weak;
  }

  return WeaponMatchup.Neutral;
}

function getDamage(baseDamage: number, outcome: InteractionStrength) {
  if (outcome === WeaponMatchup.Immune) {
    return 0;
  }

  if (outcome === WeaponMatchup.Strong) {
    return Math.round(baseDamage * 1.5);
  }

  if (outcome === WeaponMatchup.Weak) {
    return Math.max(1, Math.floor(baseDamage * 0.5));
  }

  return baseDamage;
}

function resolveStatuses(
  weapon: WeaponConfig,
  bug: BugDefinition,
  outcome: InteractionStrength,
): Pick<InteractionResult, "appliedStatuses" | "blockedStatuses" | "notes"> {
  const appliedStatuses: AppliedStatus[] = [];
  const blockedStatuses: StatusEffectDefinition["id"][] = [];
  const notes: string[] = [];

  for (const status of weapon.statusesOnHit ?? []) {
    if (hasTypeMatch(bug.immuneTo, status.sourceType)) {
      blockedStatuses.push(status.id);
      notes.push(`${bug.name} ignores ${status.id}.`);
      continue;
    }

    if (outcome === WeaponMatchup.Immune) {
      blockedStatuses.push(status.id);
      continue;
    }

    appliedStatuses.push({
      effect: status,
      reason: `${weapon.name} applies ${status.id} on hit.`,
    });
  }

  return { appliedStatuses, blockedStatuses, notes };
}

export function resolveInteraction(
  weapon: WeaponConfig,
  bug: BugDefinition,
): InteractionResult {
  const outcome = getOutcome(weapon, bug);
  const damage = getDamage(weapon.damage, outcome);
  const statusResult = resolveStatuses(weapon, bug, outcome);
  const notes = [...statusResult.notes];

  if (outcome === WeaponMatchup.Strong) {
    notes.push(`${weapon.name} is strong against ${bug.name}.`);
  } else if (outcome === WeaponMatchup.Weak) {
    notes.push(`${weapon.name} is weak against ${bug.name}.`);
  } else if (outcome === WeaponMatchup.Immune) {
    notes.push(`${bug.name} is immune to ${weapon.type} damage.`);
  }

  return {
    outcome,
    damage,
    appliedStatuses: statusResult.appliedStatuses,
    blockedStatuses: statusResult.blockedStatuses,
    notes,
  };
}