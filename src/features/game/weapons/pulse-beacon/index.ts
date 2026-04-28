import { register } from "@game/weapons/runtime/registry";
import { def } from "./constants";
import { createSession } from "./behavior";

register({
  weaponId: def.id,
  config: def,
  createSession,
});