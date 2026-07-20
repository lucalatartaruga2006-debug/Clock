export interface RenderOpts {
  hp: number
  maxHp: number
  hour: number
  minute: number
  bossActive: boolean
  bossHp: number
  bossMaxHp: number
  lightOn: boolean
  flicker: boolean
  owned: string[]
  ghostSecond: number
  shake: boolean
  crackIntensity: number
  bossName?: string
  fakeSecondActive: boolean
  alarmVibrate: boolean
  proprietarioActive: boolean
  breathPhase: 'slow' | 'fast' | 'none'
  breathIntensity: number
  merchantActive: boolean
  secondProgress: number
  possessedActive: boolean
  possessedJumpscare: boolean
  possessedDefeated: boolean
  possessedGlitch: number
  possessedTargetHour: number
  possessedTargetMinute: number
  possessedPlayerHour: number
  possessedPlayerMinute: number
  oraZeroActive: boolean
  oraZeroCountdown: number
  oraZeroEyesIntensity: number
}

const VW = 180
const VH = 135

export function drawRoom(ctx: CanvasRenderingContext2D, o: RenderOpts, W: number, H: number) {
  const buf = getBuffer()
  const bctx = buf.getContext('2d')!
  bctx.imageSmoothingEnabled = false
  bctx.save()
  if (o.shake) bctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)
  drawScene(bctx, o)
  bctx.restore()

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const scale = Math.min(W / VW, H / VH)
  const dw = VW * scale, dh = VH * scale
  const dx = (W - dw) / 2, dy = (H - dh) / 2
  ctx.drawImage(buf, dx, dy, dw, dh)
  ctx.restore()
}

let _buf: HTMLCanvasElement | null = null
function getBuffer(): HTMLCanvasElement {
  if (_buf) return _buf
  _buf = document.createElement('canvas')
  _buf.width = VW; _buf.height = VH
  return _buf
}

