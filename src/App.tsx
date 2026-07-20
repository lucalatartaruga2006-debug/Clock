import { useEffect, useRef, useState, useCallback } from 'react'
import { drawRoom } from './room'
import { POWER_UPS, rollPowerUps, type PowerUpId } from './powerups'
import { ALL_UPGRADES, computeStats, type UpgradeCategory, type UpgradeDef } from './shop'
import {
  initAudio, resumeAudio, playTick, playFakeTick, playClick, playDamage,
  playAlarmBuzz, playBell, playWhisper, playPowerup, playGameOver,
  playPurchase, playError, playSlowBreath, playFastBreath, playScream, playMerchant, playDodge, playLuckDodge, playRevive,
  preloadFileSounds, playAlarmFile, playZombieScream, startPossessionLoop, stopPossessionLoop,
  startBgMusic, stopBgMusic, pauseBgMusic, resumeBgMusic, startHorrorPad, stopHorrorPad,
} from './audio'
import { MechanicalClock } from './MechanicalClock'
import { loadPlayerState, addCurrency, savePlayerState, type PlayerState } from './supabase'

type Phase = 'menu' | 'shop' | 'playing' | 'powerup' | 'boss' | 'merchant' | 'gameover' | 'win' | 'possessed'
type BossType = 'ticchettio' | 'proprietario' | 'orologio-posseduto' | 'ora-zero' | null
type BreathPhase = 'slow' | 'fast' | 'none'

