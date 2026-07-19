/*
# Add benedizione_tier column to player_state

1. Modified Tables
- `player_state`
  - Add `benedizione_tier` (integer, default 0) — permanent "Benedizione di Dio Sveglia" upgrade.
    Tier 1 (1000s): +1 extra life — revives at half HP on death.
2. Notes
- Existing rows get tier 0 via the column default.
*/

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS benedizione_tier integer NOT NULL DEFAULT 0;
