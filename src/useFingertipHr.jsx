import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createFingertipMonitor,
  evaluateForceLock,
  evaluateHrLockWithSoft,
  HR_LOCK,
  isLockCandidateBpm,
  isUsableBpm,
  signalQuality,
  smoothDisplayBpm,
} from './hrCamera.js'

const idleLock = () => evaluateHrLockWithSoft([], Date.now(), null)
const LOCK_SAMPLE_MS = 200

/**
 * Live fingertip PPG. Stable smoothed display; locks ~2.5 s after BPM first appears.
 */
export function useFingertipHr({
  enabled,
  showGraph = true,
  trackLock = false,
  preferTorch = false,
  torchMaxMs = 0,
  startDelayMs,
} = {}) {
  const videoRef = useRef(null)
  const sampleRef = useRef(null)
  const graphRef = useRef(null)
  const monitorRef = useRef(null)
  const lockSamplesRef = useRef([])
  const displayHistoryRef = useRef([])
  const contactTimerRef = useRef(null)
  const firstBpmAtRef = useRef(null)
  const lastLockPushRef = useRef(0)
  const [bpm, setBpm] = useState(null)
  const [firstBpmAt, setFirstBpmAt] = useState(null)
  const [quality, setQuality] = useState(() => signalQuality({ average: 0, range: 0 }))
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [hostReady, setHostReady] = useState(false)
  const [torch, setTorch] = useState({ on: false, supported: false })
  const [lock, setLock] = useState(idleLock)
  const [timedOut, setTimedOut] = useState(false)

  const stop = useCallback(() => {
    monitorRef.current?.stop()
    monitorRef.current = null
    window.clearTimeout(contactTimerRef.current)
    contactTimerRef.current = null
  }, [])

  function refreshLock(now = Date.now()) {
    setLock(evaluateHrLockWithSoft(lockSamplesRef.current, now, firstBpmAtRef.current))
  }

  useEffect(() => {
    setHostReady(Boolean(videoRef.current && sampleRef.current))
  })

  function noteFirstBpm(t) {
    if (firstBpmAtRef.current) return
    firstBpmAtRef.current = t
    setFirstBpmAt(t)
    window.clearTimeout(contactTimerRef.current)
    contactTimerRef.current = window.setTimeout(() => {
      const forced = evaluateForceLock(lockSamplesRef.current, Date.now())
      if (forced.locked) {
        setLock(forced)
        return
      }
      setTimedOut(true)
      stop()
    }, HR_LOCK.maxContactMs)
  }

  function pushLockSample(nextBpm, nextQuality, range) {
    if (!trackLock || !isLockCandidateBpm(nextBpm, nextQuality, range)) return
    const t = Date.now()
    if (t - lastLockPushRef.current < LOCK_SAMPLE_MS) return
    lastLockPushRef.current = t
    lockSamplesRef.current.push({ t, bpm: nextBpm, quality: nextQuality, range })
    const cutoff = t - 10000
    lockSamplesRef.current = lockSamplesRef.current.filter((s) => s.t >= cutoff)
    refreshLock(t)
  }

  useEffect(() => {
    if (!enabled || !firstBpmAt || lock.locked || timedOut) return undefined
    const id = window.setInterval(() => refreshLock(), 100)
    return () => window.clearInterval(id)
  }, [enabled, firstBpmAt, lock.locked, timedOut])

  useEffect(() => {
    if (!enabled || !hostReady) {
      stop()
      if (!enabled) {
        setBpm(null)
        setFirstBpmAt(null)
        setReady(false)
        setError(null)
        setTimedOut(false)
        setQuality(signalQuality({ average: 0, range: 0 }))
        setTorch({ on: false, supported: false })
        lockSamplesRef.current = []
        displayHistoryRef.current = []
        lastLockPushRef.current = 0
        firstBpmAtRef.current = null
        setLock(idleLock())
      }
      return undefined
    }

    const video = videoRef.current
    const samplingCanvas = sampleRef.current
    if (!video || !samplingCanvas) return undefined

    let cancelled = false
    lockSamplesRef.current = []
    displayHistoryRef.current = []
    lastLockPushRef.current = 0
    firstBpmAtRef.current = null
    setFirstBpmAt(null)
    setTimedOut(false)
    setLock(idleLock())

    const monitor = createFingertipMonitor({
      videoElement: video,
      samplingCanvas,
      graphCanvas: showGraph ? graphRef.current : null,
      graphColor:
        getComputedStyle(document.documentElement).getPropertyValue('--in').trim() || '#6fa287',
      preferTorch,
      torchMaxMs,
      startDelayMs: startDelayMs ?? (preferTorch ? 400 : undefined),
      onStats: (stats) => {
        if (cancelled) return
        setQuality(stats.quality)
        const now = Date.now()
        const display = smoothDisplayBpm(stats.bpm, displayHistoryRef.current, now)
        setBpm(display)
        if (isUsableBpm(display)) {
          noteFirstBpm(now)
          pushLockSample(display, stats.quality, stats.range ?? 0)
        } else if (firstBpmAtRef.current) {
          refreshLock(now)
        }
        if (
          isLockCandidateBpm(display, stats.quality, stats.range ?? 0) ||
          stats.quality.level === 'good' ||
          stats.quality.level === 'ok'
        ) {
          setReady(true)
        }
      },
      onTorch: (state) => {
        if (!cancelled) setTorch(state)
      },
      onError: (message) => {
        if (!cancelled) {
          setError(message)
          setReady(false)
        }
      },
    })
    monitorRef.current = monitor
    monitor.start()

    return () => {
      cancelled = true
      window.clearTimeout(contactTimerRef.current)
      monitor.stop()
      monitorRef.current = null
    }
  }, [enabled, showGraph, hostReady, trackLock, preferTorch, torchMaxMs, startDelayMs, stop])

  const nodes = (
    <>
      <video ref={videoRef} className="hr-video" playsInline muted autoPlay aria-hidden="true" />
      <canvas ref={sampleRef} className="hr-sample" width={30} height={30} aria-hidden="true" />
      {showGraph ? <canvas ref={graphRef} className="hr-graph" aria-hidden="true" /> : null}
    </>
  )

  return {
    bpm,
    quality,
    error,
    ready,
    nodes,
    usable: isUsableBpm(bpm),
    torch,
    lock,
    timedOut,
    stop,
  }
}
