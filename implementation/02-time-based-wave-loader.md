# Implementation Plan 02: Time-Based Wave Loader Pill

## Goal

Improve Survival waves with a visible time-based “loader pill” that fills over the current wave duration. When full, it advances to the next wave. Each wave must add bugs to the board at the authored `x bugs/second` rate.

## Current Gameplay Review

- Survival mode is represented as `gameMode === "outbreak"`.
- `src/features/game/sim/survivalDirector.ts` already defines timed wave data:
  - `waveDurationMs = 30_000`
  - `spawnRatePerSecond`
  - `spawnBudget`
  - `burstSize`
  - `activeBugLimit`
  - variant weights and focus labels.
- `src/features/game/hooks/useSiegeGame.ts` already tracks:
  - `survivalWaveEndsAtRef`
  - `survivalRemainingBudgetRef`
  - `secondsUntilNextWave`
  - `survivalSpawnPlan`
- Current spawning happens once per second by queuing `plan.burstSize`, capped by `remainingBudget` and `activeBugLimit`.
- `src/features/game/components/SiegeHud.tsx` currently shows small pills for wave, rate, and site online state, but does not show an actual filling wave loader.
- `src/features/game/components/BackgroundField/BugCanvas.tsx` applies each unique `survivalSpawnPlan.sequenceId` by calling `Engine.spawnBurst()`.

## Proposed Design

Add an explicit wave progress model to the hook and render it as a pill in the HUD.

The pill should display:

- Current wave number.
- Fill percentage for elapsed wave time.
- Countdown text.
- Spawn rate (`x/s`).
- Optional next wave label/tactic.

Wave progress should be based on timestamps, not a separate interval counter, so it remains accurate after tab throttling or frame skips.

## Implementation Steps

### 1. Extend survival status shape

Update `SurvivalRuntimeStatus` in `useSiegeGame.ts` with:

- `waveDurationMs: number`
- `waveStartedAt: number | null`
- `waveEndsAt: number | null`
- `waveProgressPercent: number`
- `remainingSpawnBudget: number`
- `activeBugLimit: number`

Initialize these in:

- `useState()` default survival status.
- `resetSurvivalRuntime()`.
- `enterInteractiveMode()` for Survival.
- `startSurvivalWave()`.

### 2. Compute wave progress from timestamps

In the survival pressure tick in `useSiegeGame.ts`:

- Read `waveStartedAt` and `survivalWaveEndsAtRef.current`.
- Compute:
  - `elapsedWaveMs = now - waveStartedAt`
  - `waveProgressPercent = clamp(elapsedWaveMs / plan.waveDurationMs * 100, 0, 100)`
  - `secondsUntilNextWave = ceil((waveEndsAt - now) / 1000)`
- Store `remainingSpawnBudget` from `survivalRemainingBudgetRef.current`.

### 3. Preserve bugs/second spawning

Current code spawns `burstSize = ceil(spawnRatePerSecond)` every 1 second. This is simple but can overshoot the semantic rate for decimal rates.

Replace it with an accumulator:

- Add `survivalSpawnAccumulatorRef = useRef(0)` and `survivalLastSpawnTickAtRef = useRef<number | null>(null)`.
- On every spawn tick:
  - Calculate elapsed seconds since last tick.
  - Add `plan.spawnRatePerSecond * elapsedSeconds` to the accumulator.
  - Spawn `floor(accumulator)` bugs, capped by budget and active limit.
  - Subtract the spawned count from the accumulator.
- Keep a short tick interval (250–500ms) so the board receives smoother additions while still honoring `x bugs/second`.
- Reset accumulator at every new wave.

### 4. Create a wave loader component

Add a small component, likely `src/features/game/components/siege-hud/WaveProgressPill.tsx`, with props:

- `wave`
- `progressPercent`
- `secondsUntilNextWave`
- `spawnRatePerSecond`
- `remainingSpawnBudget`
- `activeBugLimit`
- `tacticLabel`
- `focusLabel`

Visual requirements:

- Rounded pill container.
- Fill layer inside the pill using `width: ${progressPercent}%`.
- Text remains readable above the fill.
- Use the existing HUD palette and `HudShell` / `HudEventPill` styling language.
- Add `data-testid="siege-wave-loader-pill"` and `data-testid="siege-wave-loader-fill"`.

### 5. Wire the component into `SiegeHud`

- Extend `SiegeHudProps.survivalStatus` with the new fields.
- Replace or augment the current top-left Survival stat grid with the loader pill.
- Keep the current `Wave`, `Rate`, and `Site online` information, but avoid overcrowding. Preferred layout:
  - Loader pill as the primary element.
  - Site online pill beside it or below it on small screens.

### 6. Optional manual fast-forward

If design wants the pill to behave like a slider/control rather than display-only:

- Add `onAdvanceWave?: () => void` to `SiegeHud`.
- Add `advanceSurvivalWave()` in `useSiegeGame` that calls `startSurvivalWave(currentWave + 1)`.
- Gate the button behind Survival active mode only.
- Add test id `siege-advance-wave`.

Do this only if “slider approach” means interactive. If it means loader styling, keep it display-only.

## Tests

### Unit tests

- Update `src/features/game/sim/survivalDirector.test.ts`:
  - `spawnBudget` equals about `spawnRatePerSecond * waveDurationSeconds` within rounding expectations.
  - `burstSize` no longer drives exact spawn cadence if accumulator logic is moved into the hook.
- Add focused tests for a pure helper if one is extracted:
  - `calculateWaveProgress(now, startedAt, durationMs)`.
  - `calculateSpawnRequest(accumulator, rate, elapsedSeconds, budget, activeLimit, activeBugs)`.

### Component tests

- Add tests for `WaveProgressPill`:
  - Fill width reflects `progressPercent`.
  - Shows wave, countdown, and spawn rate.
  - Handles `secondsUntilNextWave === null` gracefully.

### E2E tests

- Extend `tests/e2e/siege-mode.spec.ts` or `tests/e2e/siege-progression.spec.ts`:
  - Start Survival.
  - Assert loader pill is visible and fill increases.
  - Use existing QA `setSurvivalState({ completeWave: true })` to advance wave.
  - Assert wave label and spawn rate update.

## Acceptance Criteria

- Survival displays a clear filling pill for the current wave.
- The pill reaches 100% when the wave expires and the next wave starts.
- Bugs are added continuously according to each wave’s `spawnRatePerSecond`, not only as a single wave lump.
- Existing Survival pressure/offline behavior remains intact.
- Build and E2E tests remain stable under tab/frame throttling.

## Validation Commands

- `npm run typecheck`
- `npm test -- src/features/game/sim/survivalDirector.test.ts`
- `npm run test:e2e -- tests/e2e/siege-mode.spec.ts tests/e2e/siege-progression.spec.ts`
- `npm run build`