# Implementation Stage 2: Completion Modal and Local Leaderboards

## Goal

At the end of each run, show a focused completion modal with the current result, a local leaderboard, and clear actions to play again, switch mode, or return to the dashboard.

## Scope

### In scope

- Per-mode local leaderboard storage and sorting.
- Mode-specific result summaries.
- Replay and switch-mode CTAs.
- Current-run highlighting.
- Safe localStorage parsing and migration.

### Out of scope

- Survival wave tuning beyond data needed to record a run.
- Optional player initials or remote leaderboards.
- Major HUD redesign, covered in Stage 3.

## Changes Required

1. Extend `src/features/game/hooks/useSiegeRunCompletion.ts` so leaderboards are explicitly per-mode.
2. Sort leaderboards by mode-specific rules:
   - Time Attack: fastest completed clear first; tie-break by larger bug count, then newer completion.
   - Survival: highest wave first; tie-break by survival duration, bugs killed, then newer completion.
3. Keep storage versioned in `src/constants/storageKeys.ts`.
4. Update `src/features/game/components/SiegeRunCompleteOverlay.tsx`:
   - Time Attack summary: clear time, bugs cleared, bugs/sec, rank.
   - Survival summary: wave reached, survived duration, kills, offline reason.
   - Actions: replay current mode, try alternate mode, back to dashboard.
5. Highlight the current run in the leaderboard.
6. Make malformed localStorage data recover safely.

## Benchmarks

- Completion modal appears within 300 ms after the last Time Attack bug is cleared.
- Completion modal appears within 300 ms after Survival reaches site offline.
- Leaderboard operations remain instant for at least 100 historical entries before trimming.

## Passing Test Requirements

- Unit tests for leaderboard sorting and trimming.
- Unit tests for malformed storage fallback.
- E2E test for completing a small Time Attack run and seeing the modal.
- E2E test for triggering Survival game over and seeing the modal.
- `npm run typecheck`
- `npm test`

## Acceptance Criteria

- Time Attack leaderboard is sorted by fastest time.
- Survival leaderboard is sorted by best survival performance.
- Replay and switch-mode buttons work from the modal.
- Leaderboard persists after page reload.
- Bad localStorage data does not crash the game.
