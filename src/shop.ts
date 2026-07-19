export type UpgradeCategory = 'hp' | 'bell' | 'shield' | 'luck' | 'benedizione'

export interface UpgradeTier { tier: number; cost: number; effect: string; value: number }
export interface UpgradeDef { category: UpgradeCategory; name: string; icon: string; description: string; tiers: UpgradeTier[] }

export const HP_UPGRADE: UpgradeDef = {
  category: 'hp', name: 'Vita Extra', icon: '❤️',
  description: 'Aumenta gli HP massimi della sveglia. Cumulabile tra i tier.',
  tiers: [
    { tier: 1, cost: 60,    effect: '+20 HP massimi',  value: 20 },
    { tier: 2, cost: 600,   effect: '+40 HP massimi',  value: 40 },
    { tier: 3, cost: 6000,  effect: '+60 HP massimi',  value: 60 },
  ],
}
export const BELL_UPGRADE: UpgradeDef = {
  category: 'bell', name: 'Campana Potente', icon: '🔔',
  description: 'Aumenta il danno della Campana Demoniaca ai boss (ogni 10 secondi). Cumulabile tra i tier.',
  tiers: [
    { tier: 1, cost: 120,   effect: '+5 danno campana',  value: 5 },
    { tier: 2, cost: 1200,  effect: '+5 danno campana',  value: 5 },
    { tier: 3, cost: 12000, effect: '+10 danno campana', value: 10 },
  ],
}
export const SHIELD_UPGRADE: UpgradeDef = {
  category: 'shield', name: 'Scudo Extra', icon: '🛡️',
  description: 'Aggiungi cariche alla Batteria Maledetta (scudo contro i miss). Cumulabile.',
  tiers: [
    { tier: 1, cost: 180,  effect: '+1 scudo', value: 1 },
    { tier: 2, cost: 360,  effect: '+1 scudo', value: 1 },
    { tier: 3, cost: 3600, effect: '+1 scudo', value: 1 },
  ],
}
export const LUCK_UPGRADE: UpgradeDef = {
  category: 'luck', name: 'Fortuna', icon: '🍀',
  description: 'Aumenta permanentemente la fortuna: probabilità di schivare ogni click sbagliato o non dato. Cumulabile tra i tier.',
  tiers: [
    { tier: 1, cost: 7,   effect: '+1% fortuna',  value: 1 },
    { tier: 2, cost: 77,  effect: '+2% fortuna',  value: 2 },
    { tier: 3, cost: 777, effect: '+4% fortuna', value: 4 },
  ],
}
export const BENEDIZIONE_UPGRADE: UpgradeDef = {
  category: 'benedizione', name: 'Benedizione di Dio Sveglia', icon: '✨',
  description: 'Aggiungi una vita extra: dopo la morte, ti riporta a metà vita. Cumulabile tra i tier.',
  tiers: [
    { tier: 1, cost: 1000, effect: '+1 vita extra (revive a 50% HP)', value: 1 },
    { tier: 2, cost: 5000, effect: '+1 vita extra (revive a 50% HP)', value: 1 },
    { tier: 3, cost: 25000, effect: '+1 vita extra (revive a 50% HP)', value: 1 },
  ],
}
export const ALL_UPGRADES: UpgradeDef[] = [HP_UPGRADE, BELL_UPGRADE, SHIELD_UPGRADE, LUCK_UPGRADE, BENEDIZIONE_UPGRADE]

export function computeStats(hpTier: number, bellTier: number, shieldTier: number, luckTier: number, benedizioneTier: number) {
  const maxHpBonus = HP_UPGRADE.tiers.slice(0, hpTier).reduce((s, t) => s + t.value, 0)
  const bellBonus = BELL_UPGRADE.tiers.slice(0, bellTier).reduce((s, t) => s + t.value, 0)
  const shieldCharges = SHIELD_UPGRADE.tiers.slice(0, shieldTier).reduce((s, t) => s + t.value, 0)
  const luckBonus = LUCK_UPGRADE.tiers.slice(0, luckTier).reduce((s, t) => s + t.value, 0)
  const extraLives = BENEDIZIONE_UPGRADE.tiers.slice(0, benedizioneTier).reduce((s, t) => s + t.value, 0)
  return { maxHpBonus, bellBonus, shieldCharges, luckBonus, extraLives }
}
