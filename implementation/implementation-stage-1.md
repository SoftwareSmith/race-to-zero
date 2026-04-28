# Implementation Stage 1: Mode Foundation

## Goal

Establish the game around two clear player-facing modes while preserving the existing internal mode IDs where practical:

- **Time Attack** (`purge`): clear all spawned bugs as quickly as possible.
- **Survival** (`outbreak`): survive escalating pressure for as long as possible.

This stage should make mode identity, mode lifecycle, and tier-cap behavior stable before adding the larger Survival wave and leaderboard changes.

## Scope

### In scope

- Rename mode labels and descriptions in player-facing UI.
- Keep internal `SiegeGameMode` values as `purge` and `outbreak` to avoid unnecessary churn.
- Add richer mode metadata for objective, scoring, and CTA copy.
- Ensure new mode sessions start cleanly.
- Enforce active-mode weapon tier caps in the engine and UI snapshots.
- Add focused tests for the foundation behavior.

### Out of scope

- Full completion modal redesign.
- Survival wave director rewrite.
- Offline pressure bar.
- Spawn-edge physics tuning.
- Final balance pass.

## Changes Required

1. Update `SIEGE_GAME_MODE_META` in `src/features/game/types.ts`:
   - `purge.label` should become `Time Attack`.
   - `outbreak.label` should become `Survival`.
   - Add concise metadata for objective, scoring label, replay CTA, and switch CTA.
2. Update mode lifecycle in `src/features/game/hooks/useSiegeGame.ts`:
   - Starting a mode should reset runtime state.
   - Starting a different mode should not carry stale completion state.
   - Time Attack remains the default entry mode.
3. Enforce weapon tier caps:
   - Time Attack caps at `WeaponTier.TIER_THREE`.
   - Survival caps at `WeaponTier.TIER_FIVE`.
   - Engine evolution must stop at the configured cap.
   - HUD weapon snapshots should report the active mode cap.
4. Wire the active mode cap through the rendering/game engine path:
   - `SiegeExperience` → `BackgroundField` → `BugCanvas` → `Engine`.
5. Add tests:
   - Mode metadata labels and descriptions.
   - Engine tier-cap enforcement.
   - Mode-specific weapon snapshot max tier.
   - `useSiegeGame` clean session reset when switching modes.

## Benchmarks

- Starting or switching modes creates a playable run within 500 ms before the normal entering animation completes.
- No stale completion summary survives into a new run.
- No stale kill, point, streak, timer, or selected weapon state survives into a new run.
- Engine does not emit evolution events above the active mode cap.

## Passing Test Requirements

- `npm run typecheck`
- `npm test`
- Existing Playwright game smoke tests should remain compatible.
- Focused unit tests for mode metadata, tier caps, and mode reset behavior must pass.

## Acceptance Criteria

- The UI consistently presents **Time Attack** and **Survival**.
- Time Attack objective is immediately understandable: clear bugs as fast as possible.
- Survival objective is immediately understandable: survive escalating waves and site pressure.
- Time Attack cannot evolve weapons beyond tier 3.
- Survival can support weapon progression up to tier 5 when thresholds exist.
- Switching modes starts a fresh run with no stale state.
