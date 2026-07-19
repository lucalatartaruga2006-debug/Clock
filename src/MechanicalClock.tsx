import { useRef, useState, useCallback, useEffect } from 'react'

interface Props {
  hour: number
  minute: number
  onHourChange: (h: number) => void
  onMinuteChange: (m: number) => void
  size?: number
}

export function MechanicalClock({ hour, minute, onHourChange, onMinuteChange, size = 280 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<'hour' | 'minute' | null>(null)
  const center = size / 2

  const getAngle = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current; if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90
    if (angle < 0) angle += 360
    return angle
  }, [])

  const onPointerDown = (e: React.PointerEvent, hand: 'hour' | 'minute') => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(hand)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const angle = getAngle(e.clientX, e.clientY)
      if (dragging === 'hour') {
        const h = Math.round(angle / 30) || 12
        onHourChange(h > 12 ? h - 12 : h < 1 ? 12 : h)
      } else {
        const m = Math.round(angle / 6) % 60
        onMinuteChange(m)
      }
    }
    const onUp = () => setDragging(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [dragging, getAngle, onHourChange, onMinuteChange])

  const hourAngle = (hour % 12) * 30 - 90
  const minuteAngle = minute * 6 - 90
  const hourRad = (hourAngle * Math.PI) / 180
  const minRad = (minuteAngle * Math.PI) / 180
  const hourLen = size * 0.22
  const minLen = size * 0.32
  const hourX = center + Math.cos(hourRad) * hourLen
  const hourY = center + Math.sin(hourRad) * hourLen
  const minX = center + Math.cos(minRad) * minLen
  const minY = center + Math.sin(minRad) * minLen

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="touch-none select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Outer ring */}
      <circle cx={center} cy={center} r={size * 0.46} fill="#1a0a0a" stroke="#8b2020" strokeWidth={3} />
      <circle cx={center} cy={center} r={size * 0.42} fill="#0d0505" stroke="#5a1010" strokeWidth={1} />
      {/* Hour markers */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180)
        const r1 = size * 0.38
        const r2 = size * 0.34
        const x1 = center + Math.cos(a) * r1
        const y1 = center + Math.sin(a) * r1
        const x2 = center + Math.cos(a) * r2
        const y2 = center + Math.sin(a) * r2
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c4a070" strokeWidth={i % 3 === 0 ? 3 : 1.5} />
      })}
      {/* Numbers */}
      {Array.from({ length: 12 }, (_, i) => {
        const num = i + 1
        const a = (num * 30 - 90) * (Math.PI / 180)
        const r = size * 0.30
        const x = center + Math.cos(a) * r
        const y = center + Math.sin(a) * r
        return (
          <text key={i} x={x} y={y} fill="#c4a070" fontSize={size * 0.06} fontFamily="monospace"
            textAnchor="middle" dominantBaseline="central">{num}</text>
        )
      })}
      {/* Minute hand (long, red) - draggable */}
      <line x1={center} y1={center} x2={minX} y2={minY} stroke="#cc3333" strokeWidth={4} strokeLinecap="round" />
      <circle cx={minX} cy={minY} r={14} fill="#cc3333" stroke="#ff6666" strokeWidth={2}
        className="cursor-grab active:cursor-grabbing" style={{ cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown(e, 'minute')} />
      {/* Hour hand (short, gold) - draggable */}
      <line x1={center} y1={center} x2={hourX} y2={hourY} stroke="#c4a070" strokeWidth={5} strokeLinecap="round" />
      <circle cx={hourX} cy={hourY} r={12} fill="#c4a070" stroke="#e4c090" strokeWidth={2}
        className="cursor-grab active:cursor-grabbing" style={{ cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown(e, 'hour')} />
      {/* Center pivot */}
      <circle cx={center} cy={center} r={6} fill="#8b2020" stroke="#c4a070" strokeWidth={1.5} />
    </svg>
  )
}
