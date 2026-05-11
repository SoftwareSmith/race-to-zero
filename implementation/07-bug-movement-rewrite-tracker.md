# Bug Movement Rewrite Tracker

This file is the workspace-visible copy of the movement rewrite plan.

It is intended to be updated as implementation progresses so the current state is visible without relying on session memory.

## Toroidal Wrap Continuation

- Current phase: Phase 7 live validation and post-wrap movement hardening in progress
- Current focus: validating live Time Attack and Survival behavior after patching dense-swarm crowd spin loops and keeping toroidal seam behavior intact
- Validation status: focused toroidal movement/render/QA/engine tests passing, build passing, seam-aware Playwright coverage in place, live dense-swarm Time Attack crowd-loop sample clean, late-wave Survival spin-loop signature reduced substantially but minor patrol curls still exist, full live mode sweep still pending
- Latest implementation slice:
  - [x] Add shared toroidal math helpers for wrapped coordinate and delta logic
  - [x] Route `BugEntity` onto the shared toroidal math helpers
  - [x] Make engine spatial buckets and seam-neighbor lookup wrap-aware for active bugs
  - [x] Make engine crowding centers wrap-aware for active bugs
  - [x] Make point, line, radius, cone, chain, and nearest-target queries use wrapped deltas for active bugs
  - [x] Stop clamping pre-entry bugs back onto the board during the engine update step
  - [x] Add focused engine regressions for seam-local neighbors, wrapped crowding, wrapped hit tests, and preserved pre-entry offscreen state
  - [x] Remove bounded-board seam bias from active roam-target scoring in `BugEntity.ts`
  - [x] Stop active bugs from treating seam proximity as edge comfort or preferred-region scoring
  - [x] Add focused movement regressions for seam-neutral active-field roam classification and scoring
  - [x] Expand `RenderedBugPosition` metadata to include explicit seam-copy render positions
  - [x] Flatten visible seam copies into QA-facing bug positions so QA reflects what the canvas actually draws
  - [x] Add focused QA regression coverage for mirrored seam bug positions
  - [x] Re-run focused tests and production build after the implementation slice
  - [x] Add a QA-only live-bug reposition hook so seam cases can be forced deterministically in Playwright
  - [x] Add a seam-aware siege Playwright regression that asserts canonical and wrapped-copy QA positions for a seam-adjacent live bug
  - [x] Add QA telemetry for per-bug crowd count, crowd score, neighbor count, and applied separation scale
  - [x] Diagnose dense-swarm spin loops as a broad-crowd pressure saturation problem rather than a seam-render issue
  - [x] Normalize broad crowd pressure by crowd count so large diffuse swarms do not behave like point-blank crowd crushes
  - [x] Rebalance close-range separation using actual neighbor count so anti-pod behavior stays intact after the crowd-pressure fix
  - [x] Add a crush-state steering branch that abandons roam intent under true local saturation instead of letting patrol steering keep orbiting
  - [x] Reduce patrol noise and heading lag in medium-density swarms so bugs keep committing through crowd pressure pockets
  - [x] Rebalance crowd-aware separation so the anti-pod engine regression stays green after the medium-density anti-loop tuning
  - [x] Gate the heaviest crush-response tuning behind total active bug count so the extra separation/escape pressure only engages in 900+ bug late-wave Survival swarms
  - [ ] Perform full live seam and mode QA in Time Attack and Survival after this implementation slice

### Full Toroidal Plan

- [x] Phase 1: Establish a single toroidal math layer
- [x] Phase 2: Fix engine-side spatial semantics
- [x] Phase 3: Fix movement intent and steering end-to-end
- [x] Phase 4: Fix gameplay rendering and interaction consistency
- [x] Phase 5: Make weapon and pointer interactions toroidal
- [x] Phase 6: Reconcile tests with the toroidal contract
- [ ] Phase 7: Validate live mode behavior

### Key Diagnosis

- The remaining edge-sticking problem was not just a rendering issue.
- The engine still had flat-board assumptions in spatial lookup, crowding, and hit/target queries.
- A true torus requires wrapped deltas everywhere once a bug is active on the field.
- Off-screen Survival burst entry remains a separate pre-entry state and should not be forced into on-board coordinates early.

## Status Summary

- Current phase: movement model updated to toroidal wrap-around, with focused engine coverage and build revalidated after replacing wall containment
- Build status: passing
- Focused engine movement tests: passing
- Siege E2E verification: passing
- Performance stress verification: passing
- Remaining work: future visual-regression baselining if the live presentation now feels stable enough to lock

## Completed