interface PossessedRound {
  targetHour: number; targetMinute: number; round: number; totalRounds: number
  deadline: number; playerHour: number; playerMinute: number; active: boolean; result: 'pending' | 'correct' | 'wrong'
}
interface PossessedState {
  round: number; totalRounds: number; targetHour: number; targetMinute: number
  playerHour: number; playerMinute: number; deadline: number; active: boolean; result: 'pending' | 'correct' | 'wrong'
  jumpscare: boolean; defeated: boolean; glitch: number
}

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
  // Merchant now spawns at a random minute within the hour instead of only on hour rollover.
  merchantSpawnMinute: number
  merchantSpawnedThisHour: boolean
  // Boss Ora 9: L'Orologio Posseduto — clock-setting mini-game.
  possessed: PossessedState
  // Sveglia del Tempo: every 10 seconds, skip 5 minutes. 2% chance to go back 50 minutes.
  svegliaTempoTick: number
  // Super Orologio: every 45 seconds, invulnerable for 10 seconds (auto).
  superOrologioTick: number
  superOrologioInvulnerable: boolean
  superOrologioInvulnEnd: number
  // Boss Ora 12: L'Ora Zero — 120-second countdown final boss.
  oraZeroDeadline: number
  oraZeroClockTaskAt: number
  oraZeroEyesIntensity: number
  oraZeroLaughing: boolean
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
    merchantSpawnMinute: 1 + Math.floor(Math.random() * 59),
    merchantSpawnedThisHour: false,
    possessed: { round: 0, totalRounds: 5, targetHour: 0, targetMinute: 0, playerHour: 0, playerMinute: 0, deadline: 0, active: false, result: 'pending', jumpscare: false, defeated: false, glitch: 0 },
    svegliaTempoTick: 0,
    superOrologioTick: 0,
    superOrologioInvulnerable: false,
    superOrologioInvulnEnd: 0,
    oraZeroDeadline: 0,
    oraZeroClockTaskAt: 0,
    oraZeroEyesIntensity: 0,
    oraZeroLaughing: false,
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
  const [bossType, setBossType] = useState<BossType>(null)
  const [feedback, setFeedback] = useState<string>('')
  const [lastPerfect, setLastPerfect] = useState<boolean | null>(null)
  const [slowMo, setSlowMo] = useState(false)
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('none')
  const [merchantState, setMerchantState] = useState<{ heart: boolean; shield: boolean; powerup: PowerUpId | null }>({ heart: false, shield: false, powerup: null })
  const [occhioArmed, setOcchioArmed] = useState(false)
  const [luckPercent, setLuckPercent] = useState(0)
  const [extraLives, setExtraLives] = useState(0)
  const [possessedState, setPossessedState] = useState<PossessedState>({ round: 0, totalRounds: 5, targetHour: 0, targetMinute: 0, playerHour: 0, playerMinute: 0, deadline: 0, active: false, result: 'pending', jumpscare: false, defeated: false, glitch: 0 })
  const [oraZeroCountdown, setOraZeroCountdown] = useState(120)

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
    setPhase(s.phase); setBossName(s.bossName ?? ''); setBossType(s.bossType)
    setSlowMo(s.tempoRubatoActive)
    setBreathPhase(s.breathPhase)
    setMerchantState({ heart: s.merchantHeart, shield: s.merchantShield, powerup: s.merchantPowerup })
    setOcchioArmed(s.occhioArmed)
    setLuckPercent(s.luckPercent)
    setExtraLives(s.extraLives)
    setPossessedState({ ...s.possessed })
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
    // Super Orologio: invulnerable during the 10-second window.
    if (s.superOrologioInvulnerable && performance.now() < s.superOrologioInvulnEnd) {
      playDodge(); flash('🛡️ Super Orologio: danno bloccato!'); return
    }
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
    stopPossessionLoop()
    stopHorrorPad()
    resumeBgMusic()
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
    stopHorrorPad()
    resumeBgMusic()
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
    if (phase === 'menu' || phase === 'gameover' || phase === 'win' || phase === 'shop' || phase === 'merchant' || phase === 'possessed') return
    let lastSecond = -1
    let lastHalfSecond = -1
    const loop = () => {
      const s = stateRef.current
      if (s.phase !== 'playing' && s.phase !== 'boss' && s.phase !== 'possessed') { render(); rafRef.current = requestAnimationFrame(loop); return }
      const now = performance.now()

      // During boss fights, the clock does NOT advance — time is frozen.
      // The player must survive the boss without the seconds ticking forward.
      // Bosses can ONLY be damaged by the Campana Demoniaca power-up
      // (10 HP every 10 seconds). Clicks do NOT damage the boss — they only
      // keep you alive (missed clicks hurt you, perfect clicks do nothing to the boss).
      if (s.phase === 'boss') {
        if (s.bossType === 'ora-zero') {
          // === Boss 12: L'Ora Zero — 120-second countdown with combined mechanics ===
          const remaining = s.oraZeroDeadline - now
          if (remaining <= 0) {
            // Player survived 120 seconds — boss defeated!
            s.bossHp = 0
            s.possessed.defeated = true
            stopHorrorPad()
            resumeBgMusic()
            playZombieScream(); playPowerup()
            flash("L'ORA ZERO È SPEZZATA! Gli occhi rossi si frantumano...")
            s.phase = 'win'
            win()
            render()
            rafRef.current = requestAnimationFrame(loop)
            return
          }
          // Update countdown UI
          const secsLeft = Math.ceil(remaining / 1000)
          if (secsLeft !== oraZeroCountdown) setOraZeroCountdown(secsLeft)
          // Eyes intensity increases as time runs out
          s.oraZeroEyesIntensity = 1 + (1 - remaining / 120000) * 0.5
          // Last 30 seconds: laughing, accelerated breath, increased horror
          if (remaining < 30000 && !s.oraZeroLaughing) {
            s.oraZeroLaughing = true
            s.breathPhase = 'fast'; s.breathTimeScale = 0.5
            flash("L'Ora Zero ride! Il ritmo accelera!")
          }
          if (s.oraZeroLaughing) {
            const breathInterval = 500
            if (now - s.lastBreathSound > breathInterval) {
              s.lastBreathSound = now
              playFastBreath()
              if (Math.random() < 0.3) playZombieScream()
            }
          }
          // Mechanic from Boss 3 (Ticchettio): fake ticks and light flicker
          const halfSec = Math.floor(now / 500)
          if (halfSec !== lastHalfSecond) {
            if (halfSec % 2 === 1 && lastHalfSecond >= 0 && Math.random() < 0.3) {
              s.fakeSecondActive = true
              playFakeTick()
              setTimeout(() => { stateRef.current.fakeSecondActive = false }, 500)
            }
            lastHalfSecond = halfSec
          }
          // Light flicker — randomly goes dark for 1-2 seconds
          if (Math.random() < 0.01) {
            s.lightOn = false
            setTimeout(() => { stateRef.current.lightOn = true }, 1000 + Math.random() * 1000)
          }
          // Mechanic from Boss 9 (Possessed): clock-setting task every 5-10 seconds
          if (!s.possessed.active && s.possessed.result === 'pending' && now >= s.oraZeroClockTaskAt) {
            startOraZeroClockTask()
          }
          if (s.possessed.active && s.possessed.result === 'pending') {
            if (now >= s.possessed.deadline) {
              s.possessed.result = 'wrong'
              s.possessed.active = false
              s.possessed.glitch = 1
              s.hp = Math.max(0, s.hp - 50)
              playDamage(); playZombieScream()
              flash('⏰ Troppo lento! -50 HP')
              if (s.hp <= 0) { handleDeath() }
              s.oraZeroClockTaskAt = now + 5000 + Math.random() * 5000
              setTimeout(() => {
                if (stateRef.current.phase === 'boss' && stateRef.current.bossType === 'ora-zero') {
                  stateRef.current.possessed.result = 'pending'
                  syncUI()
                }
              }, 1200)
            }
          }
          if (s.possessed.glitch > 0) s.possessed.glitch = Math.max(0, s.possessed.glitch - 0.02)
          // Survival clicks: player must keep clicking every second
          let bossBeatInterval = SECOND_MS
          if (s.oraZeroLaughing) bossBeatInterval = SECOND_MS * s.breathTimeScale
          const bossElapsed = now - s.secondStart
          const bossBeat = Math.floor(bossElapsed / bossBeatInterval)
          if (bossBeat !== lastSecond) {
            if (lastSecond >= 0 && s.lastClickBeat < lastSecond) registerMiss()
            lastSecond = bossBeat
            playTick(bossBeat % 4 === 0)
            // Campana Demoniaca still works
            if (s.owned.includes('campana-demoniaca')) {
              s.bossBellTick++
              if (s.bossBellTick % 10 === 0) {
                const dmg = 10 + s.bellBonus
                s.bossHp -= dmg; playBell()
              }
            }
          }
          syncUI()
          render()
          rafRef.current = requestAnimationFrame(loop)
          return
        }
        if (s.bossType === 'orologio-posseduto') {
          // Possessed boss: handle mini-game timing
          if (s.possessed.active && s.possessed.result === 'pending') {
            if (now >= s.possessed.deadline) {
              // Time's up — player took too long
              s.possessed.result = 'wrong'
              s.possessed.active = false
              s.possessed.glitch = 1
              s.hp = Math.max(0, s.hp - 50)
              playDamage(); playZombieScream()
              flash('⏰ Troppo lento! -50 HP')
              if (s.hp <= 0) { handleDeath() }
              setTimeout(() => {
                if (stateRef.current.phase === 'boss' && stateRef.current.bossType === 'orologio-posseduto') nextPossessedRound()
              }, 1200)
            }
          }
          if (s.possessed.glitch > 0) s.possessed.glitch = Math.max(0, s.possessed.glitch - 0.02)
          syncUI()
          render()
          rafRef.current = requestAnimationFrame(loop)
          return
        }
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
          stopPossessionLoop()
          s.possessed = { ...s.possessed, jumpscare: false, defeated: true, active: false }
          flash('Hai sconfitto ' + (s.bossName ?? '') + '!'); playZombieScream(); playPowerup(); syncUI()
        }
        render()
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // Normal play: the clock advances.
      let timeScale = 1
      if (s.tempoRubatoActive && now < s.tempoRubatoEnd) timeScale = 0.4
      if (s.owned.includes('ultimo-secondo') && s.hp < s.maxHp * 0.10) timeScale = Math.min(timeScale, 0.5)
      const elapsed = (now - s.secondStart) * timeScale
      const currentBeat = Math.floor(elapsed / SECOND_MS)

      if (currentBeat !== lastSecond) {
        if (lastSecond >= 0 && s.lastClickBeat < lastSecond) registerMiss()
        lastSecond = currentBeat
        playTick(currentBeat % 4 === 0)
        if (s.ghostSeconds > 0 && now < s.ghostSecondsEnd) handleAutoClick()
        if (s.owned.includes('lancetta-fantasma') && Math.random() < 0.3) handleAutoClick()
        const horrorChance = 0.03
        if (Math.random() < horrorChance) triggerHorrorEvent()
        // Sveglia del Tempo: every 10 seconds, skip 5 minutes. 2% chance to go back 50 minutes.
        if (s.owned.includes('sveglia-predatrice')) {
          s.svegliaTempoTick++
          if (s.svegliaTempoTick % 10 === 0) {
            if (Math.random() < 0.02) {
              s.minute = Math.max(0, s.minute - 50)
              flash('⏰ Sveglia del Tempo: indietro di 50 minuti!')
            } else {
              s.minute += 5
              if (s.minute >= 60) { s.minute -= 60; onHourRollover() }
              flash('⏰ Sveglia del Tempo: +5 minuti')
            }
          }
        }
        if (s.minute >= 60) { s.minute -= 60; onHourRollover() }
        maybeSpawnMerchant()
      }

      // Super Orologio: every 45 seconds, invulnerable for 10 seconds.
      if (s.owned.includes('tempo-rubato') && !s.superOrologioInvulnerable) {
        s.superOrologioTick++
        if (s.superOrologioTick >= 45) {
          s.superOrologioTick = 0
          s.superOrologioInvulnerable = true
          s.superOrologioInvulnEnd = now + 10000
          flash('🛡️ Super Orologio: invulnerabilità per 10 secondi!')
          syncUI()
        }
      }
      if (s.superOrologioInvulnerable && now >= s.superOrologioInvulnEnd) {
        s.superOrologioInvulnerable = false
        syncUI()
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
      secondProgress: ((performance.now() - s.secondStart) / SECOND_MS) % 60,
      possessedActive: s.bossType === 'orologio-posseduto' && s.phase === 'boss' && !s.possessed.jumpscare,
      possessedJumpscare: s.possessed.jumpscare && s.bossType === 'orologio-posseduto',
      possessedDefeated: s.possessed.defeated,
      possessedGlitch: s.possessed.glitch,
      possessedTargetHour: s.possessed.targetHour,
      possessedTargetMinute: s.possessed.targetMinute,
      possessedPlayerHour: s.possessed.playerHour,
      possessedPlayerMinute: s.possessed.playerMinute,
      oraZeroActive: s.bossType === 'ora-zero' && s.phase === 'boss',
      oraZeroCountdown: oraZeroCountdown,
      oraZeroEyesIntensity: s.oraZeroEyesIntensity,
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
    maybeSpawnMerchant()
    syncUI()
  }

  const onCanvasClick = () => {
    resumeAudio()
    const s = stateRef.current
    if (s.phase !== 'playing' && s.phase !== 'boss') return
    const now = performance.now()

    // During the possessed boss, the mini-game uses on-screen buttons, not canvas clicks.
    if (s.phase === 'boss' && s.bossType === 'orologio-posseduto') return
    // During ora-zero clock tasks, the MechanicalClock handles input.
    if (s.phase === 'boss' && s.bossType === 'ora-zero' && s.possessed.active && s.possessed.result === 'pending') return

    // During boss fights, clicks keep you alive but do NOT damage the boss.
    // The boss can only be damaged by the Campana Demoniaca power-up.
    if (s.phase === 'boss') {
      let bossBeatInterval = SECOND_MS
      if (s.bossType === 'proprietario') bossBeatInterval = SECOND_MS * s.breathTimeScale
      if (s.bossType === 'ora-zero' && s.oraZeroLaughing) bossBeatInterval = SECOND_MS * s.breathTimeScale
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
    if (s.owned.includes('ultimo-secondo') && s.hp < s.maxHp * 0.10) timeScale = Math.min(timeScale, 0.5)
    const elapsed = (now - s.secondStart) * timeScale

    const nearestTick = Math.round(elapsed / SECOND_MS)
    const offset = Math.abs(elapsed - nearestTick * SECOND_MS)
    s.lastClickBeat = Math.max(s.lastClickBeat, nearestTick)

    if (offset <= s.perfectWindow) {
      s.minute++; s.runCurrency++
      if (s.minute >= 60) { s.minute -= 60; onHourRollover() }
      maybeSpawnMerchant()
      playClick(true); setLastPerfect(true)
      if (s.owned.includes('eco-del-secondo')) { s.ghostSeconds++; s.ghostSecondsEnd = now + 3000 }
      syncUI()
    } else if (offset > s.perfectWindow * 2) {
      playClick(false); setLastPerfect(false)
      registerMiss()
    } else {
      s.minute++; s.runCurrency++
      if (s.minute >= 60) { s.minute -= 60; onHourRollover() }
      maybeSpawnMerchant()
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

  const maybeSpawnMerchant = () => {
    const s = stateRef.current
    if (!s.merchantSpawnedThisHour && s.minute >= s.merchantSpawnMinute && s.phase === 'playing' && !BOSS_HOURS.includes(s.hour)) {
      s.merchantSpawnedThisHour = true
      if (Math.random() < MERCHANT_CHANCE) startMerchant()
    }
  }

  const onHourRollover = () => {
    const s = stateRef.current; s.hour++
    if (s.hour > TOTAL_HOURS) { win(); return }
    s.merchantSpawnedThisHour = false
    s.merchantSpawnMinute = 1 + Math.floor(Math.random() * 59)
    if (BOSS_HOURS.includes(s.hour)) startBoss()
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
    } else if (s.hour === 9) {
      // Boss Ora 9: L'Orologio Posseduto — jumpscare then clock-setting mini-game
      s.bossType = 'orologio-posseduto'
      s.bossName = "L'Orologio Posseduto"
      s.bossHp = BOSS_HP
      s.lightOn = false
      s.possessed = { round: 0, totalRounds: 5, targetHour: 0, targetMinute: 0, playerHour: 0, playerMinute: 0, deadline: 0, active: false, result: 'pending', jumpscare: true, defeated: false, glitch: 0 }
      syncUI()
      // Jumpscare sequence: screen cracks, scream, red eyes, then possession sound
      playZombieScream()
      setTimeout(() => { startPossessionLoop() }, 800)
      flash('BOSS: ' + s.bossName + ' — lo schermo si rompe!')
      // After jumpscare, start the first round
      setTimeout(() => {
        const ps = stateRef.current.possessed
        ps.jumpscare = false
        startPossessedRound()
      }, 2500)
    } else if (s.hour === 12) {
      // Boss Ora 12: L'Ora Zero — final boss, 120-second countdown, combined mechanics
      s.bossType = 'ora-zero'
      s.bossName = 'L\'Ora Zero'
      s.bossHp = BOSS_HP
      s.lightOn = false
      s.oraZeroDeadline = performance.now() + 120000
      s.oraZeroClockTaskAt = performance.now() + 5000 + Math.random() * 5000
      s.oraZeroEyesIntensity = 1
      s.oraZeroLaughing = false
      s.possessed = { ...s.possessed, active: false, result: 'pending', jumpscare: false, defeated: false }
      pauseBgMusic()
      startHorrorPad()
      playZombieScream()
      flash('BOSS FINALE: ' + s.bossName + ' — 120 secondi. Sopravvivi!')
      syncUI()
    } else {
      s.bossType = 'ticchettio'
      s.bossName = 'Il Ticchettio'
      s.lightOn = false
      s.alarmVibrateUntil = performance.now() + 2500
      setTimeout(() => { s.lightOn = true; syncUI() }, 600)
      s.flickerUntil = performance.now() + 2000
      playAlarmFile()
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
    s.phase = 'playing'; s.secondStart = performance.now(); s.lastClickBeat = -1
    syncUI()
  }

  const choosePowerup = (id: PowerUpId) => {
    const s = stateRef.current; s.owned.push(id); applyPowerupEffects(id)
    s.phase = 'playing'; s.secondStart = performance.now(); s.lastClickBeat = -1
    syncUI()
  }

  const applyPowerupEffects = (id: PowerUpId) => {
    const s = stateRef.current
    switch (id) {
      case 'lancetta-instabile': s.perfectWindow = 160; break
      case 'meccanismo-corrotto': s.luckPercent += 20; s.maxHp = Math.floor(s.maxHp / 2); s.hp = Math.min(s.hp, s.maxHp); break
      case 'batteria-maledetta': s.batteryShields += 1; break
      case 'tempo-rubato': break
      case 'sveglia-fortuna': s.luckPercent += 10; break
    }
  }

  const armOcchio = () => {
    const s = stateRef.current
    if (!s.occhioAvailable || s.occhioArmed) return
    s.occhioArmed = true
    flash('Occhio sul Quadrante: pronto a schivare il prossimo attacco.'); syncUI()
  }

  // === Boss Ora 9: L'Orologio Posseduto — clock-setting mini-game ===
  // === Boss 12: L'Ora Zero — clock-setting task (from Boss 9 mechanic) ===
  const startOraZeroClockTask = () => {
    const s = stateRef.current
    if (s.bossType !== 'ora-zero') return
    const targetHour = 1 + Math.floor(Math.random() * 12)
    const targetMinute = Math.floor(Math.random() * 60)
    s.possessed = {
      ...s.possessed,
      targetHour, targetMinute,
      playerHour: 12, playerMinute: 0,
      deadline: performance.now() + 10000,
      active: true, result: 'pending', glitch: 0,
    }
    setPossessedState({ ...s.possessed })
    flash('⏰ Imposta le lancette su: ' + targetHour + ':' + (targetMinute < 10 ? '0' : '') + targetMinute)
    syncUI()
  }

  const startPossessedRound = () => {
    const s = stateRef.current
    if (s.bossType !== 'orologio-posseduto') return
    const round = s.possessed.round + 1
    // Difficulty increases: round 1-2 = whole hours, 3-4 = quarter hours, 5 = random minute
    let targetHour: number, targetMinute: number
    if (round <= 2) { targetHour = 1 + Math.floor(Math.random() * 12); targetMinute = 0 }
    else if (round <= 4) { targetHour = 1 + Math.floor(Math.random() * 12); targetMinute = [0, 15, 30, 45][Math.floor(Math.random() * 4)] }
    else { targetHour = 1 + Math.floor(Math.random() * 12); targetMinute = Math.floor(Math.random() * 60) }
    s.possessed = {
      ...s.possessed,
      round, targetHour, targetMinute,
      playerHour: 12, playerMinute: 0,
      deadline: performance.now() + 10000,
      active: true, result: 'pending', glitch: 0,
    }
    setPossessedState({ ...s.possessed })
    flash('Round ' + round + '/5 — Imposta le lancette su: ' + targetHour + ':' + (targetMinute < 10 ? '0' : '') + targetMinute)
    syncUI()
  }

  const nextPossessedRound = () => {
    const s = stateRef.current
    if (s.possessed.round >= s.possessed.totalRounds) {
      // All rounds done — boss defeated
      s.bossHp = 0
      s.possessed.defeated = true
      s.possessed.active = false
      stopPossessionLoop()
      playZombieScream()
      flash("L'Orologio Posseduto si spezza! Gli occhi rossi svaniscono...")
      s.phase = 'playing'; s.lightOn = true; s.flickerUntil = 0
      s.bossType = null; s.breathPhase = 'none'; s.breathTimeScale = 1
      s.secondStart = performance.now(); s.lastClickBeat = -1
      setPhase('playing'); syncUI()
      return
    }
    startPossessedRound()
  }

  const adjustPossessedHand = (which: 'hour' | 'minute', delta: number) => {
    const s = stateRef.current
    if (!s.possessed.active || s.possessed.result !== 'pending') return
    if (which === 'hour') {
      s.possessed.playerHour = ((s.possessed.playerHour - 1 + delta) % 12) + 1
    } else {
      s.possessed.playerMinute = (s.possessed.playerMinute + delta + 60) % 60
    }
    setPossessedState({ ...s.possessed })
    playTick()
  }

  const submitPossessedAnswer = () => {
    const s = stateRef.current
    if (!s.possessed.active || s.possessed.result !== 'pending') return
    const correct = s.possessed.playerHour === s.possessed.targetHour && s.possessed.playerMinute === s.possessed.targetMinute
    s.possessed.active = false
    if (correct) {
      s.possessed.result = 'correct'
      s.bossHp = Math.max(0, s.bossHp - 20)
      playBell(); playPowerup()
      flash('✓ Corretto! -20 HP al boss')
    } else {
      s.possessed.result = 'wrong'
      s.possessed.glitch = 1
      s.hp = Math.max(0, s.hp - 50)
      playDamage(); playZombieScream()
      flash('✗ Sbagliato! Era ' + s.possessed.targetHour + ':' + (s.possessed.targetMinute < 10 ? '0' : '') + s.possessed.targetMinute + ' — -50 HP')
      if (s.hp <= 0) { handleDeath() }
    }
    setPossessedState({ ...s.possessed })
    setBossHp(s.bossHp)
    // For ora-zero: schedule next clock task after a delay
    if (s.bossType === 'ora-zero') {
      s.oraZeroClockTaskAt = performance.now() + 5000 + Math.random() * 5000
      setTimeout(() => {
        if (stateRef.current.phase === 'boss' && stateRef.current.bossType === 'ora-zero') {
          stateRef.current.possessed.result = 'pending'
          syncUI()
        }
      }, 1200)
      return
    }
    // For possessed boss: always schedule the next round, even after revive — prevents softlock.
    setTimeout(() => {
      if (stateRef.current.phase === 'boss' && stateRef.current.bossType === 'orologio-posseduto') nextPossessedRound()
    }, 1200)
  }

  const startGame = () => {
    initAudio(); resumeAudio()
    preloadFileSounds()
    startBgMusic()
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
    setBossHp(BOSS_HP); setBossName(''); setBossType(null); setLastPerfect(null); setPowerupChoices([])
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
    <div className="w-screen relative overflow-hidden bg-black font-clock" style={{ height: '100dvh' }}>
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

      {phase === 'boss' && bossType !== 'orologio-posseduto' && (
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

      {phase === 'boss' && bossType === 'orologio-posseduto' && (
        <div className="absolute inset-0 flex flex-col items-center justify-between p-4 sm:p-6 pointer-events-auto z-30">
          {/* Top: boss name + HP bar */}
          <div className="w-full max-w-md text-center">
            <div className="text-red-500 font-horror text-2xl sm:text-3xl tracking-wider animate-flicker">{bossName}</div>
            <div className="w-64 h-3 bg-black border-2 border-red-700 rounded mx-auto mt-2 overflow-hidden">
              <div className="h-full bg-red-600 transition-all duration-200" style={{ width: `${(bossHp / BOSS_HP) * 100}%` }} />
            </div>
            <div className="text-bone/70 text-xs mt-1">{bossHp} HP — Round {possessedState.round}/{possessedState.totalRounds}</div>
          </div>

          {/* Middle: target time display */}
          {possessedState.active && possessedState.result === 'pending' && (
            <div className="text-center">
              <div className="text-bone/50 text-xs sm:text-sm mb-1">Imposta le lancette su:</div>
              <div className="font-horror text-red-400 text-3xl sm:text-5xl tracking-wider">
                {possessedState.targetHour}:{possessedState.targetMinute < 10 ? '0' : ''}{possessedState.targetMinute}
              </div>
              <div className="text-bone/40 text-xs mt-2">
                Tempo: {Math.max(0, Math.ceil((possessedState.deadline - performance.now()) / 1000))}s
              </div>
            </div>
          )}

          {/* Bottom: mechanical clock with draggable hands */}
          {possessedState.active && possessedState.result === 'pending' && (
            <div className="w-full max-w-sm flex flex-col items-center gap-3">
              <div className="text-bone/50 text-xs text-center">Trascina le lancette per impostare l'orario</div>
              <MechanicalClock
                hour={possessedState.playerHour}
                minute={possessedState.playerMinute}
                onHourChange={(h) => { stateRef.current.possessed.playerHour = h; setPossessedState({ ...stateRef.current.possessed }); playTick() }}
                onMinuteChange={(m) => { stateRef.current.possessed.playerMinute = m; setPossessedState({ ...stateRef.current.possessed }); playTick() }}
                size={240}
              />
              <div className="font-clock text-bone text-lg">{possessedState.playerHour}:{possessedState.playerMinute < 10 ? '0' : ''}{possessedState.playerMinute}</div>
              <button onClick={submitPossessedAnswer}
                className="w-full bg-red-700 hover:bg-red-600 text-bone py-3 rounded-lg font-clock tracking-widest border border-red-400/50 transition-all hover:scale-105">
                CONFERMA ORARIO
              </button>
            </div>
          )}

          {/* Result feedback */}
          {possessedState.result !== 'pending' && !possessedState.active && !possessedState.defeated && (
            <div className={`text-center font-horror text-3xl ${possessedState.result === 'correct' ? 'text-green-400' : 'text-red-500 animate-pulse'}`}>
              {possessedState.result === 'correct' ? '✓ CORRETTO' : '✗ SBAGLIATO'}
            </div>
          )}

          {possessedState.defeated && (
            <div className="text-center font-horror text-green-400 text-3xl animate-pulse">SCONFITTO</div>
          )}
        </div>
      )}

      {phase === 'boss' && bossType === 'ora-zero' && (
        <div className="absolute inset-0 flex flex-col items-center justify-between p-4 sm:p-6 pointer-events-auto z-30">
          {/* Top: countdown + boss name */}
          <div className="w-full max-w-md text-center">
            <div className="text-red-500 font-horror text-2xl sm:text-3xl tracking-wider animate-flicker">L'ORA ZERO</div>
            <div className={`font-horror text-4xl sm:text-6xl mt-2 ${oraZeroCountdown <= 10 ? 'text-red-500 animate-pulse' : oraZeroCountdown <= 30 ? 'text-orange-400' : 'text-bone'}`}>
              {oraZeroCountdown}s
            </div>
            <div className="text-bone/50 text-xs mt-1">Sopravvivi fino allo zero</div>
          </div>

          {/* Middle: clock task if active */}
          {possessedState.active && possessedState.result === 'pending' && (
            <div className="text-center">
              <div className="text-bone/50 text-xs sm:text-sm mb-1">Imposta le lancette su:</div>
              <div className="font-horror text-red-400 text-3xl sm:text-5xl tracking-wider">
                {possessedState.targetHour}:{possessedState.targetMinute < 10 ? '0' : ''}{possessedState.targetMinute}
              </div>
              <div className="text-bone/40 text-xs mt-2">
                Tempo: {Math.max(0, Math.ceil((possessedState.deadline - performance.now()) / 1000))}s
              </div>
            </div>
          )}

          {/* Bottom: mechanical clock for clock tasks */}
          {possessedState.active && possessedState.result === 'pending' && (
            <div className="w-full max-w-sm flex flex-col items-center gap-3">
              <MechanicalClock
                hour={possessedState.playerHour}
                minute={possessedState.playerMinute}
                onHourChange={(h) => { stateRef.current.possessed.playerHour = h; setPossessedState({ ...stateRef.current.possessed }); playTick() }}
                onMinuteChange={(m) => { stateRef.current.possessed.playerMinute = m; setPossessedState({ ...stateRef.current.possessed }); playTick() }}
                size={200}
              />
              <div className="font-clock text-bone text-lg">{possessedState.playerHour}:{possessedState.playerMinute < 10 ? '0' : ''}{possessedState.playerMinute}</div>
              <button onClick={submitPossessedAnswer}
                className="w-full bg-red-700 hover:bg-red-600 text-bone py-3 rounded-lg font-clock tracking-widest border border-red-400/50 transition-all hover:scale-105">
                CONFERMA ORARIO
              </button>
            </div>
          )}

          {/* Result feedback */}
          {possessedState.result !== 'pending' && !possessedState.active && !possessedState.defeated && (
            <div className={`text-center font-horror text-3xl ${possessedState.result === 'correct' ? 'text-green-400' : 'text-red-500 animate-pulse'}`}>
              {possessedState.result === 'correct' ? '✓ CORRETTO' : '✗ SBAGLIATO'}
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
        <div className="absolute bottom-8 right-8 bg-black/70 border border-cyan-500/50 text-cyan-300 px-4 py-2 rounded pointer-events-none text-sm">
          {stateRef.current.superOrologioInvulnerable
            ? '🛡️ Invulnerabile: ' + Math.max(0, Math.ceil((stateRef.current.superOrologioInvulnEnd - performance.now()) / 1000)) + 's'
            : '🛡️ Super Orologio: ' + (45 - stateRef.current.superOrologioTick) + 's'}
        </div>
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
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 overflow-auto" style={{ maxHeight: '100dvh' }}>
          <h2 className="font-horror text-blood text-2xl sm:text-4xl mb-2 tracking-wider mt-4 sm:mt-0 shrink-0">POTENZIAMENTO</h2>
          <p className="text-bone/60 text-xs sm:text-sm mb-4 text-center shrink-0">Scegli un potere. L'ora {hour} incombe.</p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center max-w-3xl w-full pb-6">
            {powerupChoices.map((id) => {
              const p = POWER_UPS[id]
              return (
                <button key={id} onClick={() => choosePowerup(id)}
                  className="w-full sm:w-64 bg-zinc-900 border-2 border-rust/40 hover:border-blood hover:bg-zinc-800 rounded-lg p-3 sm:p-4 text-left transition-all hover:scale-105">
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">{p.icon}</div>
                  <div className="font-clock text-bone text-base sm:text-lg mb-1">{p.name}</div>
                  <div className="text-bone/60 text-xs leading-snug">{p.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {phase === 'merchant' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-start p-4 sm:p-6 overflow-auto" style={{ maxHeight: '100dvh' }}>
          <h2 className="font-horror text-purple-400 text-2xl sm:text-4xl mb-2 tracking-wider mt-4 sm:mt-0 shrink-0">L'OMBRA MERCANTE</h2>
          <p className="text-bone/60 text-xs sm:text-sm mb-2 text-center px-2 shrink-0">Un'ombra incappucciata ti osserva. Offre tre doni. Costo: {MERCHANT_COST} secondi ciascuno.</p>
          <p className="text-purple-300/70 text-xs mb-4 text-center shrink-0">Questi acquisti valgono solo per questa partita.</p>
          <div className="text-gold text-lg mb-4 shrink-0">⏳ {currency}s</div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center max-w-3xl w-full pb-4">
            <button onClick={buyMerchantHeart} disabled={!merchantState.heart || currency < MERCHANT_COST}
              className="w-full sm:w-64 bg-zinc-900 border-2 border-purple-700/50 hover:border-purple-400 hover:bg-zinc-800 rounded-lg p-3 sm:p-4 text-left transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed">
              <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">❤️</div>
              <div className="font-clock text-bone text-base sm:text-lg mb-1">Cuore</div>
              <div className="text-bone/60 text-xs leading-snug">Guarisce 100 HP immediatamente.</div>
              <div className="text-purple-300 text-sm mt-2">Costo: {MERCHANT_COST}s</div>
            </button>
            <button onClick={buyMerchantShield} disabled={!merchantState.shield || currency < MERCHANT_COST}
              className="w-full sm:w-64 bg-zinc-900 border-2 border-purple-700/50 hover:border-purple-400 hover:bg-zinc-800 rounded-lg p-3 sm:p-4 text-left transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed">
              <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">🛡️</div>
              <div className="font-clock text-bone text-base sm:text-lg mb-1">Scudo</div>
              <div className="text-bone/60 text-xs leading-snug">Ricarica o aggiunge uno scudo (Batteria Maledetta).</div>
              <div className="text-purple-300 text-sm mt-2">Costo: {MERCHANT_COST}s</div>
            </button>
            {merchantState.powerup && (
              <button onClick={buyMerchantPowerup} disabled={currency < MERCHANT_COST}
                className="w-full sm:w-64 bg-zinc-900 border-2 border-purple-700/50 hover:border-purple-400 hover:bg-zinc-800 rounded-lg p-3 sm:p-4 text-left transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed">
                <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">{POWER_UPS[merchantState.powerup].icon}</div>
                <div className="font-clock text-bone text-base sm:text-lg mb-1">{POWER_UPS[merchantState.powerup].name}</div>
                <div className="text-bone/60 text-xs leading-snug">{POWER_UPS[merchantState.powerup].desc}</div>
                <div className="text-purple-300 text-sm mt-2">Costo: {MERCHANT_COST}s</div>
              </button>
            )}
          </div>
          <div className="flex gap-4 mt-4 mb-6 shrink-0">
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
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-start p-4 sm:p-6 overflow-auto" style={{ maxHeight: '100dvh' }}>
          <div className="flex items-center justify-between w-full max-w-5xl mb-4 mt-4 sm:mt-0 shrink-0">
            <h2 className="font-horror text-gold text-2xl sm:text-4xl tracking-wider">NEGOZIO</h2>
            <div className="text-gold text-lg sm:text-2xl">⏳ {currency}s{currencyCapped ? ' (CAP)' : ''}</div>
          </div>
          {shopError && <div className="text-blood text-sm mb-4 shrink-0">{shopError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full max-w-5xl pb-4">
            {ALL_UPGRADES.map((def) => (
              <ShopCard key={def.category} def={def} player={player} onBuy={() => buyUpgrade(def.category)} />
            ))}
          </div>
          <button onClick={() => setPhase('menu')}
            className="mt-4 mb-6 bg-zinc-800 hover:bg-zinc-700 text-bone px-6 py-3 rounded-lg font-clock tracking-widest border border-bone/20 shrink-0">← Torna al menu</button>
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
    <div className="bg-zinc-900 border-2 border-rust/40 rounded-lg p-4 sm:p-5 flex flex-col">
      <div className="text-3xl sm:text-4xl mb-2">{def.icon}</div>
      <h3 className="font-clock text-bone text-lg sm:text-xl mb-1">{def.name}</h3>
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
