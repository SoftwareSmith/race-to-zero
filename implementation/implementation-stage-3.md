# Implementation Stage 3: Minimal Single-Bar HUD

## Goal

Replace complex in-run UI chrome with a minimal single nav-style HUD bar that keeps the game simple, readable, and fun.

## Scope

### In scope

- Compact in-run HUD layout.
- Mode-specific stats for Time Attack and Survival.
- Stable test selectors.
- Preserve essential weapon controls.

### Out of scope

- Completion modal changes from Stage 2.
- Survival wave director implementation from Stage 4.
- Deep weapon rebalance.

## Changes Required

1. Refactor `src/features/game/components/SiegeHud.tsx` and related `siege-hud` components into a compact top or inline HUD bar.
2. Keep only high-value live stats visible:
   - Mode label.
   - Time Attack: elapsed time, bugs remaining, kills/sec or streak.
   - Survival: wave, site integrity/offline countdown bar, spawn rate, bugs alive.
   - Current weapon and compact weapon switching.
   - Exit/back control.
3. Move secondary detail into collapsible or secondary panels:
   - Codex.
   - Detailed weapon stats.
   - Long-form progression copy.
4. Add stable `data-testid` attributes for:
   - Mode stat.
   - Wave indicator.
   - Offline pressure bar.
   - Completion modal CTAs.
5. Reuse shared UI primitives where useful: `Surface`, `MenuControls`, `StatusTag`, and `Tabs`.

## Benchmarks

- HUD does not obscure the core play area at 1280×720.
- HUD updates do not create visible re-render jitter during combat.
- Critical stats are readable at a glance.

## Passing Test Requirements

- Existing Playwright game selectors updated if needed.
- E2E smoke test confirms HUD visibility in both modes.
- E2E test confirms ESC/back behavior still exits safely.
- `npm run typecheck`
- `npm test`

## Acceptance Criteria

- The game has one primary in-run nav/HUD bar.
- Players can identify current mode, objective progress, and danger state immediately.
- Survival includes wave, spawn rate, and offline-pressure display.
- Time Attack includes elapsed time and remaining bugs.
