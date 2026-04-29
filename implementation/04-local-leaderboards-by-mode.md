# Implementation Plan 04: Local Leaderboards by Game Mode

## Goal

Provide a reliable local leaderboard for each game mode, visible after runs and resilient across reloads.

## Current Gameplay Review

- `src/features/game/hooks/useSiegeRunCompletion.ts` already implements mode-specific leaderboards.
- Current storage key: `STORAGE_KEYS.siegeRunLeaderboardsV2` (`race-to-zero:siege-run-leaderboards-v2`).
- Legacy migration from `STORAGE_KEYS.siegeRunLeaderboard` already exists.
- Current shape:
  - `Record<"purge" | "outbreak", SiegeLeaderboardEntry[]>`
- Current sorting:
  - Time Attack / `purge`: fastest `elapsedMs`, then higher `bugCount`, then higher `bugsPerSecond`.
  - Survival / `outbreak`: higher `waveReached`, then higher `survivedMs`, then higher `bugCount`.
- Current max entries: 8 per mode.
- `SiegeRunCompleteOverlay.tsx` already renders the active mode’s local leaderboard.

## Proposed Design

Keep the existing storage model and sorting, then polish it into an intentional per-mode leaderboard feature.

Implementation should focus on:

1. Verifying and hardening persistence.
2. Making mode labels and scoring clearer in the modal.
3. Adding reset/export affordances only if desired.
4. Adding test coverage around migration, rank display, and per-mode isolation.

## Implementation Steps

### 1. Keep the current storage key

Continue using:

- `STORAGE_KEYS.siegeRunLeaderboardsV2`

Do not introduce a third leaderboard key unless the persisted schema changes substantially.

### 2. Harden normalization

In `normalizeLeaderboardEntry()`:

- Verify `topWeaponId` is one of the known `ALL_WEAPON_IDS` if importing it does not create a circular dependency.
- Clamp negative and invalid values, already mostly handled.
- Keep `offlineReason` only for Survival entries.
- Ensure old `purge` entries never show a stale `offlineReason`.

### 3. Improve rank semantics

Currently `rank` is computed with `findIndex() + 1`. If a new entry does not make the top 8, this becomes `0`.

Update behavior:

- Store `rank: number | null` on `SiegeCompletionSummary`, or keep `rank` numeric and add `ranked: boolean`.
- Modal copy:
  - Rank exists: “Leaderboard rank X”.
  - Rank missing: “Run saved”.
- `isNewBest` should only be true when rank is 1.

### 4. Make mode-specific score cards clear

In `SiegeRunCompleteOverlay.tsx`:

- Time Attack leaderboard row primary score:
  - Clear time.
  - Bug count.
  - Bugs/s.
- Survival leaderboard row primary score:
  - Wave reached.
  - Survival time.
  - Kills / bugs cleared.
- Keep `SIEGE_GAME_MODE_META[entry.mode].shortLabel` visible.

### 5. Optional leaderboard management UI

If desired, add a compact “Reset local leaderboard” action inside the completion overlay.

Recommended approach:

- Add `resetLeaderboardForMode(mode)` in `useSiegeRunCompletion.ts`.
- Add a guarded button with confirmation copy.
- Only clears the active mode array; leaves the other mode intact.
- Add `data-testid="siege-reset-mode-leaderboard"`.

This is optional and should not block the core feature.

### 6. Optional dashboard-accessible leaderboard

If users need to see leaderboards before completing a run:

- Add a “Local scores” panel to the game mode selector/control menu.
- It can reuse `getStoredLeaderboards()` if that helper is exported.
- Keep this as a separate follow-up if it expands scope.

## Tests

### Unit tests

- Add or extend `src/features/game/hooks/useSiegeRunCompletion.test.ts`:
  - Builds separate arrays for `purge` and `outbreak`.
  - Migrates legacy flat entries into the V2 shape.
  - Sorts Time Attack by fastest clear.
  - Sorts Survival by highest wave, then survival time.
  - Caps each mode to 8 entries independently.
  - Handles a new run that does not enter the top 8 without displaying rank 0.

### E2E tests

- Extend `tests/e2e/siege-mode.spec.ts`:
  - Complete one Time Attack run and assert leaderboard says Time Attack.
  - Trigger one Survival overrun and assert leaderboard says Survival.
  - Confirm rows from one mode do not appear in the other mode’s active leaderboard.
- Add storage seeding helpers to `tests/e2e/support/dashboardQa.ts` if current helpers do not cover local storage setup.

## Acceptance Criteria

- Each game mode has its own local leaderboard.
- Leaderboards persist across reloads using the V2 storage key.
- Legacy flat leaderboard data migrates safely.
- Time Attack and Survival rankings use their own scoring rules.
- A run that is not top 8 is still acknowledged without showing rank 0.
- Existing completion overlay remains accessible and keyboard navigable.

## Validation Commands

- `npm run typecheck`
- `npm test -- src/features/game/hooks/useSiegeRunCompletion.test.ts`
- `npm run test:e2e -- tests/e2e/siege-mode.spec.ts`
- `npm run build`