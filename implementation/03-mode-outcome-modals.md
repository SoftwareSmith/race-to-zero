# Implementation Plan 03: Mode Outcome Modals

## Goal

Ensure a clear modal appears when:

1. All bugs are destroyed in Time Attack.
2. Bugs overrun/win in Survival.

The modal should communicate the outcome, save the run, and offer replay, mode switch, and return-to-dashboard actions.

## Current Gameplay Review

- `src/features/game/components/SiegeRunCompleteOverlay.tsx` already renders an accessible modal with focus management, actions, summary cards, and a local leaderboard.
- `src/features/game/hooks/useSiegeRunCompletion.ts` already creates `completionSummary` and persists leaderboard entries.
- Time Attack completion condition already exists:
  - `gameMode === "purge" && interactiveRemainingBugs === 0`
- Survival defeat condition already exists:
  - `gameMode === "outbreak" && siteOffline === true`
  - `siteOffline` is passed from `useSiegeGame` as `survivalStatus.siteIntegrity <= 0`.
- Survival offline reason is currently generated as `Site offline at wave ${wave}`.
- `SiegeExperience.tsx` renders `SiegeRunCompleteOverlay` when `interactiveMode && completionSummary`.
- A known runtime gotcha from repo memory: the startup fallback for `remainingBugs` must stay scoped to `siegePhase === "entering"`; otherwise true zero-bug states can be masked and completion overlays will not open.

## Proposed Design

Keep the existing overlay component, but make outcomes explicit and harder to regress.

Add an outcome type to the completion summary:

- `"timeAttackCleared"`
- `"survivalOverrun"`

Use this type for title, tone, confetti/danger styling, summary copy, and test assertions.

## Implementation Steps

### 1. Add outcome metadata

In `useSiegeRunCompletion.ts`:

- Add type:
  - `export type SiegeCompletionOutcome = "timeAttackCleared" | "survivalOverrun"`
- Add `outcome: SiegeCompletionOutcome` to `SiegeCompletionSummary`.
- Optionally add `victory: boolean` if styling needs a simple boolean.
- Set:
  - Time Attack: `outcome = "timeAttackCleared"`
  - Survival: `outcome = "survivalOverrun"`

Do not add `outcome` to persisted leaderboard entries unless needed; it is derivable from mode for the current two modes.

### 2. Fix zero-bug fallback if needed

Review `effectiveInteractiveRemainingBugs` in `useSiegeGame.ts`.

Current code falls back to `sessionBugCount` whenever:

- interactive mode is active,
- kills are 0,
- runtime remaining bugs are 0.

Adjust it to only do this during `siegePhase === "entering"` so a real zero-bug active state can complete.

Expected logic:

- During entering: use fallback to prevent momentary zero before the engine reports live count.
- During active/exiting: trust `runtimeRemainingBugs`, including zero.

### 3. Refine overlay copy and tone

In `SiegeRunCompleteOverlay.tsx`:

- Use `completionSummary.outcome` to derive:
  - Eyebrow text.
  - Main title.
  - Summary paragraph.
  - Primary stat labels.
  - Backdrop/accent tone.
- Suggested copy:
  - Time Attack title: “Swarm cleared. Time recorded.”
  - Survival title: “Site overrun. Survival score saved.”
  - Survival summary should say the bugs overwhelmed the site at the saved wave/time.
- Tone:
  - Time Attack: emerald/sky celebratory confetti.
  - Survival defeat: red/amber warning glow, fewer/no confetti pieces, but still “score saved.”

### 4. Preserve leaderboard write path

- Keep both outcomes saving local scores.
- Time Attack ranks by fastest clear.
- Survival ranks by wave reached, then survived time.
- If `rank` is `0` because the entry fell outside top 8, display “Run saved” instead of “Leaderboard rank 0”.

### 5. Add clear E2E hooks

Add or verify test ids:

- `siege-complete-overlay`
- `siege-complete-title`
- `siege-complete-outcome`
- `siege-complete-replay`
- `siege-complete-switch-mode`
- `siege-complete-back-dashboard`

The overlay already has most of these. Add only missing test ids.

## Tests

### Unit tests

- Update `src/features/game/hooks/useSiegeRunCompletion.test.ts`:
  - Time Attack zero remaining bugs produces `timeAttackCleared` summary.
  - Survival site offline produces `survivalOverrun` summary.
  - Rank handling works when the run is in or outside top entries.
  - Leaderboard writes still use `STORAGE_KEYS.siegeRunLeaderboardsV2`.

### E2E tests

- Extend `tests/e2e/siege-mode.spec.ts`:
  - Start Time Attack, use debug kill-all, assert modal title and summary are Time Attack clear.
  - Start Survival, use QA `setSurvivalState({ siteIntegrity: 0 })`, assert modal title and summary are Survival overrun.
  - Verify Escape and focus trap behavior still work.
- Extend `tests/e2e/siege-progression.spec.ts` only if weapon progression summary is affected.

## Acceptance Criteria

- Clearing all bugs in Time Attack reliably opens the completion modal.
- Survival site offline reliably opens a “bugs won / site overrun” modal.
- The two outcomes have distinct copy and visual tone.
- Both outcomes save a leaderboard entry and expose replay/mode-switch/dashboard actions.
- The entering-phase remaining-bug fallback cannot mask real zero-bug completion.

## Validation Commands

- `npm run typecheck`
- `npm test -- src/features/game/hooks/useSiegeRunCompletion.test.ts src/features/game/hooks/useSiegeGame.test.ts`
- `npm run test:e2e -- tests/e2e/siege-mode.spec.ts`
- `npm run build`