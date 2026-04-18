import type { MutableRefObject, RefObject } from "react";
import { WEAPON_DEFS } from "@config/weaponConfig";
import { resolveWeaponConfig } from "@game/weapons/progression";
import { executeCommands } from "@game/weapons/runtime/executor";
import { getEntry, hasEntry } from "@game/weapons/runtime/registry";
import type {
  ExecutionContext,
  PersistentFireSession,
  WeaponContext,
} from "@game/weapons/runtime/types";
import { updateQaLastHit } from "./qa";
import type { CanvasBounds } from "./canvasState";
import type { VfxEngine } from "@game/engine/VfxEngine";
import type { SiegeWeaponId, StructureId } from "@game/types";

interface PointerDownHandlerOptions {
  blackHoleVfxIdRef: MutableRefObject<string | null>;
  boundsRef: MutableRefObject<CanvasBounds>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  currentMouseRef: MutableRefObject<{ x: number; y: number } | null>;
  fireIntervalRef: MutableRefObject<number | null>;
  getWeaponTier: (id: SiegeWeaponId) => import("@game/types").WeaponTier;
  hammerPositionRef?: { current: { x: number; y: number } };
  isFiringRef: MutableRefObject<boolean>;
  onHit: (payload: unknown) => void;
  getOnStructurePlace: () =>
    | ((
        structureType: StructureId,
        viewportX: number,
        viewportY: number,
        canvasX: number,
        canvasY: number,
        structureId?: string,
      ) => void)
    | undefined;
  getOnWeaponFire: () =>
    | ((
        weapon: SiegeWeaponId,
        x: number,
        y: number,
        extras?: {
          angle?: number;
          chainNodes?: Array<{ x: number; y: number }>;
          jagOffsets?: number[];
          targetX?: number;
          targetY?: number;
          color?: string;
          segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
        },
      ) => void)
    | undefined;
  getPlacingStructureId: () => StructureId | null;
  getSelectedWeaponId: () => SiegeWeaponId;
  streakMultiplier: number;
  getSwarm: () => any;
  syncWeaponEvolutionStates: () => void;
  updateBounds: () => CanvasBounds;
  vfxRef: MutableRefObject<VfxEngine | null>;
}

function createWeaponContext(
  weaponId: SiegeWeaponId,
  viewportX: number,
  viewportY: number,
  bounds: CanvasBounds,
  engine: any,
  getWeaponTier: PointerDownHandlerOptions["getWeaponTier"],
): WeaponContext {
  const entry = getEntry(weaponId);
  const tier = getWeaponTier(weaponId);

  return {
    targetX: viewportX - bounds.left,
    targetY: viewportY - bounds.top,
    centerX: bounds.width / 2,
    centerY: bounds.height / 2,
    canvasWidth: bounds.width,
    canvasHeight: bounds.height,
    viewportX,
    viewportY,
    bounds,
    now: performance.now(),
    engine: engine as WeaponContext["engine"],
    tier,
    weaponId,
    config: resolveWeaponConfig(
      entry?.config ?? WEAPON_DEFS.find((weapon) => weapon.id === weaponId)!,
      tier,
    ),
  };
}

function createExecutionContext(
  weaponId: SiegeWeaponId,
  viewportX: number,
  viewportY: number,
  options: PointerDownHandlerOptions,
  bounds: CanvasBounds,
): ExecutionContext {
  return {
    engine: options.getSwarm() as ExecutionContext["engine"],
    vfx: options.vfxRef.current,
    damageMultiplier: options.streakMultiplier,
    canvas: options.canvasRef.current,
    bounds,
    viewportX,
    viewportY,
    weaponId,
    onHit: (payload) => {
      options.onHit(payload as unknown);
      if ((payload as { defeated?: boolean }).defeated) {
        options.syncWeaponEvolutionStates();
      }
    },
    updateQaLastHit: (payload) => updateQaLastHit(payload as any),
    enqueueOverlay: (wid, x, y, extras) =>
      options.getOnWeaponFire()?.(wid, x, y, extras as any),
    blackHoleVfxIdRef: options.blackHoleVfxIdRef,
  };
}

function resolveViewportPosition(
  clientX: number,
  clientY: number,
  hammerPositionRef?: { current: { x: number; y: number } },
) {
  const position = hammerPositionRef?.current ?? { x: 0, y: 0 };
  const hasLiveCursor =
    hammerPositionRef != null &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    (position.x !== 0 || position.y !== 0);

  return {
    viewportX: hasLiveCursor ? position.x : clientX,
    viewportY: hasLiveCursor ? position.y : clientY,
  };
}

