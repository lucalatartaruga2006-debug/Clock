export type PowerUpId =
  | 'lancetta-instabile' | 'batteria-maledetta' | 'eco-del-secondo'
  | 'sveglia-predatrice' | 'occhio-sul-quadrante' | 'meccanismo-corrotto'
  | 'campana-demoniaca' | 'tempo-rubato' | 'lancetta-fantasma'
  | 'cuore-a-molla' | 'sveglia-fortuna' | 'ultimo-secondo'

export interface PowerUp { id: PowerUpId; name: string; desc: string; icon: string }

export const POWER_UPS: Record<PowerUpId, PowerUp> = {
  'lancetta-instabile': { id: 'lancetta-instabile', name: 'Lancetta Instabile', desc: 'Allarga la finestra di tempo per il click perfetto. Le lancette tremano.', icon: '🌀' },
  'batteria-maledetta': { id: 'batteria-maledetta', name: 'Batteria Maledetta', desc: 'Ti permette di sbagliare un click senza morire. Senti una voce nella stanza.', icon: '🔋' },
  'eco-del-secondo': { id: 'eco-del-secondo', name: 'Eco del Secondo', desc: 'Ogni click perfetto genera un "secondo fantasma" che aiuta per pochi secondi.', icon: '👻' },
  'sveglia-predatrice': { id: 'sveglia-predatrice', name: 'Sveglia del Tempo', desc: 'Ogni 10 secondi salta 5 minuti. Ma hai il 2% di possibilità di andare indietro di 50 minuti.', icon: '⏰' },
  'occhio-sul-quadrante': { id: 'occhio-sul-quadrante', name: 'Occhio sul Quadrante', desc: 'Evita 1 attacco del boss. Un utilizzo per boss.', icon: '👁️' },
  'meccanismo-corrotto': { id: 'meccanismo-corrotto', name: 'Meccanismo della Fortuna', desc: 'Aumenta la fortuna del 20%, ma dimezza i tuoi HP massimi.', icon: '⚙️' },
  'campana-demoniaca': { id: 'campana-demoniaca', name: 'Campana Demoniaca', desc: 'Il suono della sveglia danneggia i boss: 10 hp ogni 10 secondi. L\'unico modo per danneggiare i boss.', icon: '🔔' },
  'tempo-rubato': { id: 'tempo-rubato', name: 'Super Orologio', desc: 'Ogni 45 secondi sei invulnerabile per 10 secondi.', icon: '🛡️' },
  'lancetta-fantasma': { id: 'lancetta-fantasma', name: 'Lancetta Fantasma', desc: 'Una copia della tua lancetta esegue automaticamente alcuni click.', icon: '🕰️' },
  'cuore-a-molla': { id: 'cuore-a-molla', name: 'Cuore a Molla', desc: 'Quando stai per morire, hai una seconda possibilità, ma la stanza cambia.', icon: '❤️‍🔥' },
  'sveglia-fortuna': { id: 'sveglia-fortuna', name: 'Sveglia Fortuna', desc: 'Aumenta del 10% la fortuna: probabilità di schivare ogni click sbagliato o non dato.', icon: '🍀' },
  'ultimo-secondo': { id: 'ultimo-secondo', name: 'Ultimo Secondo', desc: 'Il tempo rallenta quando rimane meno dell\'1% di vita.', icon: '⏱️' },
}

export const ALL_IDS = Object.keys(POWER_UPS) as PowerUpId[]

export function rollPowerUps(owned: PowerUpId[], n: number, force?: PowerUpId): PowerUpId[] {
  if (force) return [force]
  const pool = ALL_IDS.filter((id) => !owned.includes(id) && id !== 'campana-demoniaca')
  const out: PowerUpId[] = []
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(i, 1)[0])
  }
  return out
}
