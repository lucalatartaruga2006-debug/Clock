import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
})

export interface PlayerState {
  id: number
  currency: number
  currency_cap: number
  hp_tier: number
  bell_tier: number
  shield_tier: number
  luck_tier: number
  benedizione_tier: number
}

function coerce(p: any): PlayerState {
  return {
    id: Number(p.id),
    currency: Number(p.currency),
    currency_cap: Number(p.currency_cap ?? 100000),
    hp_tier: Number(p.hp_tier),
    bell_tier: Number(p.bell_tier),
    shield_tier: Number(p.shield_tier),
    luck_tier: Number(p.luck_tier ?? 0),
    benedizione_tier: Number(p.benedizione_tier ?? 0),
  }
}

export async function loadPlayerState(): Promise<PlayerState> {
  const { data, error } = await supabase
    .from('player_state')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  if (data) return coerce(data)
  const fresh = { id: 1, currency: 0, currency_cap: 100000, hp_tier: 0, bell_tier: 0, shield_tier: 0, luck_tier: 0, benedizione_tier: 0 }
  const { data: inserted, error: insErr } = await supabase
    .from('player_state')
    .insert(fresh)
    .select()
    .maybeSingle()
  if (insErr) throw insErr
  return inserted ? coerce(inserted) : { ...fresh, currency_cap: 100000 }
}

export async function addCurrency(earned: number): Promise<PlayerState> {
  const current = await loadPlayerState()
  const newCurrency = Math.min(current.currency_cap, current.currency + earned)
  const { data, error } = await supabase
    .from('player_state')
    .update({ currency: newCurrency, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? coerce(data) : { ...current, currency: newCurrency }
}

export async function savePlayerState(s: Partial<PlayerState>): Promise<PlayerState> {
  const patch: Record<string, any> = { ...s, updated_at: new Date().toISOString() }
  if (s.currency !== undefined) {
    const cur = await loadPlayerState()
    patch.currency = Math.min(cur.currency_cap, Number(s.currency))
  }
  delete patch.currency_cap
  const { data, error } = await supabase
    .from('player_state')
    .update(patch)
    .eq('id', 1)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? coerce(data) : (await loadPlayerState())
}