function startHoldSession(
  event: MouseEvent,
  weaponId: SiegeWeaponId,
  options: PointerDownHandlerOptions,
  bounds: CanvasBounds,
  lastFireTimeRef: MutableRefObject<Record<string, number>>,
) {
  const entry = getEntry(weaponId);
  if (!entry || options.isFiringRef.current) {
    return true;
  }

  options.isFiringRef.current = true;
  const initialPosition = resolveViewportPosition(
    event.clientX,
    event.clientY,
    options.hammerPositionRef,
  );
  const initialWeaponContext = createWeaponContext(
    weaponId,
    initialPosition.viewportX,
    initialPosition.viewportY,
    bounds,
    options.getSwarm(),
    options.getWeaponTier,
  );
  const initialExecutionContext = createExecutionContext(
    weaponId,
    initialPosition.viewportX,
    initialPosition.viewportY,
    options,
    bounds,
  );
  const holdSession = entry.createSession(initialWeaponContext);
  if (holdSession.mode !== "hold") {
    options.isFiringRef.current = false;
    return true;
  }

  lastFireTimeRef.current[weaponId] = performance.now();
  executeCommands(holdSession.begin(initialWeaponContext), initialExecutionContext);

  const moveHandler = (moveEvent: MouseEvent) => {
    options.currentMouseRef.current = {
      x: moveEvent.clientX,
      y: moveEvent.clientY,
    };

    if (!holdSession.paint) {
      return;
    }

    const currentBounds = options.boundsRef.current;
    const nextPosition = resolveViewportPosition(
      moveEvent.clientX,
      moveEvent.clientY,
      options.hammerPositionRef,
    );
    const nextWeaponContext = createWeaponContext(
      weaponId,
      nextPosition.viewportX,
      nextPosition.viewportY,
      currentBounds,
      options.getSwarm(),
      options.getWeaponTier,
    );
    const nextExecutionContext = createExecutionContext(
      weaponId,
      nextPosition.viewportX,
      nextPosition.viewportY,
      options,
      currentBounds,
    );
    executeCommands(holdSession.paint(nextWeaponContext), nextExecutionContext);
  };

  const tickCooldown = Math.max(60, initialWeaponContext.config.cooldownMs ?? 120);
  let animationFrameId = 0;
  const tick = () => {
    if (!options.isFiringRef.current) {
      return;
    }

    const mouse = options.currentMouseRef.current;
    const now = performance.now();
    const lastFireTime = lastFireTimeRef.current[weaponId] ?? 0;
    if (mouse && now - lastFireTime >= tickCooldown) {
      lastFireTimeRef.current[weaponId] = now;
      const currentBounds = options.boundsRef.current;
      const nextPosition = resolveViewportPosition(
        mouse.x,
        mouse.y,
        options.hammerPositionRef,
      );
      const nextWeaponContext = createWeaponContext(
        weaponId,
        nextPosition.viewportX,
        nextPosition.viewportY,
        currentBounds,
        options.getSwarm(),
        options.getWeaponTier,
      );
      const nextExecutionContext = createExecutionContext(
        weaponId,
        nextPosition.viewportX,
        nextPosition.viewportY,
        options,
        currentBounds,
      );
      executeCommands(holdSession.tick(nextWeaponContext), nextExecutionContext);
    }

    animationFrameId = window.requestAnimationFrame(tick);
  };

  animationFrameId = window.requestAnimationFrame(tick);
  options.fireIntervalRef.current = animationFrameId;

  const upHandler = () => {
    options.isFiringRef.current = false;
    holdSession.end();
    if (options.fireIntervalRef.current != null) {
      window.cancelAnimationFrame(options.fireIntervalRef.current);
      options.fireIntervalRef.current = null;
    }
    window.removeEventListener("mousemove", moveHandler);
    window.removeEventListener("mouseup", upHandler);
  };

  window.addEventListener("mousemove", moveHandler);
  window.addEventListener("mouseup", upHandler);
  return true;
}

function placeStructure(
  event: MouseEvent,
  bounds: CanvasBounds,
  options: PointerDownHandlerOptions,
) {
  const placingStructureId = options.getPlacingStructureId();
  if (!placingStructureId) {
    return false;
  }

  const clickX = event.clientX - bounds.left;
  const clickY = event.clientY - bounds.top;
  const placedStructureId = `${placingStructureId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  options.getSwarm()?.addStructure(
    clickX,
    clickY,
    placingStructureId,
    placedStructureId,
  );
  options.getOnStructurePlace()?.(
    placingStructureId,
    event.clientX,
    event.clientY,
    clickX,
    clickY,
    placedStructureId,
  );
  return true;
}

export function createPointerDownHandler(
  options: PointerDownHandlerOptions,
  lastFireTimeRef: MutableRefObject<Record<string, number>>,
) {
  return (event: MouseEvent) => {
    const targetElement = event.target instanceof Element ? event.target : null;
    if (targetElement?.closest("[data-no-hammer]")) {
      return;
    }

    const bounds = options.updateBounds();
    if (!bounds.width || !bounds.height) {
      return;
    }

    options.currentMouseRef.current = { x: event.clientX, y: event.clientY };

    const selectedWeapon = options.getSelectedWeaponId();
    const selectedWeaponDef =
      WEAPON_DEFS.find((weapon) => weapon.id === selectedWeapon) ?? WEAPON_DEFS[0];

    if (selectedWeaponDef.inputMode === "hold") {
      if (!hasEntry(selectedWeapon)) {
        return;
      }

      startHoldSession(event, selectedWeapon, options, bounds, lastFireTimeRef);
      return;
    }

    if (placeStructure(event, bounds, options)) {
      return;
    }

    if (selectedWeaponDef.cooldownMs > 0) {
      const now = performance.now();
      const lastFire = lastFireTimeRef.current[selectedWeapon] ?? 0;
      if (now - lastFire < selectedWeaponDef.cooldownMs) {
        return;
      }
      lastFireTimeRef.current[selectedWeapon] = now;
    }

    const swarm = options.getSwarm();
    if (!swarm || !hasEntry(selectedWeapon)) {
      return;
    }

    const position = resolveViewportPosition(
      event.clientX,
      event.clientY,
      options.hammerPositionRef,
    );
    const weaponContext = createWeaponContext(
      selectedWeapon,
      position.viewportX,
      position.viewportY,
      bounds,
      swarm,
      options.getWeaponTier,
    );
    const executionContext = createExecutionContext(
      selectedWeapon,
      position.viewportX,
      position.viewportY,
      options,
      bounds,
    );
    const session = getEntry(selectedWeapon)!.createSession(weaponContext);

    if (session.mode === "once") {
      executeCommands(session.commands, executionContext);
      return;
    }

    if (session.mode === "persistent") {
      executeCommands(
        (session as PersistentFireSession).begin(weaponContext),
        executionContext,
      );
    }
  };
}