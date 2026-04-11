# Weapon Plugin Architecture

A self-contained plugin system for siege weapons. Each weapon is an isolated
folder that registers its own behaviour on import; the BackgroundField seam
routes fire events through the registry before falling back to the legacy
switch block, so old and new weapons coexist safely.

---

## Directory Map

```
src/features/game/weapons/
├── WEAPONS.md                  ← this file
├── index.ts                    ← barrel: WEAPON_DEFS + plugin self-registration
├── types.ts                    ← WeaponDef (static config per weapon)
├── <weapon-id>.ts              ← legacy static defs (still used by old path)
│
├── runtime/
│   ├── types.ts                ← ALL shared contracts (no weapon logic)
│   ├── registry.ts             ← register() / getEntry() / session state
│   ├── cooldownManager.ts      ← pure cooldown helpers
│   ├── targetingHelpers.ts     ← geometry / hit-test helpers
│   └── executor.ts             ← executeCommands() — applies WeaponCommands
│
├── effects/
│   ├── types.ts                ← re-exports WeaponEffectDescriptor
│   └── adapter.ts              ← applyEffectDescriptor() → VfxEngine calls
│
└── <plugin-folder>/            ← one folder per weapon
    ├── behavior.ts             ← createSession() returns FireSession
    └── index.ts                ← imports behavior + def, calls register()
```

---

## Key Contracts (`runtime/types.ts`)

### `WeaponEntry`
```ts
interface WeaponEntry {
  readonly weaponId: SiegeWeaponId;
  readonly config: WeaponDef;
  createSession(ctx: WeaponContext): FireSession;
}
```
Register via `register(entry)` in the plugin's `index.ts`.

### `WeaponContext`
Passed to `createSession()` on every fire. Contains canvas-local target
position, center, dimensions, viewport position, timestamp, and a typed
`GameEngine` facade.

### `ExecutionContext`
Passed to `executeCommands()`. Contains engine, VFX engine, canvas element,
bounds, `onHit` callback, `updateQaLastHit`, `enqueueOverlay`, and the
`blackHoleVfxIdRef`.

---

## Session Variants

### `ClickFireResult` — single-shot
```ts
{ mode: "once"; commands: WeaponCommand[] }
```
Return from `createSession()` when the entire effect is resolved synchronously
(wrench, freeze-cone, chain-zap, laser-cutter, static-net, null-pointer).

### `HoldFireSession` — continuous (mouse held)
```ts
{
  mode: "hold";
  begin(ctx): WeaponCommand[];   // called on mousedown
  tick(ctx): WeaponCommand[];    // called each cooldown frame
  paint?(ctx): WeaponCommand[];  // called on every mousemove (visual only)
  end(): void;                   // called on mouseup
}
```
Used by flame and bug-spray. The BackgroundField seam manages the RAF loop and
cleans up listeners automatically.

### `PersistentFireSession` — timed / self-terminating
```ts
{
  mode: "persistent";
  active: boolean;          // goes false when the effect is done
  begin(ctx): WeaponCommand[];
  abort(): void;
}
```
Used by plasma-bomb (two-phase explosion, ~600 ms) and void-pulse (black hole,
~2100 ms). Only one void-pulse can be active at a time; fire is blocked while
`engine.getBlackHole()?.active` is true.

---

## `WeaponCommand` Reference

All game-state mutations are expressed as commands executed by `executeCommands()`.

| kind | effect |
|------|--------|
| `damage` | `engine.handleHit(index, amount)` → fires `onHit` callback |
| `applyPoison` | per-bug DoT: `engine.handleHit` each tick internally |
| `applyBurn` | per-bug fire DoT with decay |
| `applyFreeze` | per-bug slow (intensity 0–1, durationMs) |
| `applyEnsnare` | per-bug net slow |
| `knockback` | direct `dx/dy` impulse on a bug |
| `poisonRadius` | `engine.applyPoisonInRadius` |
| `burnRadius` | `engine.applyBurnInRadius` |
| `ensnareRadius` | `engine.applyEnsnareInRadius` |
| `repeatPoisonRadius` | repeated poison ticks over `totalMs` at `intervalMs` |
| `startBlackHole` | `engine.startBlackHole` |
| `spawnEffect` | visual-only: routes to `applyEffectDescriptor` |

