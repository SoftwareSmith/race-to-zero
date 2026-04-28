# Implementation Stage 6: QA, Balance, and Release Readiness

## Goal

Lock the revamp with full validation, balance checks, and documentation so the dual-mode game can ship confidently.

## Scope

### In scope

- Automated regression coverage.
- Balance validation.
- Build validation.
- Accessibility basics.
- Release documentation.

### Out of scope

- New gameplay systems beyond the approved dual-mode revamp.
- Remote leaderboards.
- Nonessential cosmetic expansion.

## Changes Required

1. Add or update E2E specs:
   - Time Attack flow.
   - Survival flow.
   - Leaderboard persistence.
   - Mode switching from completion modal.
   - HUD smoke coverage.
   - Survival performance pressure.
2. Update existing game tests if selectors or HUD layout changed.
3. Run tuning passes with deterministic QA state:
   - Small Time Attack boards.
   - Medium Time Attack boards.
   - Survival waves 1, 5, 10, 15, 25, and 50.
4. Document final game rules in README or in-game help/codex copy.
5. Validate build and bundle impact.
6. Confirm accessibility basics:
   - Modal focus behavior.
   - Button names.
   - Reduced-motion tolerance where applicable.

## Benchmarks

- No TypeScript errors.
- Unit suite green.
- Core E2E game specs green.
- Build succeeds.
- No console/page errors in E2E runs.
- Completion modal keyboard navigation works.

## Passing Test Requirements

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e` or targeted Playwright game/performance specs if the full suite is too slow during iteration.

## Acceptance Criteria

- The app clearly offers Time Attack and Survival.
- Both modes can be played repeatedly.
- Both modes end in a completion modal with local leaderboard and replay/switch options.
- Survival ramps wave difficulty and can end by site offline.
- The implementation is covered by automated tests and remains performant.
