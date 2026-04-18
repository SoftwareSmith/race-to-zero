/**
 * useWeaponSession — React hook that builds a WeaponContext from live refs
 * and fires the appropriate session via the registry + executor.
 *
 * Used by the updated BackgroundField BugCanvas for new-path weapons.
 * The legacy switch block is skipped when the weapon is registered here.
 */

import { useCallback } from "react";
import type { RefObject, MutableRefObject } from "react";
import type Engine from "@game/engine/Engine";
import type { VfxEngine } from "@game/engine/VfxEngine";
import type { SiegeWeaponId, WeaponTier } from "@game/types";
import { resolveWeaponConfig } from "@game/weapons/progression";
import type {
  WeaponContext,
  ExecutionContext,
  BugHitPayload,
  OverlayExtras,
  CanvasBounds,
  HoldFireSession,
  PersistentFireSession,
} from "@game/weapons/runtime/types";
import {
  hasEntry,
  getEntry,
  setHoldSession,
  getHoldSession,
  clearHoldSession,
  getPersistentSession,
  setPersistentSession,
} from "@game/weapons/runtime/registry";
import { canFire, recordFire } from "@game/weapons/runtime/cooldownManager";
import { executeCommands } from "@game/weapons/runtime/executor";

// Ensure all weapon plugins are registered before first use
import "@game/weapons/index";

interface UseWeaponSessionOptions {
  engineRef: RefObject<Engine | null>;
  vfxRef: RefObject<VfxEngine | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  boundsRef: RefObject<CanvasBounds>;
  hammerPositionRef?: MutableRefObject<{ x: number; y: number }>;
  blackHoleVfxIdRef: MutableRefObject<string | null>;
  onHit: (payload: BugHitPayload) => void;
  updateQaLastHit: (
    payload: Omit<BugHitPayload, "pointValue" | "frozen">,
  ) => void;
  enqueueOverlay: (
    weaponId: SiegeWeaponId,
    viewportX: number,
    viewportY: number,
    extras?: OverlayExtras,
  ) => void;
  /** Returns the current evolution tier for a weapon. Defaults to 1 when absent. */
  getWeaponTier?: (id: SiegeWeaponId) => WeaponTier;
}

function resolveFire(
  clientX: number,
  clientY: number,
  bounds: CanvasBounds,
  hammerPositionRef?: MutableRefObject<{ x: number; y: number }>,
): { viewportX: number; viewportY: number; targetX: number; targetY: number } {
  const hp = hammerPositionRef?.current;
  const hasLiveCursor =
    hp != null &&
    Number.isFinite(hp.x) &&
    Number.isFinite(hp.y) &&
    (hp.x !== 0 || hp.y !== 0);

  const viewportX = hasLiveCursor ? hp!.x : clientX;
  const viewportY = hasLiveCursor ? hp!.y : clientY;
  const targetX = viewportX - bounds.left;
  const targetY = viewportY - bounds.top;

  return { viewportX, viewportY, targetX, targetY };
}

function buildContext(
  opts: UseWeaponSessionOptions,
  viewportX: number,
  viewportY: number,
  targetX: number,
  targetY: number,
  weaponId: SiegeWeaponId,
): WeaponContext | null {
  const engine = opts.engineRef.current;
  const bounds = opts.boundsRef.current;
  const entry = getEntry(weaponId);
  if (!engine || !bounds.width || !bounds.height || !entry) return null;

  const tier = opts.getWeaponTier ? opts.getWeaponTier(weaponId) : 1;
  const config = resolveWeaponConfig(entry.config, tier);

  return {
    targetX,
    targetY,
    centerX: bounds.width / 2,
    centerY: bounds.height / 2,
    canvasWidth: bounds.width,
    canvasHeight: bounds.height,
    viewportX,
    viewportY,
    bounds,
    now: performance.now(),
    engine: engine as unknown as WeaponContext["engine"],
    tier,
    weaponId,
    config,
  };
}

