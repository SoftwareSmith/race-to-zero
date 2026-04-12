import { fireResistantBug } from "./bugs/fireResistantBug";
import { resolveInteraction } from "./resolveInteraction";
import { burnStatus } from "./statuses";
import { hammerWeapon } from "./weapons/hammer";

export const hammerVsFireResistantBug = resolveInteraction(
  hammerWeapon.config,
  fireResistantBug,
);

export const burnEffectExample = burnStatus;