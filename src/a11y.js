import { useEffect, useRef, useState } from 'react'

export const SCALE_6_LABELS = {
  0: 'none',
  1: 'barely there',
  2: 'mild',
  3: 'noticeable',
  4: 'getting in the way',
  5: 'strong',
  6: 'severe',
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function useThrottledValue(value, ms = 3000) {
  const [current, setCurrent] = useState(value)
  const latest = useRef(value)
  latest.current = value
  useEffect(() => {
    const id = setInterval(() => setCurrent(latest.current), ms)
    return () => clearInterval(id)
  }, [ms])
  return current
}

export function zoneStatus(bpm, zone) {
  if (bpm < zone.low) return 'below target'
  if (bpm > zone.high) return 'above target'
  return 'in target zone'
}
