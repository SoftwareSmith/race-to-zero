import type { WeaponModule } from "../../types";
import { hammerBehavior } from "./behavior";
import { hammerConfig } from "./config";
import { hammerVfx } from "./vfx";

export const hammerWeapon: WeaponModule = {
  config: hammerConfig,
  behavior: hammerBehavior,
  vfx: hammerVfx,
};