const C = {
  void: '#050507', wall: '#0c0a12', wallHi: '#14101c', floor: '#0a080e', floorLine: '#120e18',
  shadow: '#000000', stoolDark: '#2a1a0e', stoolMid: '#3a2414', stoolHi: '#5a3a20',
  clockRed: '#c01818', clockRedDark: '#7a0a0a', clockRedHi: '#e84040',
  face: '#d8c8a0', faceDark: '#a89870', faceLine: '#3a0808',
  bell: '#a81818', bellDark: '#600808', hand: '#1a0404', secHand: '#e02020',
  crack: '#1a0606',
  suit: '#1a1a22', suitHi: '#2a2a36', skin: '#9a8a78', skinDark: '#5a4a3a',
  merchant: '#3a2a4a', merchantHi: '#6a4a8a', merchantCloak: '#1a0a2a',
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function drawScene(ctx: CanvasRenderingContext2D, o: RenderOpts) {
  px(ctx, 0, 0, VW, VH, C.void)
  px(ctx, 0, 0, VW, VH * 0.72, C.wall)
  for (let x = 0; x < VW; x += 4) { if ((x * 7) % 13 < 4) px(ctx, x, 0, 1, VH * 0.72, C.wallHi) }
  px(ctx, 0, VH * 0.72, VW, VH * 0.28, C.floor)
  for (let i = 0; i < 6; i++) { px(ctx, 0, VH * 0.72 + i * 6, VW, 1, C.floorLine) }
  px(ctx, 0, VH * 0.72 - 2, VW, 2, C.wallHi)

  const proprietarioDark = o.proprietarioActive
  const lit = proprietarioDark ? false : (o.lightOn && !o.flicker)
  const glowAlpha = proprietarioDark ? 0.02 : (lit ? 0.5 : o.flicker ? 0.12 : 0.04)
  const cx = Math.round(VW / 2)
  const stoolTopY = Math.round(VH * 0.72) - 2
  const clockY = stoolTopY - 26

  if (glowAlpha > 0) {
    drawGlow(ctx, cx, clockY, 60, glowAlpha)
    for (let y = 0; y < clockY; y++) {
      const a = glowAlpha * (0.15 * (1 - y / clockY))
      if (a > 0.01) { ctx.fillStyle = `rgba(80,70,55,${a})`; ctx.fillRect(cx - 14, y, 28, 1) }
    }
  }

  drawStoolPixel(ctx, cx, stoolTopY, lit)

  let clockX = cx, clockCY = clockY
  if (o.alarmVibrate) {
    clockX += (Math.random() - 0.5) * 3
    clockCY += (Math.random() - 0.5) * 3
  }
  drawClockPixel(ctx, clockX, clockCY, o)

  if (o.oraZeroActive) drawOraZeroPixel(ctx, o)
  else if (o.proprietarioActive) drawProprietarioPixel(ctx, o)
  else if (o.possessedActive) drawPossessedBossPixel(ctx, o)
  else if (o.bossActive) drawBossPixel(ctx, clockX, clockCY, o)

  if (o.merchantActive) drawMerchantPixel(ctx)

  if (o.possessedJumpscare) drawJumpscarePixel(ctx)
  if (o.crackIntensity > 0) drawCracksPixel(ctx, o.crackIntensity)
  if (o.possessedGlitch > 0) drawGlitchPixel(ctx, o.possessedGlitch)
  drawVignette(ctx, o.hour, o.bossActive || o.proprietarioActive || o.possessedActive || o.oraZeroActive)
  drawDust(ctx)
}

function drawGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number) {
  for (let i = r; i > 0; i -= 2) {
    const a = alpha * (1 - i / r) * 0.4
    if (a < 0.01) continue
    ctx.fillStyle = `rgba(70,60,48,${a})`
    ctx.beginPath(); ctx.arc(cx, cy, i, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = `rgba(90,78,60,${alpha * 0.5})`
  ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill()
}

function drawStoolPixel(ctx: CanvasRenderingContext2D, cx: number, topY: number, lit: boolean) {
  const sw = 28, sh = 6, sx = cx - sw / 2
  px(ctx, sx + 2, topY - sh, sw - 4, 2, lit ? C.stoolHi : C.stoolDark)
  px(ctx, sx, topY - sh + 2, sw, sh - 2, lit ? C.stoolMid : C.stoolDark)
  px(ctx, sx - 2, topY + 22, sw + 4, 2, C.shadow)
  px(ctx, cx - 10, topY, 3, 22, C.stoolDark)
  px(ctx, cx - 12, topY + 18, 3, 4, C.stoolDark)
  px(ctx, cx + 7, topY, 3, 22, C.stoolDark)
  px(ctx, cx + 9, topY + 18, 3, 4, C.stoolDark)
  px(ctx, cx - 1, topY, 2, 24, C.stoolDark)
  if (lit) {
    px(ctx, cx - 10, topY, 1, 18, C.stoolMid)
    px(ctx, cx + 7, topY, 1, 18, C.stoolMid)
    px(ctx, cx - 1, topY, 1, 20, C.stoolMid)
  }
}

function drawClockPixel(ctx: CanvasRenderingContext2D, cx: number, cy: number, o: RenderOpts) {
  const r = 11
  px(ctx, cx - r, cy + r + 1, r * 2, 2, C.shadow)
  const bellY = cy - r - 3
  drawPixelCircle(ctx, cx - 5, bellY, 3, C.bell)
  drawPixelCircle(ctx, cx + 5, bellY, 3, C.bell)
  px(ctx, cx - 6, bellY - 1, 1, 1, C.clockRedHi)
  px(ctx, cx + 4, bellY - 1, 1, 1, C.clockRedHi)
  px(ctx, cx, cy - r, 1, 4, C.bellDark)
  drawPixelCircle(ctx, cx, cy, r + 1, C.clockRedDark)
  drawPixelCircle(ctx, cx, cy, r, C.clockRed)
  px(ctx, cx - 4, cy - 5, 3, 1, C.clockRedHi)
  drawPixelCircle(ctx, cx, cy, r - 2, C.face)
  px(ctx, cx + 2, cy + 2, 4, 3, C.faceDark)
  px(ctx, cx, cy - 6, 1, 1, C.faceLine)
  px(ctx, cx + 6, cy, 1, 1, C.faceLine)
  px(ctx, cx, cy + 6, 1, 1, C.faceLine)
  px(ctx, cx - 6, cy, 1, 1, C.faceLine)
  for (let i = 0; i < 12; i++) {
    if (i % 3 === 0) continue
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    px(ctx, cx + Math.round(Math.cos(a) * 6), cy + Math.round(Math.sin(a) * 6), 1, 1, C.faceLine)
  }
  const hourAngle = (o.hour / 12) * Math.PI * 2 - Math.PI / 2
  drawHand(ctx, cx, cy, hourAngle, 4, C.hand)
  const minAngle = (o.minute / 60) * Math.PI * 2 - Math.PI / 2
  drawHand(ctx, cx, cy, minAngle, 6, C.hand)
  const secAngle = (o.secondProgress / 60) * Math.PI * 2 - Math.PI / 2
  drawHand(ctx, cx, cy, secAngle, 7, C.secHand)
  px(ctx, cx, cy, 1, 1, C.hand)
  px(ctx, cx, cy, 1, 1, C.secHand)
  if (o.ghostSecond > 0) {
    const a = 0.15 * Math.min(o.ghostSecond, 5)
    ctx.fillStyle = `rgba(180,200,230,${a})`
    ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.fill()
  }
  if (o.fakeSecondActive) {
    const pulse = 0.5 + Math.sin(Date.now() / 80) * 0.3
    ctx.strokeStyle = `rgba(200,30,30,${pulse})`; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.stroke()
  }
}

function drawHand(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, len: number, color: string) {
  const ex = cx + Math.round(Math.cos(angle) * len)
  const ey = cy + Math.round(Math.sin(angle) * len)
  drawPixelLine(ctx, cx, cy, ex, ey, color)
}

function drawPixelLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy, x = x0, y = y0, guard = 0
  while (guard++ < 100) {
    px(ctx, x, y, 1, 1, color)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }
}

function drawPixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) px(ctx, cx + x, cy + y, 1, 1, fill)
}

