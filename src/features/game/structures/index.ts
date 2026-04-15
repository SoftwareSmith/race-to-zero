/**
 * Structures barrel — re-exports config + triggers all plugin self-registrations.
 *
 * Import this module anywhere that needs the structure registry to be populated
 * (i.e. Engine.ts, which is loaded before structures are placed).
 */

export { STRUCTURE_DEFS, STRUCTURE_UNLOCK_THRESHOLDS } from "@config/structureConfig";
export type { StructureDef } from "@config/structureConfig";

// Side-effect imports: each calls register() at module load time.
import "./lantern/index";
import "./agent/index";
