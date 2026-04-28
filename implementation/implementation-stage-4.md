# Implementation Stage 4: Survival Wave Director

## Goal

Build Survival into a continuously rolling wave mode where waves auto-advance, difficulty escalates, bug composition gradually skews toward critical variants, and the site goes offline when overwhelmed.

## Scope

### In scope

- Survival wave planning.
- Continuous spawning during waves.
- Auto-next-wave behavior.
- Site integrity and offline pressure model.
- Difficulty formulas supporting wave 25 and beyond.

### Out of scope

- Final visual polish from Stage 5.
- Full release validation from Stage 6.

## Changes Required

1. Formalize the Survival director in `src/features/game/sim/survivalDirector.ts`.
2. Define a wave plan model with:
   - Wave number.
   - Spawn rate.
   - Spawn budget.
   - Low / medium / high / critical bug weights.
   - Pressure/offline impact values.
3. Auto-start the next wave when all bugs are destroyed.
4. Continue spawning during each wave from random screen edges.
5. Add site integrity/offline pressure:
   - Too many active bugs increases offline pressure.
   - HUD displays time until site offline or a depletion bar.
   - Clearing bugs relieves pressure or slows depletion.
6. Tune the difficulty curve:
   - Waves 1–5: approachable, mostly low/medium bugs.
   - Waves 6–15: more high bugs and faster cadence.
   - Waves 16–25: critical bugs increasingly common and rate ramps aggressively.
   - Waves 26+: supported indefinitely with bounded formulas.
7. Add QA hooks for deterministic tests:
   - Force wave number.
   - Force site integrity.
   - Force spawn plan.

## Benchmarks

- Most players should fail before or around wave 25 after tuning.
- Wave transition after clearing all bugs occurs within 1 second.
- Survival remains responsive with high active bug counts using existing stress-test budgets.
- Difficulty formulas are deterministic under test inputs.

## Passing Test Requirements

- Unit tests for wave composition at waves 1, 5, 10, 15, 25, and 50.
- Unit tests for spawn-rate and offline-pressure curves.
- E2E test verifies auto-next-wave after clearing all bugs.
- E2E test verifies site offline game over.
- E2E test verifies HUD wave/offline/spawn-rate indicators.
- `npm run typecheck`
- `npm test`

## Acceptance Criteria

- Survival starts at wave 1 and continues without manual wave-start clicks.
- Bugs are added continuously from random screen edges.
- Composition gradually shifts toward high and critical bugs without an abrupt cliff.
- Site offline condition ends the run and opens the completion modal.
- Waves above 25 are supported.
