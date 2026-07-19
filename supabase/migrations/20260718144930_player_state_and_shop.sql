/*
# Player state and shop upgrades (single-tenant, no auth)

1. New Tables
- `player_state` — single row storing the player's currency (seconds) and
  which permanent shop upgrades have been purchased.
  - `id` (int, primary key, always 1 — single-tenant singleton row)
  - `currency` (bigint, default 0) — "secondi" valuta, earned during play
  - `hp_tier` (int, default 0) — how many HP upgrades bought (0..3)
  - `bell_tier` (int, default 0) — how many bell-damage upgrades bought (0..3)
  - `shield_tier` (int, default 0) — how many shield upgrades bought (0..3)
  - `updated_at` (timestamptz)
2. Security
- Enable RLS on `player_state`.
- Allow anon + authenticated CRUD (intentionally shared single-tenant data,
  no sign-in screen).
3. Notes
- The singleton row (id=1) is created by the frontend on first load via an
  upsert. All reads/writes go through the anon key.
*/

CREATE TABLE IF NOT EXISTS player_state (
  id int PRIMARY KEY DEFAULT 1,
  currency bigint NOT NULL DEFAULT 0,
  hp_tier int NOT NULL DEFAULT 0,
  bell_tier int NOT NULL DEFAULT 0,
  shield_tier int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE player_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_player_state" ON player_state;
CREATE POLICY "anon_select_player_state" ON player_state FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_player_state" ON player_state;
CREATE POLICY "anon_insert_player_state" ON player_state FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_player_state" ON player_state;
CREATE POLICY "anon_update_player_state" ON player_state FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_player_state" ON player_state;
CREATE POLICY "anon_delete_player_state" ON player_state FOR DELETE
  TO anon, authenticated USING (true);
