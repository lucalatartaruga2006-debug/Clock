import alarmUrl from './assets/audio/freesound_community-generic-alarm-clock-86759.mp3'
import zombieUrl from './assets/audio/dragon-studio-zombie-screech-sound-effect-312865.mp3'
import possessionUrl from './assets/audio/freesound_community-moan-12-you-are-all-mine-echo-low-pitch-34521.mp3'
import bgMusicUrl from './assets/audio/soundreality-something-strange-160387.mp3'
import horrorPadUrl from './assets/audio/soundreality-horror-pad-pitch-crowd-391598.mp3'
import menuTickUrl from './assets/audio/wet-ticking-clock_120bpm_D_minor.wav'

let ctx: AudioContext | null = null
let master: GainNode | null = null

export function initAudio() {
  if (ctx) return ctx
  const AC = window.AudioContext || (window as any).webkitAudioContext
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.6
  master.connect(ctx.destination)
  return ctx
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume()
}

function now() { return ctx!.currentTime }

export function playTick(accent = false) {
  if (!ctx || !master) return
  const t = now()
  const osc = ctx.createOscillator(); const g = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(accent ? 2400 : 1800, t)
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.03)
  g.gain.setValueAtTime(accent ? 0.5 : 0.32, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  osc.connect(g).connect(master)
  osc.start(t); osc.stop(t + 0.06)
}

export function playFakeTick() {
  if (!ctx || !master) return
  const t = now()
  const osc = ctx.createOscillator(); const g = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(1500, t)
  osc.frequency.exponentialRampToValueAtTime(500, t + 0.03)
  g.gain.setValueAtTime(0.22, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  osc.connect(g).connect(master)
  osc.start(t); osc.stop(t + 0.06)
}

export function playClick(perfect: boolean) {
  if (!ctx || !master) return
  const t = now()
  const osc = ctx.createOscillator(); const g = ctx.createGain()
  osc.type = perfect ? 'triangle' : 'sawtooth'
  osc.frequency.setValueAtTime(perfect ? 880 : 220, t)
  if (perfect) osc.frequency.exponentialRampToValueAtTime(1320, t + 0.04)
  g.gain.setValueAtTime(perfect ? 0.4 : 0.25, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc.connect(g).connect(master)
  osc.start(t); osc.stop(t + 0.14)
  if (perfect) {
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain()
    o2.type = 'sine'; o2.frequency.value = 1760
    g2.gain.setValueAtTime(0.12, t)
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    o2.connect(g2).connect(master)
    o2.start(t); o2.stop(t + 0.2)
  }
}

export function playDamage() {
  if (!ctx || !master) return
  const t = now()
  const osc = ctx.createOscillator(); const g = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(180, t)
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.25)
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
  osc.connect(g).connect(master)
  osc.start(t); osc.stop(t + 0.32)
  const buf = ctx.createBuffer(1, 4410, 44100)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = ctx.createBufferSource(); src.buffer = buf
  const ng = ctx.createGain(); ng.gain.value = 0.25
  src.connect(ng).connect(master); src.start(t)
}

export function playAlarmBuzz(duration = 2.5) {
  if (!ctx || !master) return
  const t = now()
  const burstLen = 0.18
  const gap = 0.04
  const period = burstLen * 2 + gap * 2
  const bursts = Math.floor(duration / period)
  for (let b = 0; b < bursts; b++) {
    const bt = t + b * period
    const f1 = b % 2 === 0 ? 880 : 660
    const osc = ctx.createOscillator(); const g = ctx.createGain()
    osc.type = 'square'; osc.frequency.value = f1
    g.gain.setValueAtTime(0, bt)
    g.gain.linearRampToValueAtTime(0.35, bt + 0.005)
    g.gain.setValueAtTime(0.35, bt + burstLen)
    g.gain.exponentialRampToValueAtTime(0.001, bt + burstLen + 0.02)
    osc.connect(g).connect(master)
    osc.start(bt); osc.stop(bt + burstLen + 0.03)
    const buf = ctx.createBuffer(1, Math.floor(44100 * burstLen), 44100)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.5
    const src = ctx.createBufferSource(); src.buffer = buf
    const ng = ctx.createGain(); ng.gain.value = 0.12
    src.connect(ng).connect(master); src.start(bt)
  }
}

export function playBell() {
  if (!ctx || !master) return
  const t = now()
  ;[440, 660, 880].forEach((f, i) => {
    const osc = ctx!.createOscillator(); const g = ctx!.createGain()
    osc.type = 'triangle'; osc.frequency.value = f
    g.gain.setValueAtTime(0.25 / (i + 1), t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
    osc.connect(g).connect(master!)
    osc.start(t); osc.stop(t + 0.85)
  })
}

export function playWhisper() {
  if (!ctx || !master) return
  const t = now()
  const buf = ctx.createBuffer(1, 22050, 44100)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(i / 200) * 0.3
  const src = ctx.createBufferSource(); src.buffer = buf
  const filt = ctx.createBiquadFilter()
  filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 5
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.15, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
  src.connect(filt).connect(g).connect(master); src.start(t)
}

export function playPowerup() {
  if (!ctx || !master) return
  const t = now()
  ;[523, 659, 784, 1047].forEach((f, i) => {
    const osc = ctx!.createOscillator(); const g = ctx!.createGain()
    osc.type = 'triangle'; osc.frequency.value = f
    g.gain.setValueAtTime(0, t + i * 0.08)
    g.gain.linearRampToValueAtTime(0.2, t + i * 0.08 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.3)
    osc.connect(g).connect(master!)
    osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.35)
  })
}

export function playPurchase() {
  if (!ctx || !master) return
  const t = now()
  ;[659, 880, 1047].forEach((f, i) => {
    const osc = ctx!.createOscillator(); const g = ctx!.createGain()
    osc.type = 'triangle'; osc.frequency.value = f
    g.gain.setValueAtTime(0, t + i * 0.06)
    g.gain.linearRampToValueAtTime(0.15, t + i * 0.06 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.2)
    osc.connect(g).connect(master!)
    osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.25)
  })
}

