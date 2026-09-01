/**
 * Session BPM model for camera users after a brief PPG lock.
 * Mimics strap-like drift: gradual warmup rise, then steady target band —
 * not random noise and not claiming live sensor readings.
 */

export function sessionTargetMid(zone) {
  if (!zone) return null
  return Math.round((zone.low + zone.high) / 2)
}

/** Expected BPM at this point in warmup/active (deterministic curve + tiny wobble). */
export function modelSessionBpm({
  baseline,
  zone,
  phase,
  elapsedSec,
  durationSec,
  reduceMotion,
  tick = 0,
}) {
  const base = Number(baseline)
  if (!Number.isFinite(base) || !zone) return base

  const target = sessionTargetMid(zone)
  const elapsed = Math.max(0, elapsedSec)
  const dur = Math.max(1, durationSec)

  if (reduceMotion) {
    if (phase === 'warmup') {
      const p = Math.min(1, elapsed / dur)
      return Math.round(base + (target - base) * p * 0.85)
    }
    return target
  }

  if (phase === 'warmup') {
    const p = Math.min(1, elapsed / dur)
    const eased = p * p * (3 - 2 * p)
    return Math.round(base + (target - base) * eased * 0.88)
  }

  const wobble = Math.sin((elapsed + tick) / 7) * 1.8 + Math.sin((elapsed + tick) / 19) * 0.8
  return Math.round(Math.max(zone.low - 4, Math.min(zone.high + 4, target + wobble)))
}
