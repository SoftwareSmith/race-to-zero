# Implementation Plan 06: Minimal Movement Recovery

## Goal

Improve Time Attack bug motion from the restored baseline without repeating the failed full-system rewrite.

The target feel is:

- bugs look independently mobile,
- bugs do not visibly clump into shared local pods,
- bugs do not pace or circle a local point,
- bugs still fill the screen and remain readable to hit.

## Baseline

Current restored baseline was reviewed live before writing this plan.

- Screenshot at about 11 seconds shows screen-wide spread with no catastrophic clustering.
- QA bug positions show all 4 quadrants populated both early and settled.
- Current baseline metrics from live QA sampling:
  - early `count = 374`, `centerDensityRatio = 0.166`, `quadrantCounts = [90, 98, 96, 90]`
  - settled `count = 374`, `centerDensityRatio = 0.152`, `quadrantCounts = [86, 110, 87, 91]`

This is the rollback floor. New work must stay visually at least this stable.

## Non-Goals

Do not do any of the following in the next pass:

- no new spawn topology experiments,
- no orbit or tangent forces,
- no social cohesion or pack logic,
- no broad coverage-field steering,
- no simultaneous movement-and-spawn rewrites,
- no plan-sized refactor across multiple subsystems.

## Hard Constraints

1. Only one motion behavior change at a time.
2. After every change:
   - build,
   - run focused movement tests,
   - capture a fresh screenshot,
   - compare against the baseline screenshot.
3. If a change makes bugs look more synchronized, more clumped, or more circular, revert it immediately.
4. Time Attack and Survival must be treated separately. Fix Time Attack first.

## Phase 1: Diagnostics Only

Before changing movement again, add or restore only the smallest debug surface needed to inspect live motion.

- expose read-only QA data for:
  - active bug count,
  - screen positions,
  - per-bug heading,
  - per-bug current target or steering intent if one exists.
- do not change bug motion in this phase.

### Acceptance

- QA can sample live bug positions and headings without changing gameplay behavior.
- A screenshot and a numeric sample can be captured from the same live run.

## Phase 2: Replace Shared Center Intent With Timed Per-Bug Heading Refresh

If the baseline still relies on center attraction, replace that with the smallest possible independent motion model:

- each bug keeps a current heading intent for a short interval,
- when the interval expires, the bug picks a new heading biased away from walls and away from nearby crowding,
- the bug keeps moving through the field instead of steering toward a fixed shared point.

Important constraints:

- no target orbiting,
- no “arrive and dwell” behavior,
- no attraction toward another bug,
- no attraction toward a shared screen landmark.

### Acceptance

- bugs visually read as independent movers crossing the field,
- no obvious local circles around a target,
- no new dense pods in the first 10 seconds.

## Phase 3: Add Mild Local Deflection Only If Needed

Only if Phase 2 still produces crowding:

- add local directional deflection away from immediate neighbors,
- keep it radial only,
- do not add any perpendicular or swirl term.

### Acceptance

- neighbor avoidance breaks up overlaps,
- bugs do not start corkscrewing or moving in arcs around each other.

## Visual Acceptance Criteria

Every candidate change must pass all of these by screenshot review:

1. No obvious pods of bugs orbiting one local area.
2. No visible “lane parade” where many bugs share the same path.
3. No strong center heap.
4. No perimeter-only soup.
5. Bugs should look individually directed, not globally synchronized.

## Numeric Guardrails

These are guardrails, not the primary truth. Screenshot review wins.

- live count should remain correct,
- all 4 quadrants populated,
- center-density should not jump sharply above the baseline band,
- opening distribution should not collapse into a handful of dense startup clusters.

## Validation Loop

For each single movement change:

1. `npm test -- --run src/features/game/engine/BugEntity.test.ts src/features/game/engine/Engine.test.ts`
2. `npm run build`
3. load live Time Attack with QA stabilization disabled,
4. capture opening screenshot,
5. capture settled screenshot,
6. revert immediately if the new motion looks worse.

## Exit Criteria

Stop the next movement pass once all of the following are true:

- Time Attack looks better than the restored baseline in screenshots,
- bugs visibly move independently instead of clumping or circling,
- focused movement tests pass,
- no new regression appears in build or siege-mode E2E.