`executeCommands` also calls `triggerWeaponShake` after any non-empty batch.

---

## `WeaponEffectDescriptor` Reference

Passed inside a `spawnEffect` command. Handled by `effects/adapter.ts`.

| type | VfxEngine call |
|------|----------------|
| `sprayParticles` | `vfx.spawnSprayParticles` |
| `toxicCloud` | `vfx.addToxicCloud` |
| `firePatch` | `vfx.addFirePatch` |
| `flameTrailBurst` | `vfx.spawnFlameTrailBurst` |
| `fireTrailStamp` | `vfx.addFirePatch` (small stamp) |
| `burnScar` | `vfx.addBurnScar` |
| `crack` | `vfx.spawnCrack` |
| `explosion` | `vfx.spawnExplosion` |
| `snowflakeDecals` | `vfx.spawnSnowflakeDecals` |
| `lightning` | `vfx.spawnLightning` |
| `sparkCrown` | `vfx.spawnSparkCrown` |
| `binaryBurst` | `vfx.spawnBinaryBurst` |
| `netCast` | `vfx.spawnNetCast` |
| `empBurst` | `vfx.spawnEmpBurst` |
| `plasmaImplosion` | `vfx.spawnPlasmaImplosion` |
| `plasmaExplosion` | `vfx.spawnPlasmaExplosion` |
| `createBlackHole` | `vfx.createBlackHole` → stores VFX ID in `blackHoleVfxIdRef` |
| `voidCollapse` | `vfx.triggerBlackHoleCollapse` |
| `tracerLine` | `vfx.addTracerLine` |
| `overlayEffect` | `enqueueOverlay(weaponId, vx, vy, extras)` |

---

## Adding a New Weapon

1. **Create `src/features/game/weapons/<slug>/behavior.ts`**

```ts
import type { WeaponContext, FireSession, WeaponCommand } from "@game/weapons/runtime/types";

export function createSession(ctx: WeaponContext): FireSession {
  const commands: WeaponCommand[] = [
    // build your commands here
  ];
  return { mode: "once", commands };
}
```

2. **Create `src/features/game/weapons/<slug>/index.ts`**

```ts
import myDef from "../my-weapon-def"; // existing WeaponDef
import { register } from "@game/weapons/runtime/registry";
import { createSession } from "./behavior";

register({ weaponId: "my-weapon-id", config: myDef, createSession });
```

3. **Add a barrel import to `src/features/game/weapons/index.ts`**

```ts
import "./<slug>/index";
```

4. **Write tests in `weapons/__tests__/behaviors.test.ts`** using `makeMockEngine()`.

That's it. The BackgroundField seam intercepts fires for any registered weapon
before reaching the legacy switch block.

---

## Overlay Effect Gate

Only weapons in `OVERLAY_EFFECT_WEAPONS` (set in BackgroundField) fire an SVG
overlay event:

```ts
const OVERLAY_EFFECT_WEAPONS = new Set(["freeze", "chain", "laser", "nullpointer", "void"]);
```

The `overlayEffect` descriptor in these weapons passes viewport-space
coordinates and extras (e.g. `chainNodes`, `segments`, `targetX/Y`) to
`enqueueOverlay`, which calls `onWeaponFireRef.current`.

---

## Cooldown Enforcement

The legacy cooldown check in BackgroundField still runs for registered weapons
(it reads `weaponDef.cooldownMs` from the static WEAPON_DEFS array). The
plugin sees a clean slate every time `createSession` is called.

Hold-weapon tick timing is managed entirely inside the BackgroundField seam
using `lastFireTimeRef` and a RAF loop; the plugin only needs to provide
`config.cooldownMs` for the tick rate.
