import type { BugDefinition } from "../types";

export const fireResistantBug: BugDefinition = {
  id: "cinder-mite",
  name: "Cinder Mite",
  maxHp: 6,
  traits: ["armored"],
  immuneTo: ["fire"],
};