- [x] Define the movement rewrite direction and architecture
- [x] Decide on a single shared solver with archetype-specific intent rules
- [x] Decide that shared-landmark attraction, orbiting, and loiter behavior should be removed
- [x] Decide that Time Attack and Survival should share one movement architecture
- [x] Replace the main movement core in `BugEntity.update()` with an intent-driven model
- [x] Remove tangential separation swirl from local neighbor avoidance
- [x] Simplify cursor avoidance to direct repel instead of spin-prone lateral behavior
- [x] Rework crowding response to prefer dispersal and earlier retargeting
- [x] Replace wall containment with snake-style wrap-around once bugs are active on the field
- [x] Preserve engine-owned spatial queries and movement integration points
- [x] Rewrite the focused bug movement unit-test contract in `src/features/game/engine/BugEntity.test.ts`
- [x] Adjust engine telemetry expectations in `src/features/game/engine/Engine.test.ts`
- [x] Run focused validation:
  - [x] `npm test -- --run src/features/game/engine/BugEntity.test.ts src/features/game/engine/Engine.test.ts`
  - [x] `npm run build`
- [x] Enable live QA telemetry and inspect Time Attack movement in the running game
- [x] Confirm broad Time Attack spread with live telemetry and visual inspection
- [x] Validate Survival movement against the same shared solver under live wave pressure
- [x] Remove the bulk of dead legacy helper logic from the pre-rewrite movement stack
- [x] Simplify runtime movement mood handling down to the remaining `patrol` and `startled` states
- [x] Remove the last stale loiter timer field from runtime movement state
- [x] Remove stale roam-target region metadata from runtime movement state
- [x] Remove stale crawl-profile metadata from variant/config definitions
- [x] Tune the active intent and crawl-profile knobs for lower spin risk and less uniform pooling
- [x] Add variant-aware QA telemetry for live movement inspection
- [x] Compare tuned Time Attack spread against the rollback floor metrics
- [x] Recheck Time Attack click readability after the tuning pass
- [x] Tune Survival-specific spawn and pressure behavior without creating a separate movement model
- [x] Shift Survival escalation toward bounded speed, stronger variant pressure, and tighter active-bug ceilings
- [x] Add focused Survival test coverage for bounded pressure-reactive speed scaling
- [x] Re-run focused validation after the cleanup pass:
  - [x] `npm test -- --run src/features/game/engine/BugEntity.test.ts src/features/game/engine/Engine.test.ts`
  - [x] `npm run build`

## In Progress

- [ ] Decide whether to add screenshot or visual regression baselines for the stabilized live swarm look

## Remaining Plan

### 1. Behavior Contract Cleanup

- [x] Preserve core constraints: smooth motion, broad spread, wall escape, local cursor response, no hard center clumping
- [ ] Remove or retire legacy movement concepts that are no longer truly part of the design:
  - [x] extra mood-state complexity beyond the remaining runtime meaning of `patrol` and `startled`
  - [x] legacy roam-target metadata that no longer needs to exist
  - [x] stale crawl-profile metadata that no longer needs to exist
  - [x] dead helper logic that only supported the old movement stack

### 2. Time Attack Validation

- [x] Run live Time Attack and inspect opening motion
- [x] Run live Time Attack and inspect settled motion
- [x] Compare live feel against the known rollback floor
- [x] Confirm bugs still look individually directed rather than globally synchronized
- [x] Confirm click readability remains acceptable

### 3. Variant Tuning

- [x] Tune low-tier bugs as background fillers that claim space without over-pressuring
- [x] Tune medium-tier bugs as broad patrol bugs with stable coverage
- [x] Tune high-tier bugs as more focused hunters with stronger commitment
- [x] Tune urgent-tier bugs as erratic but smooth threats
- [x] Make variant differences intentional through archetype tuning instead of reintroducing complexity into the solver

### 4. Mode and Escalation Tuning

- [x] Validate Survival movement with the same core solver
- [x] Tune Survival-specific spawn and pressure behavior without creating a separate movement model
- [x] Add escalation through speed, local aggression, and spawn pressure only where it stays readable
- [x] Verify that escalation increases threat without producing chaos or spin behavior

### 5. Test Contract Expansion

- [x] Add explicit tests for banned behaviors
  - [x] no local spin loops
  - [x] no sustained wall hugging
  - [x] no synchronized spawn collapse
  - [x] no persistent podding
- [x] Keep quadrant spread and center-density validation intact
- [x] Add per-archetype expectations where they help preserve intentional differences

### 6. Broader Verification

- [x] Run the relevant E2E coverage after the next tuning pass
- [ ] Add screenshot or visual regression coverage if the live baseline stabilizes
- [x] Recheck performance assumptions for larger swarms after tuning completes

## Files Touched So Far

- `src/features/game/engine/BugEntity.ts`
- `src/features/game/engine/BugEntity.test.ts`
- `src/features/game/engine/Engine.test.ts`

## Notes

