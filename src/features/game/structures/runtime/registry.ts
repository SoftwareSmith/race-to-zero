/**
 * Structure plugin registry.
 *
 * Each structure plugin calls register() once at module load time via its
 * index.ts. Engine.ts checks hasEntry() to dispatch tick calls through the
 * plugin system; unregistered structures are skipped gracefully.
 */

import type { StructureId, StructureBehavior } from "./types";

const _entries = new Map<StructureId, StructureBehavior>();

// ─── Registration ────────────────────────────────────────────────────────────

/** Register a structure behavior plugin. Called by each plugin's index.ts. */
export function register(behavior: StructureBehavior): void {
  if (_entries.has(behavior.structureId)) {
    // Guard: re-import during HMR is fine; duplicate foreign IDs are not.
    return;
  }
  _entries.set(behavior.structureId, behavior);
}

/** Returns true when a plugin is registered for the given structure type. */
export function hasEntry(id: StructureId): boolean {
  return _entries.has(id);
}

/** Returns the registered behavior for a structure type, or undefined. */
export function getEntry(id: StructureId): StructureBehavior | undefined {
  return _entries.get(id);
}

/** Returns all registered structure IDs. */
export function registeredIds(): StructureId[] {
  return Array.from(_entries.keys());
}

// ─── Test helpers ────────────────────────────────────────────────────────────

/**
 * Clears the registry. Only for use in unit tests — never call in production.
 * @internal
 */
export function _resetForTests(): void {
  _entries.clear();
}
