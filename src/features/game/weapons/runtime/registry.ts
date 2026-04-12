/**
 * Weapon registry — global Map<SiegeWeaponId, WeaponEntry>.
 *
 * Each weapon plugin calls register() once at module load time via its
 * index.ts barrel. BackgroundField checks hasEntry() to route fires through
 * the new path; unregistered weapons fall through to the legacy switch.
 *
 * Active PersistentFireSession state is also kept here so BackgroundField and
 * the hold-weapon RAF loop can both access it.
 */

import type {
  SiegeWeaponId,
  WeaponEntry,
  PersistentFireSession,
  HoldFireSession,
} from "@game/weapons/runtime/types";

const _entries = new Map<SiegeWeaponId, WeaponEntry>();

/** Active persistent sessions (currently void pulse). */
const _persistentSessions = new Map<SiegeWeaponId, PersistentFireSession>();

/** Active hold sessions (flame, bug spray). Cleared on mouseup. */
const _holdSessions = new Map<SiegeWeaponId, HoldFireSession>();

// ─── Registration ────────────────────────────────────────────────────────────

/** Register a weapon plugin. Called by each weapon's index.ts at module load. */
export function register(entry: WeaponEntry): void {
  if (_entries.has(entry.weaponId)) {
    // Allow hot-reload re-registration in dev without error
    if (import.meta.env.DEV) {
      console.warn(`[weapon-registry] re-registering "${entry.weaponId}"`);
    }
  }
  _entries.set(entry.weaponId, entry);
}

// ─── Lookup ──────────────────────────────────────────────────────────────────

export function hasEntry(id: SiegeWeaponId): boolean {
  return _entries.has(id);
}

export function getEntry(id: SiegeWeaponId): WeaponEntry | undefined {
  return _entries.get(id);
}

/** All registered weapon IDs — useful for registry integrity checks. */
export function registeredIds(): SiegeWeaponId[] {
  return Array.from(_entries.keys());
}

// ─── Persistent session management ──────────────────────────────────────────

export function setPersistentSession(
  id: SiegeWeaponId,
  session: PersistentFireSession,
): void {
  _persistentSessions.set(id, session);
}

export function getPersistentSession(
  id: SiegeWeaponId,
): PersistentFireSession | undefined {
  return _persistentSessions.get(id);
}

export function clearPersistentSession(id: SiegeWeaponId): void {
  _persistentSessions.delete(id);
}

// ─── Hold session management ─────────────────────────────────────────────────

export function setHoldSession(id: SiegeWeaponId, session: HoldFireSession): void {
  _holdSessions.set(id, session);
}

export function getHoldSession(id: SiegeWeaponId): HoldFireSession | undefined {
  return _holdSessions.get(id);
}

export function clearHoldSession(id: SiegeWeaponId): void {
  _holdSessions.delete(id);
}

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Clear all state — call between test cases. */
export function _resetForTests(): void {
  _entries.clear();
  _persistentSessions.clear();
  _holdSessions.clear();
}
