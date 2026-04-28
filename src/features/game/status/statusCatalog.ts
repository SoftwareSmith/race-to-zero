import type { SiegeWeaponId } from "@game/types";

export type SiegeStatusId =
  | "ally"
  | "burn"
  | "charged"
  | "ensnare"
  | "freeze"
  | "looped"
  | "marked"
  | "poison"
  | "unstable";

export interface SiegeStatusDefinition {
  id: SiegeStatusId;
  label: string;
  shortLabel: string;
  role: string;
  summary: string;
  visualRead: string;
  supportCopy: string;
  finisherCopy: string;
  weaponIds: SiegeWeaponId[];
  color: string;
}

export const STATUS_PRIORITY: readonly SiegeStatusId[] = [
  "ally",
  "ensnare",
  "charged",
  "burn",
  "freeze",
  "poison",
  "marked",
  "unstable",
  "looped",
] as const;

export const STATUS_DEFS: Record<SiegeStatusId, SiegeStatusDefinition> = {
  ally: {
    id: "ally",
    label: "Ally",
    shortLabel: "ALLY",
    role: "Conversion",
    summary: "Temporarily flips a bug into a friendly interceptor that collides with nearby hostiles.",
    visualRead: "Green command ring with a friendly marker and a clean expiry wind-down.",
    supportCopy: "Creates breathing room by peeling bugs off crowded lanes.",
    finisherCopy: "Friendly cleanup from a converted bug.",
    weaponIds: ["hammer"],
    color: "#34d399",
  },
  burn: {
    id: "burn",
    label: "Burn",
    shortLabel: "FIRE",
    role: "Pressure",
    summary: "Applies decaying damage over time and makes bugs move more erratically.",
    visualRead: "Ember flicker with a hot orange shell and drifting sparks.",
    supportCopy: "Softens targets and primes detonation-style combos.",
    finisherCopy: "Finishes bugs after they escape the main blast.",
    weaponIds: ["void"],
    color: "#f97316",
  },
  charged: {
    id: "charged",
    label: "Charged",
    shortLabel: "CHRG",
    role: "Amplifier",
    summary: "Marks a bug for electric follow-up and increases incoming hit payoff.",
    visualRead: "Blue arc pulses that read clearly even in dense swarms.",
    supportCopy: "Turns clustered hits into better chain payoffs.",
    finisherCopy: "Last spark discharge on an overcharged target.",
    weaponIds: ["chain"],
    color: "#22d3ee",
  },
  ensnare: {
    id: "ensnare",
    label: "Ensnared",
    shortLabel: "SNARE",
    role: "Lockdown",
    summary: "Pins a bug in place so the next clean hit can cash it out immediately.",
    visualRead: "Yellow restraint bands with a pinned-down silhouette.",
    supportCopy: "Stops pressure and guarantees the next hit matters.",
    finisherCopy: "A trapped bug collapses on contact.",
    weaponIds: ["beacon"],
    color: "#facc15",
  },
  freeze: {
    id: "freeze",
    label: "Frozen",
    shortLabel: "SLOW",
    role: "Control",
    summary: "Slows movement and increases how much follow-up damage the bug takes.",
    visualRead: "Pale blue rim frost with a cold outer ring.",
    supportCopy: "Makes focused follow-up shots hit harder.",
    finisherCopy: "A brittle target breaks under the final hit.",
    weaponIds: [],
    color: "#93c5fd",
  },
  looped: {
    id: "looped",
    label: "Looped",
    shortLabel: "LOOP",
    role: "Echo",
    summary: "Echo damage repeats in pulses instead of landing up front.",
    visualRead: "Purple repeat-ring that cycles in timed echoes.",
    supportCopy: "Keeps pressure on bugs that slip out of the first strike.",
    finisherCopy: "Echo pulse lands the last point of damage.",
    weaponIds: [],
    color: "#c084fc",
  },
  marked: {
    id: "marked",
    label: "Marked",
    shortLabel: "MARK",
    role: "Focus",
    summary: "Flags a priority target so precision follow-up and executions pay off sooner.",
    visualRead: "Bright magenta target arc that pulls attention to the bug.",
    supportCopy: "Turns the next focused shot into a cleaner execution.",
    finisherCopy: "Marked target collapses under focused fire.",
    weaponIds: ["nullpointer", "beacon"],
    color: "#e879f9",
  },
  poison: {
    id: "poison",
    label: "Poisoned",
    shortLabel: "TOX",
    role: "Attrition",
    summary: "Deals light damage over time so the player can soften swarms without the cloud doing all the work.",
    visualRead: "Sickly green seep with a readable toxic halo.",
    supportCopy: "Softens bugs for the next direct hit instead of stealing the whole kill.",
    finisherCopy: "Toxic attrition closes out a nearly-dead bug.",
    weaponIds: ["zapper"],
    color: "#4ade80",
  },
  unstable: {
    id: "unstable",
    label: "Unstable",
    shortLabel: "UNST",
    role: "Volatile",
    summary: "Makes precision and gravity follow-ups more explosive when timed correctly.",
    visualRead: "Violent violet pulse that reads as dangerous and temporary.",
    supportCopy: "Raises the payoff on your next setup tool.",
    finisherCopy: "Volatile state ruptures under the last impact.",
    weaponIds: ["void", "daemon"],
    color: "#a855f7",
  },
};

export function getWeaponStatuses(weaponId: SiegeWeaponId): SiegeStatusDefinition[] {
  return STATUS_PRIORITY.map((statusId) => STATUS_DEFS[statusId]).filter((status) =>
    status.weaponIds.includes(weaponId),
  );
}