- The first pass intentionally prioritized removing bad movement mechanics over perfect per-variant feel.
- The current implementation is structurally simpler, which should make the next tuning steps easier to reason about.
- Time Attack telemetry after the cleanup pass looked healthy: 374 live bugs, center-band ratio about 0.136, max quadrant ratio about 0.267, and stable quadrant balance across repeated samples.
- Tuned Time Attack now compares favorably against the rollback floor from plan 06: count 374, center-density about 0.096 versus the rollback band of about 0.152-0.166, and quadrant counts 93/93/94/94.
- Per-variant QA telemetry is now available during live runs so future tuning can inspect spacing and speed by bug class instead of only looking at the whole swarm.
- The shared crawl-profile contract now only contains fields still used by the current solver or codex-facing UI, so the config shape matches real behavior again.
- Phase 5 added explicit regression coverage for no local spin loops, no sustained wall hugging, no synchronized spawn collapse, and no persistent podding, then tightened close-range separation enough for the new podding check to pass without reopening swirl behavior.
- Broader verification after phase 5 is now green: the siege Playwright specs passed across combat, mode switching, progression, and the existing screen-wide distribution/opening-collapse checks.
- Performance stress verification is also green after the movement hardening pass, including the nightly ambient 500/1000/5000 bug profiles, the nightly survival pressure profile at wave 25, and the 500/1000 bug render stress cases.
- Focused engine coverage now also includes a mixed-swarm archetype occupancy regression so low bugs stay more perimeter-biased while high bugs keep a more interior footprint, without requiring a separate movement model per mode.
- Follow-up tuning after live QA reduced odd border-lane tracing by rewarding inward retargets when bugs spend too long near the screen edge, and it smoothed neighbor separation enough to reduce residual local spin without reopening the podding regressions.
- Focused movement coverage now also includes regressions for edge-lane tracing and local-crowd anti-orbit behavior, with the focused suite and build both green after that tuning pass.
- Dense-swarm QA telemetry showed the remaining live spin loop was crowd-driven: broad crowd scores were saturating almost everywhere while actual close neighbors stayed low, so the solver was overreacting to diffuse occupancy rather than true local crush.
- The current crowd fix normalizes broad crowd pressure by crowd count and then restores close-range spacing pressure from actual neighbor count; the latest live 374-bug Time Attack sample dropped from near-whole-swarm suspicious loops to zero while keeping the focused anti-pod engine regression green.
- Follow-up Survival hardening found a second failure mode: medium-to-high local pressure pockets were still staying in patrol and drawing tight circles even after the broad-crowd normalization fix.
- The latest steering pass now switches those pockets into a stronger crowd-escape regime, damps patrol noise earlier, lowers heading lag under crowd pressure, and applies a modest crowd-aware separation boost.
- Live Survival wave-11 QA on the latest build improved from roughly 513 suspicious loop signatures to 315 and then to 82 in the same detector, with the remaining hits concentrated in lighter one-to-two-neighbor patrol curls rather than the earlier dense-cap cluster loops.
- The next late-wave failure mode showed up above roughly 1000 active bugs: the swarm began behaving like a broad pooled mass again even though the mid-wave fixes were helping.
- The retained fix for that case adds an active-bug-count gate so the heaviest crush-response tuning only turns on for genuinely overloaded Survival swarms instead of affecting normal engine spacing behavior.
- In the retained 1000+ bug sample, the late-wave suspicious-loop detector improved from about 1032 offenders down to about 678 at roughly 1000 active bugs; that is materially better, but still not clean enough to call finished.
- Follow-up QA showed the next visible pooling band starts earlier, around roughly 800 active bugs, where many bugs are still staying in patrol-like motion inside medium local crowd pockets.
- The latest pass widened overload-only crowd suppression and added a focused regression for that 800-1000 bug band without regressing the normal engine suite.
- Live 800-850 bug sampling remained only marginally improved after the latest threshold and startled-mood tweaks, so those last tweaks are not sufficient to declare the overload-band pooling solved.
- The latest overload pass changes the solver contract at swarm saturation: once overload-flow engages, bugs suppress soft neighbor avoidance and keep only collision-scale spacing, so they recommit to broad re-roam flow instead of curling around each other.
- The live movement model now uses toroidal wrap-around for active bugs: once a bug has entered the field, crossing the left or right edge continues on the opposite side, and the same is true for top and bottom edges.
- Survival edge-burst spawns still enter from off-screen before wrap-around activates, so pressure waves preserve their arrival/readability while active bugs keep the smoother snake-like traversal.
- Survival telemetry also looked healthy through wave 2: 437 then 464 live bugs, center-band ratio about 0.10 then 0.09, and max quadrant ratio about 0.261 then 0.254 with balanced quadrants.
- Phase 4 retuned Survival to escalate more through spawn composition and crowd pressure while keeping runtime speed bounded; focused tests now cover the pressure-reactive speed bonus directly.
- Live Survival sanity checks reached wave 12 with a visible 15.5/s spawn rate and roughly 382-430 active bugs while remaining screen-readable, which is materially stronger pressure than the opening wave without requiring a separate movement model.
- A Survival wave banner appeared to persist briefly after switching back to Time Attack during QA; that looks like a separate mode UI issue, not a movement-system regression.
- Hot-reload also surfaced an existing `AmbientBackgroundHarness` dashboard-provider error while returning to the app shell; that appears unrelated to movement work but should be cleaned up separately.
- This tracker should be updated after each meaningful movement pass so it remains the visible source of truth inside the repo.