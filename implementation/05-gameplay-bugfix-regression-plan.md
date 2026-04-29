# Implementation Plan 05: Gameplay Bugfix Regression Plan

## Reported Bugs

1. Time Attack movement regressed: bugs clumped and spun in circles instead of filling the playfield.
2. Time Attack completion reached `Left = 0` but did not show the completion/leaderboard modal.
3. Switching from Time Attack to Survival did not reset alive, kills, and time.
4. Survival wave pill did not visibly load and no new bugs spawned per second.

## Root Cause Research

### 1. Movement clumping and circular spinning

- The previous roam-anchor implementation still generated targets from a center-biased radial pattern.
- The near-target behavior added a strong perpendicular orbit force, causing bugs to circle a local point instead of retargeting and roaming.
- Time Attack initial spawns were still heavily biased toward dashboard siege zones: `Engine.spawnFromCounts()` used zone spawns 84% of the time when zones existed.
- QA movement tests can be misleading if `enableCanvasQa()` uses its default `stabilizeEngine: true`, because it intentionally places all bugs at the center.

### 2. Time Attack completion modal not appearing

- Hook tests covered direct hit completion and QA progress completion, but live engine sync can report `0` repeatedly without forcing a final state transition if the runtime snapshot already contains `0`.
- The startup zero-bug fallback was already scoped to `siegePhase === "entering"`, which is correct. The missing final state transition still needed hardening in `syncRemainingBugs()`.

### 3. Survival tab switch not resetting state

- The HUD tab called `changeGameMode()`, which only changed the mode string.
- It did not start a fresh Survival run, reset runtime counters, reset evolution, initialize Survival budget/timers, or create a new session key.

### 4. Wave pill not loading / no spawns

- Because tab switching only changed `gameMode`, Survival status often had no live `waveStartedAt`, no meaningful remaining budget, and no active spawn timer state.
- The wave loader and accumulator logic works only after `enterInteractiveMode("outbreak")` initializes the Survival runtime.

## Fix Plan Applied

### Movement fixes

- Replace center-biased radial roam target generation with full-screen target selection across safe margins.
- Retarget when a bug reaches a roam target instead of orbiting the target.
- Reduce target pull strength so bugs drift organically rather than converging aggressively.
- Keep crowd avoidance, but use it to push bugs away and retarget rather than tighten circular packs.
- Reduce Time Attack spawn-zone bias in `Engine.spawnFromCounts()` so most bugs spawn across the whole canvas instead of dashboard zones.

### Completion modal fixes

- Force a fresh runtime snapshot when live engine sync reports `0`, even if the previous runtime count was already `0`.
- Keep completion outcomes explicit:
  - `timeAttackCleared`
  - `survivalOverrun`
- Ensure E2E verifies the Time Attack completion title after live progress reaches zero.

### Survival switch/reset fixes

- Replace direct HUD `changeGameMode()` wiring with a `handleChangeGameMode()` in `SiegeExperience`.
- When a mode tab changes during play:
  - close menus,
  - clear chart focus,
  - reset weapon evolution,
  - call `enterInteractiveMode(nextMode)` with a fresh session.

### Wave loader/spawn fixes

- Survival mode now initializes via `enterInteractiveMode("outbreak")`, so the wave loader receives live timestamps and budget.
- Spawn accumulator continues to honor decimal `spawnRatePerSecond` and active bug caps.
- E2E verifies wave fill width increases and alive count increases after switching to Survival.

## Regression Tests Added / Updated

### Unit and hook tests

- `BugEntity.test.ts`
  - roam anchors are not exact center targets,
  - crowding pushes bugs away,
  - stale anchors reset on revive.
- `Engine.test.ts`
  - crowding scores remain stable,
  - simulated swarms remain distributed across quadrants.
- `useSiegeGame.test.ts`
  - active zero-bug sync completes Time Attack,
  - Survival overrun creates the correct outcome,
  - wave loader progress and budget update.
- `useSiegeRunCompletion.test.ts`
  - local leaderboards stay mode-isolated,
  - invalid stored weapon IDs are rejected,
  - non-top runs do not show rank `0`.
- `WaveProgressPill.test.tsx`
  - fill width reflects progress,
  - missing countdown is handled.

### E2E tests

- `siege-mode.spec.ts`
  - Time Attack bugs remain distributed across all screen quadrants.
  - Time Attack zero progress displays `Swarm cleared. Time recorded.`
  - Switching the HUD tab to Survival starts a fresh run with kills/time reset.
  - Survival wave loader fill increases.
  - Survival alive count increases from wave spawns.
  - Survival site offline displays the overrun completion modal.

## Validation Commands

- `npm test -- src/features/game/engine/BugEntity.test.ts src/features/game/engine/Engine.test.ts src/features/game/hooks/useSiegeGame.test.ts`
- `npm run test:e2e -- tests/e2e/siege-mode.spec.ts`
- `npm run typecheck`
- `npm run build`

## Follow-up Improvements

- Add a lightweight debug-only swarm distribution overlay showing quadrant counts and central-density ratio.
- Consider exposing a movement tuning panel for `followStrength`, `wanderStrength`, and spawn-zone bias.
- Add a Playwright screenshot comparison for the Time Attack distribution test once the visual baseline is stable.