function buildExecContext(
  opts: UseWeaponSessionOptions,
  weaponId: SiegeWeaponId,
  viewportX: number,
  viewportY: number,
): ExecutionContext | null {
  const engine = opts.engineRef.current;
  const bounds = opts.boundsRef.current;
  if (!engine) return null;

  return {
    engine: engine as unknown as ExecutionContext["engine"],
    vfx: opts.vfxRef.current,
    canvas: opts.canvasRef.current,
    bounds,
    viewportX,
    viewportY,
    weaponId,
    onHit: opts.onHit,
    updateQaLastHit: opts.updateQaLastHit,
    enqueueOverlay: opts.enqueueOverlay,
    blackHoleVfxIdRef: opts.blackHoleVfxIdRef,
  };
}

export interface WeaponSessionHandlers {
  /** Returns true if the weapon is registered in the new plugin system. */
  isRegistered: (weaponId: SiegeWeaponId) => boolean;
  /**
   * Fire a click weapon. Returns true if handled (new path), false if the
   * caller should fall through to the legacy switch.
   */
  fireClick: (
    weaponId: SiegeWeaponId,
    clientX: number,
    clientY: number,
  ) => boolean;
  /**
   * Begin a hold weapon session (mousedown). Returns the HoldFireSession
   * if registered, null if the caller should use the legacy path.
   */
  beginHold: (
    weaponId: SiegeWeaponId,
    clientX: number,
    clientY: number,
  ) => HoldFireSession | null;
  /**
   * Tick the active hold session (called by RAF loop when cooldown elapses).
   */
  tickHold: (
    weaponId: SiegeWeaponId,
    clientX: number,
    clientY: number,
  ) => void;
  /**
   * Paint the active hold session (called on every mousemove for trail VFX).
   */
  paintHold: (
    weaponId: SiegeWeaponId,
    clientX: number,
    clientY: number,
  ) => void;
  /** End the active hold session (mouseup). */
  endHold: (weaponId: SiegeWeaponId) => void;
  /**
   * Begin a persistent session. Returns the session if registered.
   * Begin commands are executed immediately.
   */
  beginPersistent: (
    weaponId: SiegeWeaponId,
    clientX: number,
    clientY: number,
  ) => PersistentFireSession | null;
}

