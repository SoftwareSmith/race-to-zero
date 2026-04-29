# Implementation Plan 01: Organic Bug Movement

## Goal

Make bug motion feel organic and natural while fixing the current tendency for bugs to collect in the middle of the board. Bugs should drift, swirl, avoid overcrowding, and form loose transient groups without every entity targeting the canvas center.

## Current Gameplay Review

- `src/features/game/engine/BugEntity.ts` currently steers every non-fleeing hostile bug toward `bounds.width * 0.5` / `bounds.height * 0.5` once it is outside `targetReachRadius`.
- Existing motion already includes Perlin drift, wander angle, wall steering, and local separation.
- `Engine` already maintains a spatial grid and exposes `getNeighbors()` and `getCrowdingAt()`, but `BugEntity.update()` only consumes `getNeighbors()` in its TypeScript context.
- `DEFAULT_GAME_CONFIG` already defines unused crowding/repath fields (`crowdAvoidRadius`, `crowdRepathDelay`, `crowdRepathThreshold`, `crowdSteerStrength`, `crowdTargetPenalty`) that can be repurposed instead of adding many new knobs.
- Spawn paths:
  - Time Attack uses `Engine.spawnFromCounts()` and can seed bugs across siege zones or the canvas.
  - Survival uses `Engine.spawnBurst()` from edges.
  - `canvasState.reseedClusteredBugs()` is a safety net for hard clustering bugs, not the desired movement model.

## Proposed Design

Replace hard center attraction with a per-bug “roam anchor” system:

1. Each bug owns a lightweight roam anchor (`roamTargetX`, `roamTargetY`, `nextRoamTargetAt`, `orbitBias`, `packAffinity`).
2. Anchors are distributed across the board using seeded rings/lanes and slowly retarget over time.
3. Bugs steer toward their anchor only when far enough away, then orbit/wander near it.
4. Nearby crowding pushes anchors or desired velocity away from dense local centers.
5. A very mild global “stay in play” bias keeps bugs away from edges without pulling all of them to the exact center.

This gives every bug a reason to move, but not the same destination.

## Implementation Steps

### 1. Extend movement context

- Update `BugUpdateContext` in `BugEntity.ts` to include the existing engine method:
  - `getCrowdingAt?: (x: number, y: number, r: number, exclude?: BugEntity) => { centerX: number; centerY: number; count: number; score: number }`
- Keep it optional so tests and non-engine callers do not break.

### 2. Add roam state to `BugEntity`

- Add fields:
  - `roamTargetX: number | null`
  - `roamTargetY: number | null`
  - `nextRoamTargetAt: number`
  - `orbitBias: -1 | 1`
  - `packAffinity: number`
- Initialize them in the constructor.
- Reset them in `revive()` if that method exists lower in `BugEntity.ts`; otherwise ensure pooled bugs reset when reused in `Engine.spawnFromCounts()` and `Engine.spawnBurst()`.

### 3. Add deterministic target generation helpers

- Add private helpers in `BugEntity`:
  - `chooseRoamTarget(bounds, now, config)`
  - `getRoamTarget(bounds, now, config)`
  - `getBoardBias(bounds, config)`
- Use seeded randomness from `this.seed`, `this.motionTime`, and existing `perlin1D()` so movement is stable but not synchronized.
- Prefer target zones like:
  - 20–80% of width and height for ambient roaming.
  - Occasional edge lanes for survival bugs after edge spawn.
  - No fixed center unless chosen as one of many possible anchors.

### 4. Replace center pull block

- Remove the current block that computes `centerX`, `centerY`, and `centerPullStrength` for every bug.
- Add desired steering toward the bug’s current roam anchor.
- When close to the anchor, add perpendicular orbit force plus wander rather than stronger target attraction.
- When `getCrowdingAt()` reports too many neighbors or high score, add steering away from the crowd center and retarget sooner.

### 5. Tune separation and crowding

- Keep local separation, but reduce the `config.separationStrength * 1.65` multiplier if it causes jitter after crowd steering is added.
- Use existing config fields first:
  - `crowdAvoidRadius`
  - `crowdRepathThreshold`
  - `crowdSteerStrength`
  - `crowdTargetPenalty`
- Add new config only if the existing fields are insufficient.

### 6. Make spawn direction support the new model

- For edge-spawned survival bugs, let initial heading continue inward, but assign early anchors offset from the exact center so they fan out.
- For Time Attack, avoid reseeding all initial bugs into the same central attractor during the first seconds.

## Tests

### Unit tests

- Add or update `src/features/game/engine/BugEntity.test.ts`:
  - Non-fleeing bugs should not always steer toward exact canvas center.
  - A bug with high local crowding should steer away from the crowd center.
  - A bug near its roam anchor should orbit/wander instead of stopping.
  - Pooled/revived bugs should reset stale roam targets.
- Add or update `src/features/game/engine/Engine.test.ts`:
  - `getCrowdingAt()` remains stable for sparse and dense neighborhoods.
  - Simulation of many bugs for several seconds should keep a reasonable distribution across board quadrants.

### E2E / visual QA

- Extend `tests/e2e/performance/bug-render-stress.spec.ts` or add a focused gameplay spec:
  - Start Time Attack and assert bug positions are not overly concentrated in a small central box after a few seconds.
  - Start Survival and assert edge-spawned bursts disperse into multiple regions.
- Reuse existing QA bug position hooks from `BackgroundField/qa.ts` if available.

## Acceptance Criteria

- Bugs no longer visibly clump in the exact middle during Time Attack or Survival.
- Movement still reads as hostile/active: bugs keep moving, avoid walls, and react to the cursor threat.
- Large swarms remain performant because neighbor and crowd checks continue to use the spatial grid.
- No regression to click hit testing, weapon targeting, or live bug counts.

## Validation Commands

- `npm run typecheck`
- `npm test -- src/features/game/engine/BugEntity.test.ts src/features/game/engine/Engine.test.ts`
- `npm run test:e2e -- tests/e2e/siege-mode.spec.ts`
- `npm run build`