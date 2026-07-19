/*
# Add currency cap column to player_state

1. Modified Tables
- `player_state`
  - Add `currency_cap` (bigint, default 100000) — maximum currency (seconds)
    a player can accumulate. Earning beyond this is silently dropped.
2. Notes
- Existing rows get the default cap of 100000 via the column default.
- The frontend clamps currency to this cap on every save.
*/

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS currency_cap bigint NOT NULL DEFAULT 100000;