export function playError() {
  if (!ctx || !master) return
  const t = now()
  const osc = ctx.createOscillator(); const g = ctx.createGain()
  osc.type = 'square'; osc.frequency.value = 120
  g.gain.setValueAtTime(0.2, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  osc.connect(g).connect(master)
  osc.start(t); osc.stop(t + 0.22)
}

export function playGameOver() {
  if (!ctx || !master) return
  const t = now()
  const osc = ctx.createOscillator(); const g = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(220, t)
  osc.frequency.exponentialRampToValueAtTime(30, t + 2)
  g.gain.setValueAtTime(0.4, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.2)
  osc.connect(g).connect(master)
  osc.start(t); osc.stop(t + 2.3)
}

export function playSlowBreath() {
  if (!ctx || !master) return
  const t = now()
  const dur = 2.2
  const buf = ctx.createBuffer(1, Math.floor(44100 * dur), 44100)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) {
    const phase = i / d.length
    const env = phase < 0.5 ? phase * 2 : (1 - phase) * 2
    d[i] = (Math.random() * 2 - 1) * env * 0.4
  }
  const src = ctx.createBufferSource(); src.buffer = buf
  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'; filt.frequency.value = 300; filt.Q.value = 1
  const g = ctx.createGain(); g.gain.value = 0.5
  const osc = ctx.createOscillator(); const og = ctx.createGain()
  osc.type = 'sine'; osc.frequency.setValueAtTime(70, t)
  osc.frequency.linearRampToValueAtTime(55, t + dur)
  og.gain.setValueAtTime(0, t)
  og.gain.linearRampToValueAtTime(0.12, t + dur * 0.4)
  og.gain.linearRampToValueAtTime(0, t + dur)
  osc.connect(og).connect(master)
  src.connect(filt).connect(g).connect(master)
  src.start(t); osc.start(t); osc.stop(t + dur)
}

export function playFastBreath() {
  if (!ctx || !master) return
  const t = now()
  const burstDur = 0.12
  const gap = 0.06
  const count = 6
  for (let b = 0; b < count; b++) {
    const bt = t + b * (burstDur + gap)
    const buf = ctx.createBuffer(1, Math.floor(44100 * burstDur), 44100)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      const env = (i / d.length) < 0.5 ? (i / d.length) * 2 : (1 - i / d.length) * 2
      d[i] = (Math.random() * 2 - 1) * env * 0.5
    }
    const src = ctx.createBufferSource(); src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'; filt.frequency.value = 500 + b * 80; filt.Q.value = 2
    const g = ctx.createGain(); g.gain.value = 0.4
    src.connect(filt).connect(g).connect(master); src.start(bt)
  }
}

export function playScream() {
  if (!ctx || !master) return
  const ac = ctx
  const t = now()
  const dur = 1.6
  ;[1, 1.01].forEach((mult) => {
    const osc = ac.createOscillator(); const g = ac.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(900 * mult, t)
    osc.frequency.exponentialRampToValueAtTime(120 * mult, t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.35, t + 0.05)
    g.gain.setValueAtTime(0.35, t + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    const lfo = ac.createOscillator(); const lfoG = ac.createGain()
    lfo.frequency.value = 14; lfoG.gain.value = 40
    lfo.connect(lfoG).connect(osc.frequency)
    osc.connect(g).connect(master!)
    osc.start(t); osc.stop(t + dur); lfo.start(t); lfo.stop(t + dur)
  })
  const buf = ac.createBuffer(1, Math.floor(44100 * dur), 44100)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) {
    const env = 1 - i / d.length
    d[i] = (Math.random() * 2 - 1) * env * 0.3
  }
  const src = ac.createBufferSource(); src.buffer = buf
  const filt = ac.createBiquadFilter()
  filt.type = 'highpass'; filt.frequency.value = 800
  const ng = ac.createGain(); ng.gain.value = 0.4
  src.connect(filt).connect(ng).connect(master); src.start(t)
}

