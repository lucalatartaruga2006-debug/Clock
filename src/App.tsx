import { useEffect, useRef, useState, useCallback } from 'react'
import { drawRoom } from './room'
import { POWER_UPS, rollPowerUps, type PowerUpId } from './powerups'
import { ALL_UPGRADES, computeStats, type UpgradeCategory, type UpgradeDef } from './shop'
import {
  initAudio, resumeAudio, playTick, playFakeTick, playClick, playDamage,
  playAlarmBuzz, playBell, playWhisper, playPowerup, playGameOver,
  playPurchase, playError, playSlowBreath, playFastBreath, playScream, playMerchant, playDodge, playLuckDodge, playRevive,
} from './audio'
import { loadPlayerState, addCurrency, savePlayerState, type PlayerState } from './supabase'

type Phase = 'menu' | 'shop' | 'playing' | 'powerup' | 'boss' | 'merchant' | 'gameover' | 'win'
type BossType = 'ticchettio' | 'proprietario' | null
type BreathPhase = 'slow' | 'fast' | 'none'

const BASE_MAX_HP = 100
const TOTAL_HOURS = 12
const BOSS_HOURS = [3, 6, 9, 12]
const BOSS_HP = 100
const DAMAGE_PER_MISS = 10
const SECOND_MS = 1000
const PERFECT_WINDOW = 100
const MERCHANT_COST = 100
const MERCHANT_CHANCE = 0.35

interface GameState {
  hp: number; maxHp: number; hour: number; minute: number; phase: Phase
  owned: PowerUpId[]; batteryShields: number; cuoreUsed: boolean
  tempoRubatoAvailable: boolean; tempoRubatoActive: boolean; tempoRubatoEnd: number
  ghostSeconds: number; ghostSecondsEnd: number; bossHp: number; bossBellTick: number
  fakeSecondActive: boolean; lightOn: boolean; flickerUntil: number
  perfectWindow: number; secondStart: number
  lastClickBeat: number
  horrorEvents: number; bossName?: string; bossType: BossType
  alarmVibrateUntil: number
  runCurrency: number
  bellBonus: number
  breathPhase: BreathPhase
  breathCount: number
  breathIntensity: number
  lastBreathSound: number
  breathTimeScale: number
  merchantHeart: boolean
  merchantShield: boolean
  merchantPowerup: PowerUpId | null
  occhioAvailable: boolean
  occhioArmed: boolean
  luckPercent: number
  // Benedizione di Dio Sveglia: extra lives from the shop. On death, revive at half HP.
  extraLives: number
}

