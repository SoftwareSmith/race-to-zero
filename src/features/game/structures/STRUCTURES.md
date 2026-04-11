# Structure Plugin Architecture

Same plugin pattern as the weapon system — each structure is an isolated folder
that registers its own tick behaviour on import. Engine.ts dispatches through the
registry on every simulation frame, so adding a new structure never requires
editing Engine.ts.

---

## Directory Map

```
src/features/game/structures/
├── STRUCTURES.md               ← this file
├── index.ts                    ← barrel: re-exports config + self-registration
│
├── runtime/
│   ├── types.ts                ← ALL shared contracts (no logic)
│   └── registry.ts             ← register() / getEntry() / hasEntry()
│
└── <structure-id>/             ← one folder per structure
    ├── behavior.ts             ← StructureBehavior object with tick()
    └── index.ts                ← imports behavior, calls register()
```

Engine.ts imports `@game/structures/index` at module load, which triggers all
five `register()` calls. `tickStructures()` then dispatches via `getEntry(s.type)`.

---

## Key Contracts (`runtime/types.ts`)

### `StructureBehavior`
```ts
interface StructureBehavior {
  readonly structureId: StructureId;
  readonly config: StructureDef;
  tick(entry: StructureEntry, ctx: StructureTickContext): void;
}
```

Register with `register(behavior)` in the plugin's `index.ts`.

### `StructureEntry`
The mutable per-instance state that this plugin both reads and writes each tick:

| field | used by |
|-------|---------|
| `id`, `type`, `x`, `y` | all |
| `nextCaptureAt` | agent, turret, tesla |
| `absorbing` | agent (pull/process state) |
| `aimPhase` | turret (aim lock-on) |
| `lastFireAngle` | turret (visual rotation) |
| `placedAt` | firewall expiry (checked in Engine.ts) |
| `firewallNextDamageAt` | firewall |

### `StructureTickContext`
```ts
interface StructureTickContext {
  now: number;               // engine.elapsedMs at tick start
  dtMs: number;              // frame delta
  engine: StructureGameEngine;
  callbacks: StructureCallbacks;
}
```

### `StructureGameEngine`
Typed facade over Engine internals available to behaviors:

| method | description |
|--------|-------------|
| `getEntities()` | All live entities (behaviors must guard `state === "dead"`) |
| `spliceEntity(index)` | Remove & return entity (used by agent to capture) |
| `returnToPool(entity)` | Return entity to bug pool after splice |
| `handleHit(idx, dmg, credit)` | Deal damage; returns `HitResult \| null` |
| `elapsedMs` | Read-only elapsed simulation time |

### `StructureCallbacks`
Pre-bound engine callbacks passed to behaviors:

| callback | fired when |
|----------|-----------|
| `onStructureKill(x, y, variant)` | structure deals a lethal hit |
| `onAgentAbsorb(data)` | agent phase changes (absorbing/pulling/done/failed) |
| `onTurretFire(data)` | turret aims (phase="aim") or fires (phase="fire") |
| `onTeslaFire(data)` | tesla discharges a chain-zap with node positions |

---

## Behavior Summary

### Lantern (`lantern/behavior.ts`)
- `tick()` iterates all entities in 280px radius
- Applies tangential (left-orbit) push + inward radial pull each frame
- No cooldown, no callbacks — purely physics

### Agent (`agent/behavior.ts`)
- **Phase 1** — every 2s: find nearest bug in 80px radius, splice it out
  immediately, start 500ms pull animation
- **Phase 2** — during pull: animate `absorbing.bugX/Y` toward agent origin,
  fire `onAgentAbsorb({ phase: "pulling" })` each tick
- **Completion** — after pull + processing: 20% failure chance; fires
  `onAgentAbsorb({ phase: "done" | "failed" })` + `onStructureKill` on success

### Turret (`turret/behavior.ts`)
- Every 2.5s: find nearest bug in 150px, enter 500ms `aimPhase`
- During aim: fires `onTurretFire({ phase: "aim" })` for tracer VFX
- On aim completion: re-finds nearest bug at locked position, deals 1 damage,
  fires `onTurretFire({ phase: "fire" })` + `onStructureKill` if lethal

### Tesla Coil (`tesla/behavior.ts`)
- Every 2.5s: sort bugs within 120px by distance, pick up to 3
- Deals 1 damage to each; builds `nodes` array (coil origin + each bug)
- Fires `onTeslaFire({ nodes })` for lightning VFX + `onStructureKill` per kill

### Firewall (`firewall/behavior.ts`)
- Every 800ms: scan all bugs whose `x` falls within ±20px of structure x
- Deals 1 damage per tick; fires `onStructureKill` per lethal hit
- Expiry (8s) is handled by Engine.ts before the tick loop runs

---

## Adding a New Structure

1. **Add to `StructureId` in `src/features/game/types.ts`**

```ts
export type StructureId = "lantern" | "agent" | "turret" | "tesla" | "firewall" | "my-new-structure";
```

2. **Add a `StructureDef` entry in `src/config/structureConfig.ts`**

3. **Create `src/features/game/structures/<slug>/behavior.ts`**

```ts
import type { StructureBehavior, StructureEntry, StructureTickContext } from "@game/structures/runtime/types";
import { STRUCTURE_DEFS } from "@config/structureConfig";

export const myStructureBehavior: StructureBehavior = {
  structureId: "my-new-structure",
  config: STRUCTURE_DEFS.find((s) => s.id === "my-new-structure")!,
  tick(entry: StructureEntry, ctx: StructureTickContext): void {
    // ...
  },
};
```

4. **Create `src/features/game/structures/<slug>/index.ts`**

```ts
import { register } from "@game/structures/runtime/registry";
import { myStructureBehavior } from "./behavior";
register(myStructureBehavior);
```

5. **Add a barrel import to `src/features/game/structures/index.ts`**

```ts
import "./<slug>/index";
```

6. **Add rendering** to `src/features/game/components/StructureLayer.tsx`

7. **Write tests** in `structures/__tests__/behaviors.test.ts`

That's it — Engine.ts needs no changes.

---

## Testing

- `__tests__/registry.test.ts` — verifies all 5 structures are registered
- `__tests__/behaviors.test.ts` — per-behavior tick unit tests with a mock engine