export function playMerchant() {
  if (!ctx || !master) return
  const t = now()
  ;[392, 523, 659, 784].forEach((f, i) => {
    const osc = ctx!.createOscillator(); const g = ctx!.createGain()
    osc.type = 'sine'; osc.frequency.value = f
    g.gain.setValueAtTime(0, t + i * 0.12)
    g.gain.linearRampToValueAtTime(0.15, t + i * 0.12 + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.6)
    osc.connect(g).connect(master!)
    osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.65)
  })
}

export function playDodge() {
  if (!ctx || !master) return
  const t = now()
  ;[880, 1320, 1760, 2640].forEach((f, i) => {
    const osc = ctx!.createOscillator(); const g = ctx!.createGain()
    osc.type = 'sine'; osc.frequency.value = f
    g.gain.setValueAtTime(0, t + i * 0.04)
    g.gain.linearRampToValueAtTime(0.15, t + i * 0.04 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.4)
    osc.connect(g).connect(master!)
    osc.start(t + i * 0.04); osc.stop(t + i * 0.04 + 0.45)
  })
}

export function playLuckDodge() {
  if (!ctx || !master) return
  const t = now()
  ;[659, 988, 1319].forEach((f, i) => {
    const osc = ctx!.createOscillator(); const g = ctx!.createGain()
    osc.type = 'triangle'; osc.frequency.value = f
    g.gain.setValueAtTime(0, t + i * 0.05)
    g.gain.linearRampToValueAtTime(0.12, t + i * 0.05 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.3)
    osc.connect(g).connect(master!)
    osc.start(t + i * 0.05); osc.stop(t + i * 0.05 + 0.35)
  })
}

// File-based sound effects (loaded once, cached).
let alarmBuffer: AudioBuffer | null = null
let zombieBuffer: AudioBuffer | null = null
let possessionBuffer: AudioBuffer | null = null
let alarmDone = false
let zombieDone = false
let possessionDone = false
let possessionSrc: AudioBufferSourceNode | null = null
let possessionGain: GainNode | null = null

function loadBuffer(url: string, slot: 'alarm' | 'zombie' | 'possession'): Promise<void> {
  if (!ctx) return Promise.resolve()
  return fetch(url)
    .then((r) => r.arrayBuffer())
    .then((data) => ctx!.decodeAudioData(data))
    .then((buf) => {
      if (slot === 'alarm') alarmBuffer = buf
      else if (slot === 'zombie') zombieBuffer = buf
      else possessionBuffer = buf
    })
    .catch(() => {})
    .then(() => {
      if (slot === 'alarm') alarmDone = true
      else if (slot === 'zombie') zombieDone = true
      else possessionDone = true
    })
}

export function preloadFileSounds() {
  if (!ctx) return
  if (!alarmDone && !alarmBuffer) loadBuffer(alarmUrl, 'alarm')
  if (!zombieDone && !zombieBuffer) loadBuffer(zombieUrl, 'zombie')
  if (!possessionDone && !possessionBuffer) loadBuffer(possessionUrl, 'possession')
}

export function startPossessionLoop() {
  if (!ctx || !master) return
  if (!possessionDone || !possessionBuffer) { loadBuffer(possessionUrl, 'possession').then(() => { if (possessionBuffer) startPossessionLoop() }); return }
  stopPossessionLoop()
  const src = ctx.createBufferSource(); src.buffer = possessionBuffer; src.loop = true
  const g = ctx.createGain(); g.gain.value = 0.75
  src.connect(g).connect(master); src.start()
  possessionSrc = src; possessionGain = g
}

export function stopPossessionLoop() {
  if (possessionSrc) { try { possessionSrc.stop() } catch {} ; possessionSrc = null }
  possessionGain = null
}

export function playAlarmFile() {
  if (!ctx || !master) return
  if (!alarmDone) { playAlarmBuzz(2.5); return }
  if (!alarmBuffer) { playAlarmBuzz(2.5); return }
  const src = ctx.createBufferSource(); src.buffer = alarmBuffer
  const g = ctx.createGain(); g.gain.value = 0.7
  src.connect(g).connect(master); src.start()
}

export function playZombieScream() {
  if (!ctx || !master) return
  if (!zombieDone) { playScream(); return }
  if (!zombieBuffer) { playScream(); return }
  const src = ctx.createBufferSource(); src.buffer = zombieBuffer
  const g = ctx.createGain(); g.gain.value = 0.8
  src.connect(g).connect(master); src.start()
}