function makeInitial(maxHp: number, bellBonus: number, shieldCharges: number, luckBonus: number, extraLives: number): GameState {
  return {
    hp: maxHp, maxHp, hour: 1, minute: 0, phase: 'menu', owned: [],
    batteryShields: shieldCharges, cuoreUsed: false, tempoRubatoAvailable: false,
    tempoRubatoActive: false, tempoRubatoEnd: 0, ghostSeconds: 0, ghostSecondsEnd: 0,
    bossHp: BOSS_HP, bossBellTick: 0, fakeSecondActive: false, lightOn: true,
    flickerUntil: 0, perfectWindow: PERFECT_WINDOW, secondStart: 0, lastClickBeat: -1, horrorEvents: 0,
    alarmVibrateUntil: 0, runCurrency: 0, bellBonus,
    bossType: null, bossName: undefined,
    breathPhase: 'none', breathCount: 0, breathIntensity: 0, lastBreathSound: 0, breathTimeScale: 1,
    merchantHeart: false, merchantShield: false, merchantPowerup: null,
    occhioAvailable: false, occhioArmed: false,
    luckPercent: luckBonus,
    extraLives,
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(makeInitial(BASE_MAX_HP, 0, 0, 0, 0))
  const rafRef = useRef<number>(0)
  const [phase, setPhase] = useState<Phase>('menu')
  const [hp, setHp] = useState(BASE_MAX_HP)
  const [maxHp, setMaxHp] = useState(BASE_MAX_HP)
  const [hour, setHour] = useState(1)
  const [minute, setMinute] = useState(0)
  const [owned, setOwned] = useState<PowerUpId[]>([])
  const [powerupChoices, setPowerupChoices] = useState<PowerUpId[]>([])
  const [bossHp, setBossHp] = useState(BOSS_HP)
  const [bossName, setBossName] = useState<string>('')
  const [feedback, setFeedback] = useState<string>('')
  const [lastPerfect, setLastPerfect] = useState<boolean | null>(null)
  const [slowMo, setSlowMo] = useState(false)
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('none')
  const [merchantState, setMerchantState] = useState<{ heart: boolean; shield: boolean; powerup: PowerUpId | null }>({ heart: false, shield: false, powerup: null })
  const [occhioArmed, setOcchioArmed] = useState(false)
  const [luckPercent, setLuckPercent] = useState(0)
  const [extraLives, setExtraLives] = useState(0)

  const [player, setPlayer] = useState<PlayerState | null>(null)
  const [playerLoading, setPlayerLoading] = useState(true)
  const [shopError, setShopError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await loadPlayerState()
        if (!cancelled) { setPlayer(p); setPlayerLoading(false) }
      } catch {
        if (!cancelled) { setShopError('Impossibile caricare i dati.'); setPlayerLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const derived = player ? computeStats(player.hp_tier, player.bell_tier, player.shield_tier, player.luck_tier, player.benedizione_tier) : null

  const syncUI = useCallback(() => {
    const s = stateRef.current
    setHp(Math.max(0, Math.round(s.hp)))
    setMaxHp(s.maxHp)
    setHour(s.hour); setMinute(s.minute); setOwned([...s.owned])
    setBossHp(Math.max(0, Math.round(s.bossHp)))
    setPhase(s.phase); setBossName(s.bossName ?? '')
    setSlowMo(s.tempoRubatoActive)
    setBreathPhase(s.breathPhase)
    setMerchantState({ heart: s.merchantHeart, shield: s.merchantShield, powerup: s.merchantPowerup })
    setOcchioArmed(s.occhioArmed)
    setLuckPercent(s.luckPercent)
    setExtraLives(s.extraLives)
  }, [])

  const flash = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(''), 1800) }

  const tryLuckDodge = useCallback((): boolean => {
    const s = stateRef.current
    if (s.luckPercent <= 0) return false
    const roll = Math.random() * 100
    if (roll < s.luckPercent) {
      playLuckDodge()
      flash('🍀 Fortuna! Click sbagliato schivato. (' + s.luckPercent + '%)')
      return true
    }
    return false
  }, [])

  const registerMiss = useCallback(() => {
    const s = stateRef.current
    if (s.occhioArmed) {
      s.occhioArmed = false; s.occhioAvailable = false
      playDodge(); flash('Occhio sul Quadrante: attacco schivato!'); syncUI(); return
    }
    if (tryLuckDodge()) { syncUI(); return }
    if (s.batteryShields > 0) {
      s.batteryShields--; playWhisper()
      flash('Scudo consumato! ' + s.batteryShields + ' scudi rimasti.'); syncUI(); return
    }
    s.hp = Math.max(0, s.hp - DAMAGE_PER_MISS)
    playDamage(); setLastPerfect(false); syncUI()
    if (s.hp <= 0) handleDeath()
  }, [syncUI, tryLuckDodge])

  // Handle death: check for extra lives (Benedizione di Dio Sveglia from shop)
  // and Cuore a Molla power-up before declaring game over.
  const handleDeath = useCallback(() => {
    const s = stateRef.current
    // Benedizione di Dio Sveglia: revive at half HP, consume one extra life.
    if (s.extraLives > 0) {
      s.extraLives--
      s.hp = Math.floor(s.maxHp / 2)
      s.lightOn = false
      playRevive()
      flash('✨ Benedizione di Dio Sveglia! Revivi a ' + s.hp + ' HP. (' + s.extraLives + ' vite rimaste)')
      setTimeout(() => { s.lightOn = true; syncUI() }, 1500)
      syncUI()
      return
    }
    // Cuore a Molla power-up: one-time second chance.
    if (s.owned.includes('cuore-a-molla') && !s.cuoreUsed) {
      s.cuoreUsed = true; s.hp = 35; s.lightOn = false
      playRevive()
      flash('Cuore a Molla: seconda possibilità. La stanza cambia...')
      setTimeout(() => { s.lightOn = true; syncUI() }, 2000); syncUI()
      return
    }
    gameOver()
  }, [syncUI])

  const gameOver = useCallback(() => {
    const s = stateRef.current
    s.phase = 'gameover'
    playScream()
    setTimeout(() => playGameOver(), 300)
    if (s.runCurrency > 0) {
      addCurrency(s.runCurrency).then((p) => setPlayer(p)).catch(() => {})
    }
    syncUI()
  }, [syncUI])

  const win = useCallback(() => {
    const s = stateRef.current
    s.phase = 'win'; playPowerup()
    if (s.runCurrency > 0) {
      addCurrency(s.runCurrency).then((p) => setPlayer(p)).catch(() => {})
    }
    syncUI()
  }, [syncUI])

  const updateBreathPhase = useCallback(() => {
    const s = stateRef.current
    if (s.bossType !== 'proprietario') return
    const hpRatio = s.hp / s.maxHp
    let newPhase: BreathPhase = 'slow'
    let newScale = 2
    if (hpRatio <= 0.30) { newPhase = 'slow'; newScale = 2 }
    else if (hpRatio <= 0.70) { newPhase = 'fast'; newScale = 0.5 }
    else { newPhase = 'slow'; newScale = 2 }

    if (newPhase !== s.breathPhase) {
      s.breathPhase = newPhase
      s.breathTimeScale = newScale
      s.breathCount = Math.min(3, s.breathCount + 1)
      s.breathIntensity = 1
      flash('Respiro ' + (newPhase === 'slow' ? 'lento' : 'veloce') + '! (' + s.breathCount + '/3)')
    }
  }, [])

  useEffect(() => {
    if (phase === 'menu' || phase === 'gameover' || phase === 'win' || phase === 'shop' || phase === 'merchant') return
    let lastSecond = -1
    let lastHalfSecond = -1
    const loop = () => {
      const s = stateRef.current
      if (s.phase !== 'playing' && s.phase !== 'boss') { render(); rafRef.current = requestAnimationFrame(loop); return }
      const now = performance.now()

      // During boss fights, the clock does NOT advance — time is frozen.
      // The player must survive the boss without the seconds ticking forward.
      // Bosses can ONLY be damaged by the Campana Demoniaca power-up
      // (10 HP every 10 seconds). Clicks do NOT damage the boss — they only
      // keep you alive (missed clicks hurt you, perfect clicks do nothing to the boss).
      if (s.phase === 'boss') {
        if (s.bossType === 'proprietario' && s.breathPhase !== 'none') {
          const breathInterval = s.breathPhase === 'slow' ? 2200 : 700
          if (now - s.lastBreathSound > breathInterval) {
            s.lastBreathSound = now
            if (s.breathPhase === 'slow') playSlowBreath()
            else playFastBreath()
          }
          updateBreathPhase()
        }
        const halfSec = Math.floor(now / 500)
        if (s.bossType === 'ticchettio' && halfSec !== lastHalfSecond) {
          if (halfSec % 2 === 1 && lastHalfSecond >= 0) {
            s.fakeSecondActive = true
            playFakeTick()
            setTimeout(() => { stateRef.current.fakeSecondActive = false }, 500)
          }
          lastHalfSecond = halfSec
        }
        let bossBeatInterval = SECOND_MS
        if (s.bossType === 'proprietario') bossBeatInterval = SECOND_MS * s.breathTimeScale
        const bossElapsed = now - s.secondStart
        const bossBeat = Math.floor(bossElapsed / bossBeatInterval)
        if (bossBeat !== lastSecond) {
          if (lastSecond >= 0 && s.lastClickBeat < lastSecond) registerMiss()
          lastSecond = bossBeat
          playTick(bossBeat % 4 === 0)
          // Campana Demoniaca: the ONLY way to damage the boss. 10 HP every 10 seconds.
          if (s.owned.includes('campana-demoniaca')) {
            s.bossBellTick++
            if (s.bossBellTick % 10 === 0) {
              const dmg = 10 + s.bellBonus
              s.bossHp -= dmg; playBell(); flash('La Campana Demoniaca colpisce! -' + dmg); syncUI()
            }
          }
        }
        if (s.bossHp <= 0) {
          s.phase = 'playing'; s.lightOn = true; s.flickerUntil = 0
          s.bossType = null; s.breathPhase = 'none'; s.breathTimeScale = 1
          s.occhioAvailable = false; s.occhioArmed = false
          s.secondStart = now; s.lastClickBeat = -1
          flash('Hai sconfitto ' + (s.bossName ?? '') + '!'); playPowerup(); syncUI()
        }
        render()
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // Normal play: the clock advances.
      let timeScale = 1
      if (s.tempoRubatoActive && now < s.tempoRubatoEnd) timeScale = 0.4
      if (s.owned.includes('ultimo-secondo') && s.hp < s.maxHp * 0.01) timeScale = Math.min(timeScale, 0.5)
      const elapsed = (now - s.secondStart) * timeScale
      const currentBeat = Math.floor(elapsed / SECOND_MS)

      if (currentBeat !== lastSecond) {
        if (lastSecond >= 0 && s.lastClickBeat < lastSecond) registerMiss()
        lastSecond = currentBeat
        playTick(currentBeat % 4 === 0)
        if (s.ghostSeconds > 0 && now < s.ghostSecondsEnd) handleAutoClick()
        if (s.owned.includes('lancetta-fantasma') && Math.random() < 0.3) handleAutoClick()
        const horrorChance = s.owned.includes('meccanismo-corrotto') ? 0.08 : 0.03
        if (Math.random() < horrorChance) triggerHorrorEvent()
        if (s.minute >= 60) { s.minute -= 60; onHourRollover() }
      }

      if (s.tempoRubatoActive && now >= s.tempoRubatoEnd) {
        s.tempoRubatoActive = false; syncUI()
      }

      render()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const render = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const s = stateRef.current
    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth, H = canvas.clientHeight
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawRoom(ctx, {
      hp: s.hp, maxHp: s.maxHp, hour: s.hour, minute: s.minute,
      bossActive: s.phase === 'boss', bossHp: s.bossHp, bossMaxHp: BOSS_HP,
      lightOn: s.lightOn, flicker: performance.now() < s.flickerUntil,
      owned: s.owned, ghostSecond: s.ghostSeconds,
      shake: s.hp < 25 || s.phase === 'boss',
      crackIntensity: s.hp < 30 ? 1 - s.hp / 30 : 0,
      bossName: s.bossName, fakeSecondActive: s.fakeSecondActive,
      alarmVibrate: performance.now() < s.alarmVibrateUntil,
      proprietarioActive: s.bossType === 'proprietario',
      breathPhase: s.breathPhase, breathIntensity: s.breathIntensity,
      merchantActive: s.phase === 'merchant',
    }, W, H)
  }

  const handleAutoClick = () => {
    const s = stateRef.current
    const now = performance.now()
    const elapsed = now - s.secondStart
    const beat = Math.round(elapsed / SECOND_MS)
    s.lastClickBeat = Math.max(s.lastClickBeat, beat)
    s.minute++; s.runCurrency++
    if (s.owned.includes('eco-del-secondo')) { s.ghostSeconds++; s.ghostSecondsEnd = now + 3000 }
    if (s.minute >= 60) { s.minute -= 60; onHourRollover() }
    syncUI()
  }

  const onCanvasClick = () => {
    resumeAudio()
    const s = stateRef.current
    if (s.phase !== 'playing' && s.phase !== 'boss') return
    const now = performance.now()

    // During boss fights, clicks keep you alive but do NOT damage the boss.
    // The boss can only be damaged by the Campana Demoniaca power-up.
    if (s.phase === 'boss') {
      let bossBeatInterval = SECOND_MS
      if (s.bossType === 'proprietario') bossBeatInterval = SECOND_MS * s.breathTimeScale
      const bossElapsed = now - s.secondStart
      const nearestBeat = Math.round(bossElapsed / bossBeatInterval)
      const offset = Math.abs(bossElapsed - nearestBeat * bossBeatInterval)
      s.lastClickBeat = Math.max(s.lastClickBeat, nearestBeat)

      if (offset <= s.perfectWindow) {
        // Perfect click: no boss damage, just survival feedback.
        playClick(true); setLastPerfect(true)
        flash('Click perfetto — ma il boss non subisce danni dal tocco!')
      } else if (offset > s.perfectWindow * 2) {
        playClick(false); setLastPerfect(false)
        registerMiss()
      } else {
        playClick(false); setLastPerfect(null)
      }
      return
    }

    // Normal play: evaluate against the advancing clock.
    let timeScale = 1
    if (s.tempoRubatoActive && now < s.tempoRubatoEnd) timeScale = 0.4
    if (s.owned.includes('ultimo-secondo') && s.hp < s.maxHp * 0.01) timeScale = Math.min(timeScale, 0.5)
    const elapsed = (now - s.secondStart) * timeScale

    const nearestTick = Math.round(elapsed / SECOND_MS)
    const offset = Math.abs(elapsed - nearestTick * SECOND_MS)
    s.lastClickBeat = Math.max(s.lastClickBeat, nearestTick)

    if (offset <= s.perfectWindow) {
      s.minute++; s.runCurrency++
      if (s.minute >= 60) { s.minute -= 60; onHourRollover() }
      playClick(true); setLastPerfect(true)
      if (s.owned.includes('eco-del-secondo')) { s.ghostSeconds++; s.ghostSecondsEnd = now + 3000 }
      if (s.owned.includes('sveglia-predatrice') && s.hp < 40) { s.hp = Math.min(s.maxHp, s.hp + 0.5) }
      syncUI()
    } else if (offset > s.perfectWindow * 2) {
      playClick(false); setLastPerfect(false)
      registerMiss()
    } else {
      s.minute++; s.runCurrency++
      if (s.minute >= 60) { s.minute -= 60; onHourRollover() }
      playClick(false); setLastPerfect(null)
      syncUI()
    }
  }

  const triggerHorrorEvent = () => {
    const s = stateRef.current; s.horrorEvents++
    const r = Math.random()
    if (r < 0.4) s.flickerUntil = performance.now() + 800
    else if (r < 0.7) { s.lightOn = false; setTimeout(() => { s.lightOn = true; syncUI() }, 1200) }
    else playWhisper()
    syncUI()
  }

  const onHourRollover = () => {
    const s = stateRef.current; s.hour++
    if (s.hour > TOTAL_HOURS) { win(); return }
    if (s.owned.includes('tempo-rubato')) s.tempoRubatoAvailable = true
    if (BOSS_HOURS.includes(s.hour)) startBoss()
    else if (Math.random() < MERCHANT_CHANCE) startMerchant()
    else {
      if (s.hour === 2) setPowerupChoices(rollPowerUps(s.owned, 3, 'campana-demoniaca'))
      else setPowerupChoices(rollPowerUps(s.owned, 3))
      s.phase = 'powerup'; playPowerup(); syncUI()
    }
  }

  const startBoss = () => {
    const s = stateRef.current
    s.phase = 'boss'; s.bossHp = BOSS_HP; s.bossBellTick = 0
    s.secondStart = performance.now(); s.lastClickBeat = -1
    if (s.owned.includes('occhio-sul-quadrante')) s.occhioAvailable = true
    s.occhioArmed = false
    if (s.hour === 6) {
      s.bossType = 'proprietario'
      s.bossName = 'Il Proprietario della Stanza'
      s.lightOn = false
      s.breathPhase = 'slow'; s.breathTimeScale = 2; s.breathCount = 1; s.breathIntensity = 1
      s.lastBreathSound = performance.now()
      playSlowBreath()
      flash('BOSS: ' + s.bossName + ' — la luce si spegne. Respira...')
    } else {
      s.bossType = 'ticchettio'
      s.bossName = 'Il Ticchettio'
      s.lightOn = false
      s.alarmVibrateUntil = performance.now() + 2500
      setTimeout(() => { s.lightOn = true; syncUI() }, 600)
      s.flickerUntil = performance.now() + 2000
      playAlarmBuzz(2.5)
      flash('BOSS: ' + s.bossName + ' — non farti ingannare dal ritmo falso!')
    }
    if (!s.owned.includes('campana-demoniaca')) {
      setTimeout(() => flash('⚠️ Senza Campana Demoniaca non puoi danneggiare il boss!'), 2600)
    }
    syncUI()
  }

  const startMerchant = () => {
    const s = stateRef.current
    s.phase = 'merchant'
    s.merchantHeart = true
    s.merchantShield = true
    s.merchantPowerup = rollPowerUps(s.owned, 1)[0] ?? null
    playMerchant()
    flash("Un'ombra mercante è apparsa...")
    syncUI()
  }

  const buyMerchantHeart = () => {
    const s = stateRef.current
    if (!s.merchantHeart || (player?.currency ?? 0) < MERCHANT_COST) { playError(); return }
    s.hp = Math.min(s.maxHp, s.hp + 100)
    s.merchantHeart = false
    addCurrency(-MERCHANT_COST).then((p) => setPlayer(p)).catch(() => {})
    playPurchase(); flash('Cuore: +100 HP (solo questa run)'); syncUI()
  }

  const buyMerchantShield = () => {
    const s = stateRef.current
    if (!s.merchantShield || (player?.currency ?? 0) < MERCHANT_COST) { playError(); return }
    s.batteryShields += 1
    s.merchantShield = false
    addCurrency(-MERCHANT_COST).then((p) => setPlayer(p)).catch(() => {})
    playPurchase(); flash('Scudo: +1 scudo (solo questa run)'); syncUI()
  }

  const buyMerchantPowerup = () => {
    const s = stateRef.current
    if (!s.merchantPowerup || (player?.currency ?? 0) < MERCHANT_COST) { playError(); return }
    const id = s.merchantPowerup
    s.owned.push(id); applyPowerupEffects(id)
    s.merchantPowerup = null
    addCurrency(-MERCHANT_COST).then((p) => setPlayer(p)).catch(() => {})
    playPurchase(); flash('Potenziamento: ' + POWER_UPS[id].name + ' (solo questa run)'); syncUI()
  }

  const leaveMerchant = () => {
    const s = stateRef.current
    s.phase = 'playing'; s.secondStart = performance.now(); s.minute = 0; s.lastClickBeat = -1
    syncUI()
  }

  const choosePowerup = (id: PowerUpId) => {
    const s = stateRef.current; s.owned.push(id); applyPowerupEffects(id)
    s.phase = 'playing'; s.secondStart = performance.now(); s.minute = 0; s.lastClickBeat = -1
    syncUI()
  }

  const applyPowerupEffects = (id: PowerUpId) => {
    const s = stateRef.current
    switch (id) {
      case 'lancetta-instabile': s.perfectWindow = 160; break
      case 'meccanismo-corrotto': s.perfectWindow = 180; break
      case 'batteria-maledetta': s.batteryShields += 1; break
      case 'tempo-rubato': s.tempoRubatoAvailable = true; break
      case 'sveglia-fortuna': s.luckPercent += 10; break
    }
  }

  const useTempoRubato = () => {
    const s = stateRef.current
    if (!s.tempoRubatoAvailable || s.tempoRubatoActive) return
    s.tempoRubatoActive = true; s.tempoRubatoEnd = performance.now() + 3000; s.tempoRubatoAvailable = false
    flash('Tempo Rubato: 3 secondi rallentati.'); syncUI()
  }

  const armOcchio = () => {
    const s = stateRef.current
    if (!s.occhioAvailable || s.occhioArmed) return
    s.occhioArmed = true
    flash('Occhio sul Quadrante: pronto a schivare il prossimo attacco.'); syncUI()
  }

  const startGame = () => {
    initAudio(); resumeAudio()
    if (!derived) return
    stateRef.current = makeInitial(
      BASE_MAX_HP + derived.maxHpBonus,
      derived.bellBonus,
      derived.shieldCharges,
      derived.luckBonus,
      derived.extraLives,
    )
    const s = stateRef.current
    s.phase = 'playing'; s.secondStart = performance.now(); s.lastClickBeat = -1
    setPhase('playing'); setHp(s.maxHp); setMaxHp(s.maxHp); setHour(1); setMinute(0); setOwned([])
    setBossHp(BOSS_HP); setBossName(''); setLastPerfect(null); setPowerupChoices([])
    setBreathPhase('none'); setOcchioArmed(false); setLuckPercent(s.luckPercent); setExtraLives(s.extraLives)
  }

  const goToMenu = () => {
    stateRef.current.phase = 'menu'
    setPhase('menu')
  }

  const buyUpgrade = async (cat: UpgradeCategory) => {
    if (!player || !derived) return
    const def = ALL_UPGRADES.find((u) => u.category === cat)!
    const currentTier = cat === 'hp' ? player.hp_tier
      : cat === 'bell' ? player.bell_tier
      : cat === 'shield' ? player.shield_tier
      : cat === 'luck' ? player.luck_tier
      : player.benedizione_tier
    if (currentTier >= def.tiers.length) { playError(); return }
    const tier = def.tiers[currentTier]
    if (player.currency < tier.cost) { playError(); setShopError('Non hai abbastanza secondi.'); return }
    setShopError('')
    const newTier = currentTier + 1
    const patch: Partial<PlayerState> = { currency: player.currency - tier.cost }
    if (cat === 'hp') patch.hp_tier = newTier
    else if (cat === 'bell') patch.bell_tier = newTier
    else if (cat === 'shield') patch.shield_tier = newTier
    else if (cat === 'luck') patch.luck_tier = newTier
    else patch.benedizione_tier = newTier
    try {
      const updated = await savePlayerState(patch)
      setPlayer(updated)
      playPurchase()
      flash('Acquistato: ' + def.name + ' ' + tier.effect)
    } catch {
      setShopError('Errore di salvataggio.'); playError()
    }
  }

  useEffect(() => {
    const onResize = () => render()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const currency = player?.currency ?? 0
  const currencyCap = player?.currency_cap ?? 100000
  const currencyCapped = currency >= currencyCap
  const hasOcchio = owned.includes('occhio-sul-quadrante')

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-black font-clock">
      <canvas ref={canvasRef} onClick={onCanvasClick}
        className={`w-full h-full ${(phase === 'playing' || phase === 'boss') ? 'cursor-crosshair' : 'cursor-default'}`} />

      {(phase === 'playing' || phase === 'boss') && (
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
          <div className="bg-black/70 border border-rust/40 rounded px-4 py-2">
            <div className="text-bone text-sm tracking-widest">ORA {hour} / {TOTAL_HOURS}</div>
            <div className="text-bone/60 text-xs">Minuto {minute}/60</div>
            <div className={`text-xs mt-1 ${currencyCapped ? 'text-blood' : 'text-gold'}`}>
              ⏳ {stateRef.current.runCurrency}s questa run{currencyCapped ? ' (CAP)' : ''}
            </div>
            {luckPercent > 0 && (
              <div className="text-luck text-xs mt-1">🍀 Fortuna: {luckPercent}%</div>
            )}
            {extraLives > 0 && (
              <div className="text-divine text-xs mt-1">✨ Vite extra: {extraLives}</div>
            )}
          </div>
          <div className="bg-black/70 border border-blood/60 rounded px-4 py-2 text-right">
            <div className="text-bone text-sm">HP</div>
            <div className="w-44 h-4 bg-black border border-blood/40 rounded overflow-hidden mt-1">
              <div className="h-full transition-all duration-150 ease-out"
                style={{ width: `${(hp / maxHp) * 100}%`, background: hp > maxHp * 0.5 ? '#7a8a3a' : hp > maxHp * 0.25 ? '#c8a020' : '#7a0e0e' }} />
            </div>
            <div className="text-bone/80 text-xs mt-1">{hp} / {maxHp}</div>
          </div>
        </div>
      )}

      {phase === 'boss' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="text-blood font-horror text-3xl tracking-wider animate-flicker text-center">{bossName}</div>
          <div className="w-72 h-4 bg-black border-2 border-blood rounded mx-auto mt-2 overflow-hidden">
            <div className="h-full bg-blood transition-all duration-200" style={{ width: `${(bossHp / BOSS_HP) * 100}%` }} />
          </div>
          <div className="text-bone/70 text-xs text-center mt-1">{bossHp} HP</div>
          <div className="text-bone/50 text-xs text-center mt-1">Tempo congelato — sopravvivi al boss</div>
          <div className="text-divine/70 text-xs text-center mt-1">
            {owned.includes('campana-demoniaca')
              ? '🔔 La Campana Demoniaca lo danneggia ogni 10s'
              : '⚠️ Serve la Campana Demoniaca per danneggiarlo!'}
          </div>
          {breathPhase !== 'none' && (
            <div className="text-center mt-2 text-sm">
              <span className={breathPhase === 'fast' ? 'text-red-400 animate-pulse' : 'text-cyan-300/70'}>
                {breathPhase === 'fast' ? '💨 Respiro veloce' : '🌬️ Respiro lento'}
              </span>
            </div>
          )}
        </div>
      )}

      {feedback && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/70 border border-rust/40 rounded px-4 py-2 text-bone text-sm pointer-events-none animate-pulse z-20">{feedback}</div>
      )}

      {lastPerfect !== null && (phase === 'playing' || phase === 'boss') && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className={lastPerfect === true ? 'text-green-400 text-lg' : lastPerfect === false ? 'text-blood text-lg' : 'text-yellow-400/70 text-sm'}>
            {lastPerfect === true ? 'PERFETTO' : lastPerfect === false ? 'MISS -10 HP' : 'OK'}
          </span>
        </div>
      )}

      {owned.includes('tempo-rubato') && (phase === 'playing' || phase === 'boss') && (
        <button onClick={useTempoRubato}
          className="absolute bottom-8 right-8 bg-black/70 border border-rust/50 text-bone px-4 py-2 rounded hover:bg-rust/30 disabled:opacity-30 pointer-events-auto">⏳ Tempo Rubato</button>
      )}

      {hasOcchio && phase === 'boss' && (
        <button onClick={armOcchio} disabled={occhioArmed || !stateRef.current.occhioAvailable}
          className={`absolute bottom-8 left-1/2 -translate-x-1/2 ml-32 bg-black/70 border px-4 py-2 rounded pointer-events-auto transition-all
            ${occhioArmed ? 'border-cyan-400 text-cyan-300 animate-pulse' : 'border-cyan-700/50 text-bone hover:bg-cyan-900/30 disabled:opacity-30 disabled:cursor-not-allowed'}`}>
          {occhioArmed ? '👁️ Schiva ARMATO' : '👁️ Schiva attacco'}
        </button>
      )}

      {slowMo && <div className="absolute top-1/2 left-8 text-cyan-300/60 text-xs animate-pulse">SLOW-MO</div>}

      {phase === 'powerup' && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6">
          <h2 className="font-horror text-blood text-4xl mb-2 tracking-wider">POTENZIAMENTO</h2>
          <p className="text-bone/60 text-sm mb-6">Scegli un potere. L'ora {hour} incombe.</p>
          <div className="flex flex-wrap gap-4 justify-center max-w-3xl">
            {powerupChoices.map((id) => {
              const p = POWER_UPS[id]
              return (
                <button key={id} onClick={() => choosePowerup(id)}
                  className="w-64 bg-zinc-900 border-2 border-rust/40 hover:border-blood hover:bg-zinc-800 rounded-lg p-4 text-left transition-all hover:scale-105">
                  <div className="text-3xl mb-2">{p.icon}</div>
                  <div className="font-clock text-bone text-lg mb-1">{p.name}</div>
                  <div className="text-bone/60 text-xs leading-snug">{p.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {phase === 'merchant' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6">
          <h2 className="font-horror text-purple-400 text-4xl mb-2 tracking-wider">L'OMBRA MERCANTE</h2>
          <p className="text-bone/60 text-sm mb-2">Un'ombra incappucciata ti osserva. Offre tre doni. Costo: {MERCHANT_COST} secondi ciascuno.</p>
          <p className="text-purple-300/70 text-xs mb-6">Questi acquisti valgono solo per questa partita.</p>
          <div className="text-gold text-lg mb-6">⏳ {currency}s</div>
          <div className="flex flex-wrap gap-4 justify-center max-w-3xl">
            <button onClick={buyMerchantHeart} disabled={!merchantState.heart || currency < MERCHANT_COST}
              className="w-64 bg-zinc-900 border-2 border-purple-700/50 hover:border-purple-400 hover:bg-zinc-800 rounded-lg p-4 text-left transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed">
              <div className="text-3xl mb-2">❤️</div>
              <div className="font-clock text-bone text-lg mb-1">Cuore</div>
              <div className="text-bone/60 text-xs leading-snug">Guarisce 100 HP immediatamente.</div>
              <div className="text-purple-300 text-sm mt-2">Costo: {MERCHANT_COST}s</div>
            </button>
            <button onClick={buyMerchantShield} disabled={!merchantState.shield || currency < MERCHANT_COST}
              className="w-64 bg-zinc-900 border-2 border-purple-700/50 hover:border-purple-400 hover:bg-zinc-800 rounded-lg p-4 text-left transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed">
              <div className="text-3xl mb-2">🛡️</div>
              <div className="font-clock text-bone text-lg mb-1">Scudo</div>
              <div className="text-bone/60 text-xs leading-snug">Ricarica o aggiunge uno scudo (Batteria Maledetta).</div>
              <div className="text-purple-300 text-sm mt-2">Costo: {MERCHANT_COST}s</div>
            </button>
            {merchantState.powerup && (
              <button onClick={buyMerchantPowerup} disabled={currency < MERCHANT_COST}
                className="w-64 bg-zinc-900 border-2 border-purple-700/50 hover:border-purple-400 hover:bg-zinc-800 rounded-lg p-4 text-left transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed">
                <div className="text-3xl mb-2">{POWER_UPS[merchantState.powerup].icon}</div>
                <div className="font-clock text-bone text-lg mb-1">{POWER_UPS[merchantState.powerup].name}</div>
                <div className="text-bone/60 text-xs leading-snug">{POWER_UPS[merchantState.powerup].desc}</div>
                <div className="text-purple-300 text-sm mt-2">Costo: {MERCHANT_COST}s</div>
              </button>
            )}
          </div>
          <div className="flex gap-4 mt-8">
            <button onClick={leaveMerchant}
              className="bg-zinc-800 hover:bg-zinc-700 text-bone px-6 py-3 rounded-lg font-clock tracking-widest border border-bone/20 transition-all hover:scale-105">
              Continua senza comprare nulla →
            </button>
          </div>
        </div>
      )}

      {phase === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-6">
          <h1 className="font-horror text-blood text-5xl md:text-7xl mb-4 tracking-wider animate-breathe">Mi sono reincarnato<br/>in una sveglia</h1>
          <p className="text-bone/70 max-w-xl mb-6 text-sm md:text-base leading-relaxed">
            Sei una sveglia senziente in una stanza buia. Ogni secondo reale è un minuto di gioco.
            Clicca con precisione ogni secondo per sopravvivere. Sopravvivi 12 ore. Ogni 3 ore, un boss horror.
          </p>
          <div className="flex gap-4 mb-4">
            <button onClick={startGame}
              className="bg-blood hover:bg-red-900 text-bone px-8 py-4 rounded-lg text-xl font-clock tracking-widest border-2 border-bone/30 transition-all hover:scale-105">INIZIA</button>
            <button onClick={() => setPhase('shop')}
              className="bg-zinc-800 hover:bg-zinc-700 text-gold px-8 py-4 rounded-lg text-xl font-clock tracking-widest border-2 border-gold/40 transition-all hover:scale-105">🛒 NEGOZIO</button>
          </div>
          <div className="text-gold text-lg">⏳ Secondi: {playerLoading ? '...' : currency}{currencyCapped ? ' (CAP)' : ''}</div>
          <p className="text-bone/40 text-xs mt-4">Guadagni 1 secondo di valuta per ogni minuto di gioco. Usali nel negozio per potenziamenti permanenti.</p>
        </div>
      )}

      {phase === 'shop' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 overflow-auto">
          <div className="flex items-center justify-between w-full max-w-5xl mb-6">
            <h2 className="font-horror text-gold text-4xl tracking-wider">NEGOZIO</h2>
            <div className="text-gold text-2xl">⏳ {currency}s{currencyCapped ? ' (CAP)' : ''}</div>
          </div>
          {shopError && <div className="text-blood text-sm mb-4">{shopError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
            {ALL_UPGRADES.map((def) => (
              <ShopCard key={def.category} def={def} player={player} onBuy={() => buyUpgrade(def.category)} />
            ))}
          </div>
          <button onClick={() => setPhase('menu')}
            className="mt-8 bg-zinc-800 hover:bg-zinc-700 text-bone px-6 py-3 rounded-lg font-clock tracking-widest border border-bone/20">← Torna al menu</button>
        </div>
      )}

      {phase === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-center">
          <h1 className="font-horror text-blood text-6xl mb-4 animate-flicker">SEI MORTO</h1>
          <p className="text-bone/70 mb-2">Sei arrivato all'ora {hour}.</p>
          <p className="text-gold mb-2">⏳ Guadagnati {stateRef.current.runCurrency} secondi questa run.</p>
          <p className="text-bone/50 text-sm mb-6">La sveglia tace per sempre.</p>
          <div className="flex gap-4">
            <button onClick={startGame} className="bg-blood hover:bg-red-900 text-bone px-8 py-3 rounded-lg font-clock tracking-widest border border-bone/30">RIPROVA</button>
            <button onClick={goToMenu} className="bg-zinc-800 hover:bg-zinc-700 text-bone px-8 py-3 rounded-lg font-clock tracking-widest border border-bone/20">VAI AL MENU</button>
          </div>
        </div>
      )}

      {phase === 'win' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-center">
          <h1 className="font-horror text-green-500 text-6xl mb-4">12 ORE SOPRAVVISSUTE</h1>
          <p className="text-gold mb-2">⏳ Guadagnati {stateRef.current.runCurrency} secondi questa run.</p>
          <p className="text-bone/70 mb-6">La sveglia ha battuto la notte. Per ora.</p>
          <div className="flex gap-4">
            <button onClick={startGame} className="bg-blood hover:bg-red-900 text-bone px-8 py-3 rounded-lg font-clock tracking-widest border border-bone/30">RICOMINCIA</button>
            <button onClick={goToMenu} className="bg-zinc-800 hover:bg-zinc-700 text-bone px-8 py-3 rounded-lg font-clock tracking-widest border border-bone/20">VAI AL MENU</button>
          </div>
        </div>
      )}

      {(phase === 'playing' || phase === 'boss') && owned.length > 0 && (
        <div className="absolute bottom-8 left-8 flex flex-col gap-1 pointer-events-none">
          {owned.map((id) => <div key={id} className="text-2xl" title={POWER_UPS[id].name}>{POWER_UPS[id].icon}</div>)}
        </div>
      )}
    </div>
  )
}

function ShopCard({ def, player, onBuy }: { def: UpgradeDef; player: PlayerState | null; onBuy: () => void }) {
  const currentTier = def.category === 'hp' ? player?.hp_tier ?? 0
    : def.category === 'bell' ? player?.bell_tier ?? 0
    : def.category === 'shield' ? player?.shield_tier ?? 0
    : def.category === 'luck' ? player?.luck_tier ?? 0
    : player?.benedizione_tier ?? 0
  const maxed = currentTier >= def.tiers.length
  const nextTier = maxed ? null : def.tiers[currentTier]
  const affordable = nextTier ? (player?.currency ?? 0) >= nextTier.cost : false

  return (
    <div className="bg-zinc-900 border-2 border-rust/40 rounded-lg p-5 flex flex-col">
      <div className="text-4xl mb-2">{def.icon}</div>
      <h3 className="font-clock text-bone text-xl mb-1">{def.name}</h3>
      <p className="text-bone/50 text-xs mb-3 leading-snug">{def.description}</p>
      <div className="flex-1 space-y-1 mb-4">
        {def.tiers.map((t) => {
          const owned = t.tier <= currentTier
          const isNext = t.tier === currentTier + 1
          return (
            <div key={t.tier}
              className={`text-xs px-2 py-1 rounded flex justify-between items-center
                ${owned ? 'bg-green-900/40 text-green-300 border border-green-700/40' : ''}
                ${isNext ? 'bg-rust/20 text-bone border border-gold/50' : ''}
                ${!owned && !isNext ? 'text-bone/30' : ''}`}>
              <span>T{t.tier}: {t.effect}</span>
              <span>⏳ {t.cost}s {owned ? '✓' : ''}</span>
            </div>
          )
        })}
      </div>
      <button onClick={onBuy} disabled={maxed || !affordable}
        className={`w-full py-2 rounded font-clock tracking-wider text-sm transition-all
          ${maxed ? 'bg-zinc-700 text-bone/30 cursor-not-allowed' : affordable ? 'bg-gold text-black hover:bg-yellow-400' : 'bg-zinc-700 text-bone/40 cursor-not-allowed'}`}>
        {maxed ? 'COMPLETO' : affordable ? `ACQUISTA ⏳${nextTier!.cost}s` : `SERVONO ⏳${nextTier!.cost}s`}
      </button>
    </div>
  )
}
