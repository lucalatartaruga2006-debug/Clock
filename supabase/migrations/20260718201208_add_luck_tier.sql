/*
# Add luck_tier column to player_state

1. Modified Tables
- `player_state`
  - Add `luck_tier` (integer, default 0) — permanent luck upgrade tier.
    Luck gives a chance to dodge missed clicks / failed clicks.
    Tier 1 (7s):   +1% luck
    Tier 2 (77s):  +2% luck (cumulative)
    Tier 3 (777s): +4% luck (cumulative)
2. Notes
- Existing rows get tier 0 via the column default.
- The frontend adds the base 10% from the "Sveglia Fortuna" power-up
  to the permanent luck from this column.
*/

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS luck_tier integer NOT NULL DEFAULT 0;