export function useWeaponSession(
  opts: UseWeaponSessionOptions,
): WeaponSessionHandlers {
  const isRegistered = useCallback(
    (weaponId: SiegeWeaponId) => hasEntry(weaponId),
    [],
  );

  const fireClick = useCallback(
    (weaponId: SiegeWeaponId, clientX: number, clientY: number): boolean => {
      const entry = getEntry(weaponId);
      if (!entry) return false;
      const tier = opts.getWeaponTier ? opts.getWeaponTier(weaponId) : 1;
      const config = resolveWeaponConfig(entry.config, tier);

      const bounds = opts.boundsRef.current;
      if (!bounds.width || !bounds.height) return false;

      // Cooldown check using the centralized manager
      if (!canFire(weaponId, config.cooldownMs)) return false;
      recordFire(weaponId);

      const { viewportX, viewportY, targetX, targetY } = resolveFire(
        clientX,
        clientY,
        bounds,
        opts.hammerPositionRef,
      );

      const wCtx = buildContext(opts, viewportX, viewportY, targetX, targetY, weaponId);
      if (!wCtx) return false;

      const session = entry.createSession(wCtx);

      // For persistent weapons (currently void pulse): store & begin
      if (session.mode === "persistent") {
        const existing = getPersistentSession(weaponId);
        if (existing?.active) return true; // block re-fire while active

        if (existing) existing.abort();
        setPersistentSession(weaponId, session as PersistentFireSession);

        const eCtx = buildExecContext(opts, weaponId, viewportX, viewportY);
        if (!eCtx) return true;
        const cmds = (session as PersistentFireSession).begin(wCtx);
        executeCommands(cmds, eCtx);
        return true;
      }

      if (session.mode === "once") {
        const eCtx = buildExecContext(opts, weaponId, viewportX, viewportY);
        if (!eCtx) return true;
        executeCommands(session.commands, eCtx);
        return true;
      }

      return false;
    },
    [opts],
  );

  const beginHold = useCallback(
    (
      weaponId: SiegeWeaponId,
      clientX: number,
      clientY: number,
    ): HoldFireSession | null => {
      const entry = getEntry(weaponId);
      if (!entry || entry.config.inputMode !== "hold") return null;
      const tier = opts.getWeaponTier ? opts.getWeaponTier(weaponId) : 1;
      const config = resolveWeaponConfig(entry.config, tier);

      const bounds = opts.boundsRef.current;
      if (!bounds.width || !bounds.height) return null;

      if (!canFire(weaponId, config.cooldownMs)) return null;
      recordFire(weaponId);

      const { viewportX, viewportY, targetX, targetY } = resolveFire(
        clientX,
        clientY,
        bounds,
        opts.hammerPositionRef,
      );

      const wCtx = buildContext(opts, viewportX, viewportY, targetX, targetY, weaponId);
      if (!wCtx) return null;

      const session = entry.createSession(wCtx) as HoldFireSession;
      if (session.mode !== "hold") return null;

      setHoldSession(weaponId, session);

      const eCtx = buildExecContext(opts, weaponId, viewportX, viewportY);
      if (eCtx) {
        executeCommands(session.begin(wCtx), eCtx);
      }

      return session;
    },
    [opts],
  );

  const tickHold = useCallback(
    (weaponId: SiegeWeaponId, clientX: number, clientY: number): void => {
      const session = getHoldSession(weaponId);
      if (!session) return;

      const entry = getEntry(weaponId);
      if (!entry) return;
      const tier = opts.getWeaponTier ? opts.getWeaponTier(weaponId) : 1;
      const config = resolveWeaponConfig(entry.config, tier);

      if (!canFire(weaponId, config.cooldownMs)) return;
      recordFire(weaponId);

      const bounds = opts.boundsRef.current;
      const { viewportX, viewportY, targetX, targetY } = resolveFire(
        clientX,
        clientY,
        bounds,
        opts.hammerPositionRef,
      );

      const wCtx = buildContext(opts, viewportX, viewportY, targetX, targetY, weaponId);
      if (!wCtx) return;

      const eCtx = buildExecContext(opts, weaponId, viewportX, viewportY);
      if (!eCtx) return;

      executeCommands(session.tick(wCtx), eCtx);
    },
    [opts],
  );

  const paintHold = useCallback(
    (weaponId: SiegeWeaponId, clientX: number, clientY: number): void => {
      const session = getHoldSession(weaponId);
      if (!session?.paint) return;

      const bounds = opts.boundsRef.current;
      const { viewportX, viewportY, targetX, targetY } = resolveFire(
        clientX,
        clientY,
        bounds,
        opts.hammerPositionRef,
      );

      const wCtx = buildContext(opts, viewportX, viewportY, targetX, targetY, weaponId);
      if (!wCtx) return;

      const eCtx = buildExecContext(opts, weaponId, viewportX, viewportY);
      if (!eCtx) return;

      executeCommands(session.paint(wCtx), eCtx);
    },
    [opts],
  );

  const endHold = useCallback(
    (weaponId: SiegeWeaponId): void => {
      const session = getHoldSession(weaponId);
      if (session) {
        session.end();
        clearHoldSession(weaponId);
      }
    },
    [],
  );

  const beginPersistent = useCallback(
    (
      weaponId: SiegeWeaponId,
      clientX: number,
      clientY: number,
    ): PersistentFireSession | null => {
      const entry = getEntry(weaponId);
      if (!entry) return null;
      const tier = opts.getWeaponTier ? opts.getWeaponTier(weaponId) : 1;
      const config = resolveWeaponConfig(entry.config, tier);

      const bounds = opts.boundsRef.current;
      if (!bounds.width || !bounds.height) return null;

      if (!canFire(weaponId, config.cooldownMs)) return null;
      recordFire(weaponId);

      const { viewportX, viewportY, targetX, targetY } = resolveFire(
        clientX,
        clientY,
        bounds,
        opts.hammerPositionRef,
      );

      const wCtx = buildContext(opts, viewportX, viewportY, targetX, targetY, weaponId);
      if (!wCtx) return null;

      const session = entry.createSession(wCtx) as PersistentFireSession;
      if (session.mode !== "persistent") return null;

      const existing = getPersistentSession(weaponId);
      if (existing?.active) return null;
      if (existing) existing.abort();

      setPersistentSession(weaponId, session);

      const eCtx = buildExecContext(opts, weaponId, viewportX, viewportY);
      if (eCtx) {
        executeCommands(session.begin(wCtx), eCtx);
      }

      return session;
    },
    [opts],
  );

  return { isRegistered, fireClick, beginHold, tickHold, paintHold, endHold, beginPersistent };
}
