# Implementation Stage 5: Spawn Physics and Game Feel

## Goal

Make both modes feel simple, addictive, and fun by improving spawn positioning, pacing, feedback, and moment-to-moment clarity.

## Scope

### In scope

- Edge spawn behavior for Survival.
- Fair Time Attack placement.
- Readability under pressure.
- Lightweight feedback loops.
- Performance safeguards.

### Out of scope

- New remote services.
- Major art-system replacement.
- Optional player profile systems.

## Changes Required

1. Update engine spawn utilities in `src/features/game/engine/Engine.ts` or related spawn helpers so Survival bugs always enter from random screen edges.
2. Ensure Time Attack initial placement remains fair and immediately playable.
3. Tune movement and spawn rate to avoid unfair instant hits or unreadable clusters.
4. Add lightweight feedback:
   - Streak callouts.
   - Wave start microcopy.
   - Near-offline warning pulse.
   - New-best leaderboard celebration.
5. Review weapon progression pacing:
   - Time Attack should stay fast and skill-based.
   - Survival should allow meaningful escalation and late-tier payoff.
6. Preserve performance safeguards for large swarms and avoid excessive React state churn.

## Benchmarks

- Spawned bugs should not appear directly on top of the main play focus unless intentionally allowed.
- New Survival waves should be legible within the first 2 seconds.
- No sustained frame-time regression versus existing game stress baselines.
- Active bug cap/backpressure strategy prevents runaway browser stalls at extreme waves.

## Passing Test Requirements

- Unit tests for edge spawn coordinate generation.
- Unit tests for wave spawn-rate formulas.
- Playwright performance stress test for Survival at elevated wave/bug counts.
- Existing weapon tests still pass.
- `npm run typecheck`
- `npm test`
- Targeted Playwright game/performance specs.

## Acceptance Criteria

- Survival bugs enter from random screen edges.
- Spawn rate visibly increases wave over wave.
- Gameplay remains readable and responsive.
- Feedback makes “one more run” appealing without adding UI clutter.