function drawBossPixel(ctx: CanvasRenderingContext2D, cx: number, cy: number, _o: RenderOpts) {
  ctx.save()
  ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 200) * 0.15
  for (let i = 0; i < 4; i++) {
    const a = (Date.now() / 600 + i * 1.57) % (Math.PI * 2)
    const dist = 22 + Math.sin(Date.now() / 400 + i) * 4
    const gx = cx + Math.round(Math.cos(a) * dist), gy = cy + Math.round(Math.sin(a) * dist)
    drawPixelCircle(ctx, gx, gy, 4, C.clockRedDark)
    for (let t = 0; t < 6; t++) {
      const ta = (t / 6) * Math.PI * 2
      px(ctx, gx + Math.round(Math.cos(ta) * 5), gy + Math.round(Math.sin(ta) * 5), 1, 1, C.clockRedDark)
    }
  }
  ctx.globalAlpha = 0.5
  px(ctx, cx - 6, cy - 14, 12, 10, C.shadow)
  px(ctx, cx - 3, cy - 11, 1, 1, '#ff2020')
  px(ctx, cx + 2, cy - 11, 1, 1, '#ff2020')
  ctx.restore()
}

function drawProprietarioPixel(ctx: CanvasRenderingContext2D, o: RenderOpts) {
  const t = Date.now() / 1000
  const baseX = VW - 40
  const baseY = Math.round(VH * 0.72)
  const breath = o.breathIntensity * Math.sin(t * (o.breathPhase === 'fast' ? 4 : 1.2))

  px(ctx, baseX - 14, baseY + 2, 30, 2, C.shadow)
  const bodyTop = baseY - 34
  px(ctx, baseX - 12, bodyTop + 10, 24, 24, C.suit)
  px(ctx, baseX - 10, bodyTop + 8, 20, 4, C.suitHi)
  px(ctx, baseX - 14, bodyTop + 10, 4, 8, C.suit)
  px(ctx, baseX + 10, bodyTop + 10, 4, 8, C.suit)
  const chestW = 24 + Math.round(breath * 2)
  px(ctx, baseX - chestW / 2, bodyTop + 14, chestW, 10, C.suit)
  px(ctx, baseX - 6, bodyTop + 12, 2, 14, C.suitHi)
  px(ctx, baseX + 4, bodyTop + 12, 2, 14, C.suitHi)
  px(ctx, baseX - 3, bodyTop + 4, 6, 8, C.skinDark)
  const headCX = baseX - 1 + Math.round(Math.sin(t * 0.5) * 1)
  const headCY = bodyTop - 4
  drawPixelCircle(ctx, headCX, headCY, 7, C.skinDark)
  drawPixelCircle(ctx, headCX, headCY, 6, C.skin)
  px(ctx, headCX - 3, headCY - 1, 6, 1, C.skinDark)
  px(ctx, headCX - 2, headCY + 2, 4, 1, C.skinDark)

  ctx.save()
  ctx.globalAlpha = 0.15 + o.breathIntensity * 0.1
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.arc(baseX, bodyTop + 10, 26, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawPossessedBossPixel(ctx: CanvasRenderingContext2D, o: RenderOpts) {
  // Inside the clock mechanism — gears and red eyes floating above
  const t = Date.now() / 1000
  const cx = Math.round(VW / 2)
  const cy = Math.round(VH * 0.35)
  // Dark mechanism background
  ctx.fillStyle = 'rgba(10,5,15,0.6)'; ctx.fillRect(0, 0, VW, VH)
  // Gear teeth rotating
  for (let g = 0; g < 3; g++) {
    const gx = cx + (g - 1) * 30
    const gy = cy + 20 + Math.sin(t * 0.5 + g) * 3
    const gr = 8 + g * 2
    ctx.strokeStyle = `rgba(60,40,60,0.4)`; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * (g % 2 ? 1 : -1) * 0.5
      px(ctx, gx + Math.round(Math.cos(a) * gr), gy + Math.round(Math.sin(a) * gr), 1, 1, 'rgba(80,50,80,0.5)')
    }
  }
  // Two red eyes floating above
  const eyeY = cy - 15 + Math.sin(t * 2) * 2
  const eyePulse = 0.7 + Math.sin(t * 4) * 0.3
  ctx.fillStyle = `rgba(255,20,20,${eyePulse})`
  drawPixelCircle(ctx, cx - 6, eyeY, 3, `rgba(200,10,10,${eyePulse})`)
  drawPixelCircle(ctx, cx + 6, eyeY, 3, `rgba(200,10,10,${eyePulse})`)
  px(ctx, cx - 6, eyeY, 2, 2, `rgba(255,40,40,${eyePulse})`)
  px(ctx, cx + 6, eyeY, 2, 2, `rgba(255,40,40,${eyePulse})`)
  // Glowing aura around eyes
  ctx.save(); ctx.globalAlpha = 0.15 * eyePulse
  ctx.fillStyle = '#ff0000'
  ctx.beginPath(); ctx.arc(cx - 6, eyeY, 8, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + 6, eyeY, 8, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // Target clock face showing what player set
  const fcx = cx, fcy = VH - 30
  drawPixelCircle(ctx, fcx, fcy, 12, C.clockRedDark)
  drawPixelCircle(ctx, fcx, fcy, 10, C.face)
  px(ctx, fcx, fcy - 8, 1, 1, C.faceLine)
  px(ctx, fcx + 8, fcy, 1, 1, C.faceLine)
  px(ctx, fcx, fcy + 8, 1, 1, C.faceLine)
  px(ctx, fcx - 8, fcy, 1, 1, C.faceLine)
  const phAngle = (o.possessedPlayerHour / 12) * Math.PI * 2 - Math.PI / 2
  drawHand(ctx, fcx, fcy, phAngle, 4, C.hand)
  const pmAngle = (o.possessedPlayerMinute / 60) * Math.PI * 2 - Math.PI / 2
  drawHand(ctx, fcx, fcy, pmAngle, 6, C.secHand)
  px(ctx, fcx, fcy, 1, 1, C.hand)
}

function drawJumpscarePixel(ctx: CanvasRenderingContext2D) {
  // Full-screen red eyes in darkness — jumpscare
  const t = Date.now() / 1000
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH)
  const cx = Math.round(VW / 2), cy = Math.round(VH / 2)
  const pulse = 0.8 + Math.sin(t * 8) * 0.2
  // Large red eyes
  ctx.fillStyle = `rgba(255,0,0,${pulse})`
  drawPixelCircle(ctx, cx - 10, cy, 6, `rgba(200,0,0,${pulse})`)
  drawPixelCircle(ctx, cx + 10, cy, 6, `rgba(200,0,0,${pulse})`)
  drawPixelCircle(ctx, cx - 10, cy, 4, `rgba(255,40,40,${pulse})`)
  drawPixelCircle(ctx, cx + 10, cy, 4, `rgba(255,40,40,${pulse})`)
  px(ctx, cx - 10, cy, 3, 3, `rgba(255,80,80,${pulse})`)
  px(ctx, cx + 10, cy, 3, 3, `rgba(255,80,80,${pulse})`)
  // Glow
  ctx.save(); ctx.globalAlpha = 0.2 * pulse; ctx.fillStyle = '#ff0000'
  ctx.beginPath(); ctx.arc(cx - 10, cy, 14, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + 10, cy, 14, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawGlitchPixel(ctx: CanvasRenderingContext2D, intensity: number) {
  const n = Math.floor(intensity * 20) + 5
  for (let i = 0; i < n; i++) {
    const y = (i * 17) % VH
    const h = 1 + (i % 3)
    const x = (i * 53) % VW
    ctx.fillStyle = `rgba(255,0,0,${intensity * 0.3})`
    ctx.fillRect(x, y, 2 + (i % 5), h)
  }
  if (intensity > 0.5) {
    ctx.fillStyle = `rgba(0,0,0,${(intensity - 0.5) * 0.4})`
    ctx.fillRect(0, 0, VW, VH)
  }
}

function drawMerchantPixel(ctx: CanvasRenderingContext2D) {
  const t = Date.now() / 1000
  const baseX = 30
  const baseY = Math.round(VH * 0.72)
  const float = Math.round(Math.sin(t * 1.5) * 2)

  px(ctx, baseX - 12, baseY + 2, 26, 2, C.shadow)
  const bodyTop = baseY - 30 + float
  px(ctx, baseX - 10, bodyTop + 8, 20, 22, C.merchantCloak)
  px(ctx, baseX - 12, bodyTop + 12, 24, 16, C.merchantCloak)
  px(ctx, baseX - 8, bodyTop + 6, 16, 4, C.merchant)
  drawPixelCircle(ctx, baseX, bodyTop + 2, 8, C.merchantCloak)
  drawPixelCircle(ctx, baseX, bodyTop + 2, 7, C.merchant)
  const eyePulse = 0.6 + Math.sin(t * 3) * 0.3
  ctx.fillStyle = `rgba(180,120,255,${eyePulse})`
  px(ctx, baseX - 3, bodyTop + 1, 2, 1, `rgba(180,120,255,${eyePulse})`)
  px(ctx, baseX + 2, bodyTop + 1, 2, 1, `rgba(180,120,255,${eyePulse})`)
  px(ctx, baseX + 8, bodyTop + 14, 6, 8, C.merchantHi)
  px(ctx, baseX + 9, bodyTop + 15, 4, 6, C.merchant)
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#6a4a8a'
  ctx.beginPath(); ctx.arc(baseX, bodyTop + 14, 22, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawCracksPixel(ctx: CanvasRenderingContext2D, intensity: number) {
  ctx.fillStyle = `rgba(0,0,0,${0.3 + intensity * 0.4})`
  const n = Math.floor(intensity * 8) + 2
  for (let i = 0; i < n; i++) {
    let x = (i * 53) % VW, y = (i * 31) % VH
    for (let s = 0; s < 5; s++) { px(ctx, x, y, 1, 1, C.crack); x += (i % 3) - 1; y += 1 + (i % 2) }
  }
  if (intensity > 0.5) { ctx.fillStyle = `rgba(122,14,14,${(intensity - 0.5) * 0.3})`; ctx.fillRect(0, 0, VW, VH) }
}

function drawVignette(ctx: CanvasRenderingContext2D, hour: number, boss: boolean) {
  const darkness = Math.min(0.92, 0.5 + hour * 0.02 + (boss ? 0.15 : 0))
  const cx = VW / 2, cy = VH / 2
  const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(VW, VH) / 1.2)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, `rgba(0,0,0,${darkness})`)
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VW, VH)
}

function drawDust(ctx: CanvasRenderingContext2D) {
  const t = Date.now() / 1000
  for (let i = 0; i < 6; i++) {
    const x = VW / 2 + Math.sin(t * 0.3 + i * 1.7) * 16
    const y = (VH * 0.3) + ((t * 8 + i * 20) % (VH * 0.4))
    const a = 0.15 + Math.sin(t + i) * 0.1
    px(ctx, x, y, 1, 1, `rgba(120,110,90,${a})`)
  }
}

function drawOraZeroPixel(ctx: CanvasRenderingContext2D, o: RenderOpts) {
  const t = Date.now() / 1000
  // Near-total darkness — only the clock is dimly lit
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, VW, VH)
  // Faint clock glow
  const clockX = VW / 2, clockCY = VH * 0.42
  const glowR = 30 + Math.sin(t * 2) * 3
  const grad = ctx.createRadialGradient(clockX, clockCY, 0, clockX, clockCY, glowR)
  grad.addColorStop(0, 'rgba(80,20,20,0.3)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VW, VH)
  // Draw the clock faintly
  const clockR = 18
  ctx.strokeStyle = '#3a1010'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(clockX, clockCY, clockR, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#1a0808'; ctx.beginPath(); ctx.arc(clockX, clockCY, clockR - 2, 0, Math.PI * 2); ctx.fill()
  // Clock hands
  const ha = (o.hour % 12) / 12 * Math.PI * 2 - Math.PI / 2
  const ma = o.minute / 60 * Math.PI * 2 - Math.PI / 2
  ctx.strokeStyle = '#5a2020'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(clockX, clockCY)
  ctx.lineTo(clockX + Math.cos(ha) * clockR * 0.5, clockCY + Math.sin(ha) * clockR * 0.5); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(clockX, clockCY)
  ctx.lineTo(clockX + Math.cos(ma) * clockR * 0.7, clockCY + Math.sin(ma) * clockR * 0.7); ctx.stroke()
  // Two enormous red eyes watching
  const eyeY = VH * 0.25
  const eyeSpacing = 25
  const intensity = o.oraZeroEyesIntensity
  const flicker = 0.7 + Math.sin(t * 8) * 0.3
  for (const side of [-1, 1]) {
    const ex = VW / 2 + side * eyeSpacing
    // Eye glow
    const eg = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, 12)
    eg.addColorStop(0, `rgba(255,0,0,${0.6 * intensity * flicker})`)
    eg.addColorStop(0.5, `rgba(180,0,0,${0.3 * intensity * flicker})`)
    eg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = eg; ctx.fillRect(ex - 15, eyeY - 10, 30, 20)
    // Eye pupil
    ctx.fillStyle = `rgba(255,${20 + Math.sin(t * 3) * 20},0,${intensity * flicker})`
    ctx.beginPath(); ctx.ellipse(ex, eyeY, 5, 7, 0, 0, Math.PI * 2); ctx.fill()
  }
  // Glitch lines in last 30 seconds
  if (o.oraZeroCountdown < 30) {
    for (let i = 0; i < 3; i++) {
      const gy = Math.random() * VH
      const gh = 1 + Math.random() * 3
      ctx.fillStyle = `rgba(255,0,0,${0.1 + Math.random() * 0.2})`
      ctx.fillRect(0, gy, VW, gh)
    }
  }
  // Countdown text area (rendered in React overlay, but add visual tension)
  if (o.oraZeroCountdown < 10) {
    ctx.fillStyle = `rgba(255,0,0,${0.3 + Math.sin(t * 10) * 0.2})`
    ctx.fillRect(0, VH - 4, VW, 4)
  }
}
