import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createFingertipMonitor,
  evaluateHrLockWithSoft,
  HR_LOCK,
  isUsableBpm,
  signalQuality,
} from './hrCamera.js'

const idleLock = () => evaluateHrLockWithSoft([])
const LOCK_SAMPLE_MS = 180

/**
 * Live fingertip PPG. Watch-style lock when BPM is stable for a few seconds.
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
  const qualityRef = useRef(signalQuality({ average: 0, range: 0 }))
  const lastLockPushRef = useRef(0)
  const [bpm, setBpm] = useState(null)
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
  }, [])

  useEffect(() => {
    setHostReady(Boolean(videoRef.current && sampleRef.current))
  })

  function pushLockSample(nextBpm, nextQuality) {
    if (!trackLock || !isUsableBpm(nextBpm)) return
    const t = Date.now()
    if (t - lastLockPushRef.current < LOCK_SAMPLE_MS) return
    lastLockPushRef.current = t
    lockSamplesRef.current.push({ t, bpm: nextBpm, quality: nextQuality })
    const cutoff = t - 10000
    lockSamplesRef.current = lockSamplesRef.current.filter((s) => s.t >= cutoff)
    setLock(evaluateHrLockWithSoft(lockSamplesRef.current, t))
  }

  useEffect(() => {
    if (!enabled || !hostReady) {
      stop()
      if (!enabled) {
        setBpm(null)
        setReady(false)
        setError(null)
        setTimedOut(false)
        setQuality(signalQuality({ average: 0, range: 0 }))
        setTorch({ on: false, supported: false })
        lockSamplesRef.current = []
        lastLockPushRef.current = 0
        setLock(idleLock())
      }
      return undefined
    }

    const video = videoRef.current
    const samplingCanvas = sampleRef.current
    if (!video || !samplingCanvas) return undefined

    let cancelled = false
    lockSamplesRef.current = []
    lastLockPushRef.current = 0
    setTimedOut(false)
    setLock(idleLock())

    const contactTimer = window.setTimeout(() => {
      if (cancelled) return
      setTimedOut(true)
      stop()
    }, HR_LOCK.maxContactMs)

    const monitor = createFingertipMonitor({
      videoElement: video,
      samplingCanvas,
      graphCanvas: showGraph ? graphRef.current : null,
      graphColor:
        getComputedStyle(document.documentElement).getPropertyValue('--in').trim() || '#6fa287',
      preferTorch,
      torchMaxMs,
      startDelayMs: startDelayMs ?? (preferTorch ? 400 : undefined),
      onBpmChange: (next) => {
        if (!cancelled) {
          setBpm(next)
          if (isUsableBpm(next)) pushLockSample(next, qualityRef.current)
        }
      },
      onStats: (stats) => {
        if (cancelled) return
        qualityRef.current = stats.quality
        setQuality(stats.quality)
        if (isUsableBpm(stats.bpm)) pushLockSample(stats.bpm, stats.quality)
        if (
          isUsableBpm(stats.bpm) &&
          (stats.quality.level === 'good' ||
            stats.quality.level === 'ok' ||
            stats.quality.level === 'weak' ||
            stats.quality.level === 'noisy')
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
      window.clearTimeout(contactTimer)
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