// Benedizione di Dio Sveglia — a divine chime when you revive from death.
export function playRevive() {
  if (!ctx || !master) return
  const t = now()
  ;[523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
    const osc = ctx!.createOscillator(); const g = ctx!.createGain()
    osc.type = 'sine'; osc.frequency.value = f
    g.gain.setValueAtTime(0, t + i * 0.1)
    g.gain.linearRampToValueAtTime(0.18, t + i * 0.1 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.8)
    osc.connect(g).connect(master!)
    osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.85)
  })
}

// === Background music (something strange) — low volume, loops during normal play ===
let bgMusicBuffer: AudioBuffer | null = null
let bgMusicDone = false
let bgMusicSrc: AudioBufferSourceNode | null = null
let bgMusicGain: GainNode | null = null

function loadBgMusic(): Promise<void> {
  if (!ctx) return Promise.resolve()
  return fetch(bgMusicUrl)
    .then((r) => r.arrayBuffer())
    .then((data) => ctx!.decodeAudioData(data))
    .then((buf) => { bgMusicBuffer = buf })
    .catch(() => {})
    .then(() => { bgMusicDone = true })
}

export function startBgMusic() {
  if (!ctx || !master) return
  if (!bgMusicDone) { loadBgMusic().then(() => { if (bgMusicBuffer) startBgMusic() }); return }
  if (!bgMusicBuffer) return
  if (bgMusicSrc) return
  const src = ctx.createBufferSource(); src.buffer = bgMusicBuffer; src.loop = true
  const g = ctx.createGain(); g.gain.value = 0.36
  src.connect(g).connect(master); src.start()
  bgMusicSrc = src; bgMusicGain = g
}

export function stopBgMusic() {
  if (bgMusicSrc) { try { bgMusicSrc.stop() } catch {} ; bgMusicSrc = null }
  bgMusicGain = null
}

export function pauseBgMusic() {
  if (bgMusicGain && ctx) bgMusicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
}

export function resumeBgMusic() {
  if (bgMusicGain && ctx) bgMusicGain.gain.linearRampToValueAtTime(0.36, ctx.currentTime + 0.5)
}

// === Menu ticking (wet ticking clock) — loops only while in the menu ===
let menuTickBuffer: AudioBuffer | null = null
let menuTickDone = false
let menuTickSrc: AudioBufferSourceNode | null = null
let menuTickGain: GainNode | null = null

function loadMenuTick(): Promise<void> {
  if (!ctx) return Promise.resolve()
  return fetch(menuTickUrl)
    .then((r) => r.arrayBuffer())
    .then((data) => ctx!.decodeAudioData(data))
    .then((buf) => { menuTickBuffer = buf })
    .catch(() => {})
    .then(() => { menuTickDone = true })
}

export function startMenuTick() {
  if (!ctx || !master) return
  if (!menuTickDone) { loadMenuTick().then(() => { if (menuTickBuffer) startMenuTick() }); return }
  if (!menuTickBuffer) return
  if (menuTickSrc) return
  const src = ctx.createBufferSource(); src.buffer = menuTickBuffer; src.loop = true
  const g = ctx.createGain(); g.gain.value = 0.4
  src.connect(g).connect(master); src.start()
  menuTickSrc = src; menuTickGain = g
}

export function stopMenuTick() {
  if (menuTickSrc) { try { menuTickSrc.stop() } catch {} ; menuTickSrc = null }
  menuTickGain = null
}

// === Horror pad (for Boss 12 — L'Ora Zero) ===
let horrorPadBuffer: AudioBuffer | null = null
let horrorPadDone = false
let horrorPadSrc: AudioBufferSourceNode | null = null
let horrorPadGain: GainNode | null = null

function loadHorrorPad(): Promise<void> {
  if (!ctx) return Promise.resolve()
  return fetch(horrorPadUrl)
    .then((r) => r.arrayBuffer())
    .then((data) => ctx!.decodeAudioData(data))
    .then((buf) => { horrorPadBuffer = buf })
    .catch(() => {})
    .then(() => { horrorPadDone = true })
}

export function startHorrorPad() {
  if (!ctx || !master) return
  if (!horrorPadDone) { loadHorrorPad().then(() => { if (horrorPadBuffer) startHorrorPad() }); return }
  if (!horrorPadBuffer) return
  if (horrorPadSrc) return
  const src = ctx.createBufferSource(); src.buffer = horrorPadBuffer; src.loop = true
  const g = ctx.createGain(); g.gain.value = 0.4
  src.connect(g).connect(master); src.start()
  horrorPadSrc = src; horrorPadGain = g
}

export function stopHorrorPad() {
  if (horrorPadSrc) { try { horrorPadSrc.stop() } catch {} ; horrorPadSrc = null }
  horrorPadGain = null
}
