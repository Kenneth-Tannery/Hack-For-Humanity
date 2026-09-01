/**
 * Fingertip camera PPG — same method as richrd/heart-rate-monitor (MIT).
 *
 * Flash/torch: browsers only expose on/off (no brightness or true fade). On connect
 * we pulse the LED — on ~4.5 s, off ~0.5 s — to reduce finger burn while keeping
 * enough light for PPG. BPM sampling pauses briefly during the off phase.
 */

const IMAGE_WIDTH = 30
const IMAGE_HEIGHT = 30
const MAX_SAMPLES = 60 * 5
const START_DELAY_MS = 1500
/** Sample without torch before turning the LED on. */
const AMBIENT_TRIAL_MS = 900
/** richrd good-range lower bound — below this needs fill light. */
const DARK_THRESHOLD = 0.045
/** Re-assert torch if Android drops it (continuous mode only). */
const TORCH_KEEPALIVE_MS = 4000
/** Pulse cycle on connect — on duration then brief off for heat relief. */
export const TORCH_PULSE = {
  onMs: 4500,
  offMs: 500,
}
/** Safety cap — web torch ignores phone “flashlight brightness” settings and runs at full LED power. */
const TORCH_MAX_MS = 12000

function averageBrightness(canvas, context) {
  const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data
  let sum = 0
  for (let i = 0; i < pixelData.length; i += 4) {
    sum += pixelData[i] + pixelData[i + 1]
  }
  const avg = sum / (pixelData.length * 0.5)
  return avg / 255
}

function getAverageCrossings(samples, average) {
  const crossings = []
  let previous = samples[0]
  for (let i = 1; i < samples.length; i += 1) {
    const current = samples[i]
    if (current.value < average && previous.value > average) {
      crossings.push(current)
    }
    previous = current
  }
  return crossings
}

function analyzeData(samples) {
  if (!samples.length) {
    return { average: 0, min: 0, max: 0, range: 0, crossings: [] }
  }
  const average = samples.reduce((a, s) => a + s.value, 0) / samples.length
  let min = samples[0].value
  let max = samples[0].value
  for (const sample of samples) {
    if (sample.value > max) max = sample.value
    if (sample.value < min) min = sample.value
  }
  const range = max - min
  return {
    average,
    min,
    max,
    range,
    crossings: getAverageCrossings(samples, average),
  }
}

function calculateBpm(crossings) {
  if (crossings.length < 2) return null
  const averageInterval =
    (crossings[crossings.length - 1].time - crossings[0].time) / (crossings.length - 1)
  if (!averageInterval || averageInterval <= 0) return null
  return 60000 / averageInterval
}

/** Stable number for UI — median of recent raw readings, holds briefly through gaps. */
export function smoothDisplayBpm(raw, history, now = Date.now()) {
  const HOLD_MS = 900
  const MAX_HISTORY = 12
  if (isUsableBpm(raw)) {
    history.push({ bpm: raw, t: now })
    while (history.length > MAX_HISTORY) history.shift()
  }
  const recent = history.filter((s) => now - s.t <= 2500).map((s) => s.bpm)
  if (recent.length >= 2) return median(recent)
  if (recent.length === 1) return recent[0]
  const last = history[history.length - 1]
  if (last && now - last.t <= HOLD_MS) return last.bpm
  return null
}

/** Map richrd’s “good range ~0.002–0.02” into UI labels. */
export function signalQuality({ average, range }) {
  if (average < 0.04) {
    return { level: 'poor', label: 'Too dark — cover the lens' }
  }
  if (average > 0.92) {
    if (range >= 0.0015) {
      return { level: 'ok', label: 'OK — hold steady' }
    }
    return { level: 'poor', label: 'Too bright — cover flash and lens' }
  }
  if (range < 0.0015) {
    return { level: 'weak', label: 'Waiting for a pulse signal' }
  }
  if (range > 0.06) {
    return { level: 'noisy', label: 'Hold steadier' }
  }
  if (range >= 0.002 && range <= 0.02) {
    return { level: 'good', label: 'Good' }
  }
  return { level: 'ok', label: 'OK' }
}

export function isUsableBpm(bpm) {
  const n = Number(bpm)
  return Number.isFinite(n) && n >= 40 && n <= 180
}

/** Watch-style lock — tuned for short fingertip contact (flash heat). */
export const HR_LOCK = {
  windowMs: 4000,
  maxSpread: 32,
  minSamples: 2,
  excludeQuality: ['poor'],
  /** Lock this long after the UI first shows a BPM (2–3 sec window). */
  lockAfterBpmMs: 2500,
  /** UI: max wait after first BPM before try again. */
  maxContactMs: 12000,
  holdMs: 400,
  /** Resting connect — expected before exercise. */
  restingMaxBpm: 120,
  restingHardMaxBpm: 135,
}


function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function robustMedian(values) {
  if (!values.length) return null
  if (values.length < 3) return median(values)
  const m = median(values)
  const trimmed = values.filter((v) => Math.abs(v - m) <= 28)
  return median(trimmed.length ? trimmed : values)
}

/** Samples eligible for lock — filters flash noise and “too dark”. */
export function isLockCandidateBpm(bpm, quality, range = 0) {
  if (!isUsableBpm(bpm)) return false
  const n = Number(bpm)
  const level = quality?.level
  const label = quality?.label || ''
  if (level === 'poor' && label.includes('Too dark')) return false
  if (n > HR_LOCK.restingHardMaxBpm) return false
  if (n > HR_LOCK.restingMaxBpm) {
    return level === 'good' || level === 'ok' || level === 'noisy'
  }
  return true
}

function lockEligible(samples, now = Date.now()) {
  return samples.filter(
    (s) =>
      now - s.t <= HR_LOCK.windowMs &&
      isLockCandidateBpm(s.bpm, s.quality, s.range ?? 0),
  )
}

/** Last resort when contact timer fires but a resting-ish signal was visible. */
export function evaluateForceLock(samples, now = Date.now()) {
  const recent = samples.filter((s) => now - s.t <= HR_LOCK.windowMs && isUsableBpm(s.bpm))
  if (!recent.length) {
    return { phase: 'searching', locked: false, lockedBpm: null, progress: 0, spread: null }
  }
  const candidates = recent.filter((s) => isLockCandidateBpm(s.bpm, s.quality, s.range ?? 0))
  const pool = candidates.length ? candidates : recent.filter((s) => s.bpm <= HR_LOCK.restingHardMaxBpm)
  if (!pool.length) {
    return { phase: 'searching', locked: false, lockedBpm: null, progress: 0, spread: null }
  }
  const bpms = pool.map((s) => s.bpm)
  return {
    phase: 'locked',
    locked: true,
    lockedBpm: robustMedian(bpms),
    progress: 1,
    spread: Math.max(...bpms) - Math.min(...bpms),
    soft: true,
    forced: true,
  }
}

/**
 * Lock once a BPM has been visible for lockAfterBpmMs (~2.5 s).
 * @param {number | null} firstBpmAt — when any BPM first appeared on screen
 */
export function evaluateHrLock(samples, now = Date.now(), firstBpmAt = null) {
  if (!firstBpmAt) {
    return { phase: 'searching', locked: false, lockedBpm: null, progress: 0, spread: null }
  }

  const elapsed = now - firstBpmAt
  const progress = Math.min(1, elapsed / HR_LOCK.lockAfterBpmMs)
  const usable = lockEligible(samples, now)

  if (!usable.length) {
    return { phase: 'measuring', locked: false, lockedBpm: null, progress, spread: null }
  }

  const bpms = usable.map((s) => s.bpm)
  const spread = Math.max(...bpms) - Math.min(...bpms)

  if (elapsed < HR_LOCK.lockAfterBpmMs) {
    return { phase: 'measuring', locked: false, lockedBpm: null, progress, spread }
  }

  if (usable.length >= HR_LOCK.minSamples && spread <= HR_LOCK.maxSpread) {
    return {
      phase: 'locked',
      locked: true,
      lockedBpm: robustMedian(bpms),
      progress: 1,
      spread,
      soft: false,
    }
  }

  return {
    phase: 'locked',
    locked: true,
    lockedBpm: robustMedian(bpms),
    progress: 1,
    spread,
    soft: true,
    timed: true,
  }
}

/** @deprecated alias — use evaluateHrLock with firstBpmAt */
export function evaluateHrLockWithSoft(samples, now = Date.now(), firstBpmAt = null) {
  return evaluateHrLock(samples, now, firstBpmAt)
}

function pickTrack(stream) {
  return stream?.getVideoTracks?.()[0] || null
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Wait until Chrome exposes ImageCapture-style caps (torch often appears late). */
async function waitForTrackCaps(track, tries = 12) {
  for (let i = 0; i < tries; i += 1) {
    const caps = track?.getCapabilities?.() || {}
    if (Object.keys(caps).length > 0) return caps
    await sleep(80)
  }
  return track?.getCapabilities?.() || {}
}

/**
 * Minimum sensor gain while torch is on (does not dim the LED — only how hard
 * the camera “looks”). Keeps the image from clipping when the LED is full power.
 */
async function softenCaptureKeepingTorch(track, torchOn, { preferMin = true } = {}) {
  if (!track?.getCapabilities) return false
  const caps = await waitForTrackCaps(track)
  const bundle = {}
  if (torchOn && caps.torch) bundle.torch = true

  const pick = (range, towardMin = true) => {
    if (typeof range !== 'object') return null
    const { min, max } = range
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    if (towardMin) return min
    return min + (max - min) * 0.2
  }

  const towardMin = preferMin
  if (caps.exposureMode?.includes?.('manual')) bundle.exposureMode = 'manual'
  const expComp = pick(caps.exposureCompensation, towardMin)
  if (expComp != null) bundle.exposureCompensation = expComp
  if (typeof caps.exposureTime === 'object' && Number.isFinite(caps.exposureTime.min)) {
    const { min, max } = caps.exposureTime
    bundle.exposureTime = towardMin ? min : min + (max - min) * 0.15
  }
  const bright = pick(caps.brightness, towardMin)
  if (bright != null) bundle.brightness = bright
  const iso = pick(caps.iso, towardMin)
  if (iso != null) bundle.iso = iso

  if (!Object.keys(bundle).length) return false
  try {
    await track.applyConstraints({ advanced: [bundle] })
    return true
  } catch {
    return false
  }
}

/**
 * Turn torch on/off — same shape as richrd/heart-rate-monitor:
 * track.applyConstraints({ advanced: [{ torch }] })
 * Success = apply did not throw (Chromium often omits settings.torch even when lit).
 */
async function applyTorch(track, on) {
  if (!track) return false
  await waitForTrackCaps(track)
  try {
    await track.applyConstraints({ advanced: [{ torch: on }] })
    return true
  } catch {
    try {
      await track.applyConstraints({ torch: on })
      return true
    } catch {
      return false
    }
  }
}

/**
 * Create a monitor instance. Pass DOM nodes from React refs.
 * @returns {{ start: Function, stop: Function, isRunning: Function }}
 */
export function createFingertipMonitor({
  videoElement,
  samplingCanvas,
  graphCanvas,
  graphColor = '#6fa287',
  graphWidth = 2.5,
  onBpmChange,
  onStats,
  onError,
  onTorch,
  onTorchLimit,
  onSignalStart,
  torchMaxMs = 0,
  preferTorch = false,
  torchPulse = preferTorch,
  preferEnvironment = true,
  startDelayMs = START_DELAY_MS,
}) {
  const samples = []
  let stream = null
  let running = false
  let raf = 0
  let startTimer = 0
  let torchTimer = 0
  let torchPulseTimer = 0
  let torchLimitTimer = 0
  let torchOn = false
  let torchMode = 'off' // 'off' | 'ambient' | 'continuous' | 'pulse' | 'limit'
  let torchSupported = false
  let signalStarted = false
  const samplingContext = samplingCanvas.getContext('2d', { willReadFrequently: true })
  const graphContext = graphCanvas ? graphCanvas.getContext('2d') : null

  function drawGraph(dataStats) {
    if (!graphContext || !graphCanvas) return
    const width = graphCanvas.width
    const height = graphCanvas.height
    if (!width || !height) return
    const xScaling = width / MAX_SAMPLES
    const xOffset = (MAX_SAMPLES - samples.length) * xScaling
    graphContext.lineWidth = graphWidth
    graphContext.strokeStyle = graphColor
    graphContext.lineCap = 'round'
    graphContext.lineJoin = 'round'
    graphContext.clearRect(0, 0, width, height)
    graphContext.beginPath()
    const maxHeight = height - graphContext.lineWidth * 2
    let previousY = 0
    samples.forEach((sample, i) => {
      const x = xScaling * i + xOffset
      let y = graphContext.lineWidth
      if (sample.value !== 0 && dataStats.max !== dataStats.min) {
        y =
          (maxHeight * (sample.value - dataStats.min)) / (dataStats.max - dataStats.min) +
          graphContext.lineWidth
      }
      if (i === 0) graphContext.moveTo(x, y)
      else if (y !== previousY) graphContext.lineTo(x, y)
      previousY = y
    })
    graphContext.stroke()
  }

  function processFrame() {
    samplingContext.drawImage(videoElement, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT)
    const value = averageBrightness(samplingCanvas, samplingContext)
    samples.push({ value, time: Date.now() })
    if (samples.length > MAX_SAMPLES) samples.shift()
    const dataStats = analyzeData(samples)

    if (torchMode === 'pulse' && !torchOn) {
      onStats?.({
        ...dataStats,
        bpm: null,
        quality: { level: 'weak', label: 'Flash resting…' },
        torchOn,
      })
      drawGraph(dataStats)
      return
    }

    const bpm = calculateBpm(dataStats.crossings)
    const rounded = bpm ? Math.round(bpm) : null
    const quality = signalQuality(dataStats)
    if (!signalStarted && (rounded || dataStats.range >= 0.0015)) {
      signalStarted = true
      onSignalStart?.()
    }
    if (rounded && isUsableBpm(rounded)) onBpmChange?.(rounded)
    onStats?.({
      ...dataStats,
      bpm: rounded,
      quality,
      torchOn,
    })
    drawGraph(dataStats)
  }

  function loop() {
    if (!running) return
    processFrame()
    raf = window.requestAnimationFrame(loop)
  }

  function emitTorch(extra = {}) {
    onTorch?.({
      on: torchOn,
      supported: torchSupported,
      mode: torchMode,
      label: pickTrack(stream)?.label || '',
      ...extra,
    })
  }

  async function setTorch(on) {
    const track = pickTrack(stream)
    const ok = await applyTorch(track, on)
    const caps = track?.getCapabilities?.() || {}
    const settings = track?.getSettings?.() || {}
    torchSupported = Boolean(caps.torch) || 'torch' in settings || ok
    torchOn = on && ok
    emitTorch()
    return ok
  }

  /** One brightness probe without changing torch state. */
  function probeBrightness() {
    if (!videoElement?.videoWidth) return 0
    samplingContext.drawImage(videoElement, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT)
    return averageBrightness(samplingCanvas, samplingContext)
  }

  async function decideTorchMode() {
    await setTorch(false)
    torchMode = 'off'
    emitTorch()

    const track = pickTrack(stream)
    const caps = await waitForTrackCaps(track)
    torchSupported = Boolean(caps.torch)

    // Connect screen: user expects flash for fingertip PPG — don’t skip torch based on
    // pre-finger room brightness (that was leaving the LED off after finger covers lens).
    if (preferTorch && torchSupported) {
      torchMode = torchPulse ? 'pulse' : 'continuous'
      await setTorch(true)
      await softenCaptureKeepingTorch(track, true, { preferMin: true })
      await setTorch(true)
      emitTorch()
      startTorchLimitIfNeeded()
      loop()
      if (torchPulse) startTorchPulse()
      else startTorchKeepalive()
      return
    }

    const readings = []
    const end = Date.now() + AMBIENT_TRIAL_MS
    while (Date.now() < end && running) {
      readings.push(probeBrightness())
      await sleep(80)
    }
    if (!running) return

    const ambient = readings.length
      ? readings.reduce((a, v) => a + v, 0) / readings.length
      : 0

    // Only skip torch when the lens already sees enough light without the LED.
    if (ambient >= DARK_THRESHOLD && ambient < 0.8) {
      torchMode = 'ambient'
      torchOn = false
      emitTorch({ ambientOk: true })
      loop()
      return
    }

    if (!torchSupported) {
      torchMode = 'off'
      emitTorch()
      loop()
      return
    }

    torchMode = torchPulse ? 'pulse' : 'continuous'
    await setTorch(true)
    await softenCaptureKeepingTorch(track, true, { preferMin: true })
    await setTorch(true)
    emitTorch()
    startTorchLimitIfNeeded()
    loop()
    if (torchPulse) startTorchPulse()
    else startTorchKeepalive()
  }

  function stopTorchPulse() {
    window.clearTimeout(torchPulseTimer)
    torchPulseTimer = 0
  }

  function startTorchPulse() {
    window.clearInterval(torchTimer)
    stopTorchPulse()
    if (!running || torchMode !== 'pulse') return

    const runOnPhase = async () => {
      if (!running || torchMode !== 'pulse') return
      await setTorch(true)
      torchPulseTimer = window.setTimeout(async () => {
        if (!running || torchMode !== 'pulse') return
        await setTorch(false)
        emitTorch({ pulseRest: true })
        torchPulseTimer = window.setTimeout(() => {
          if (running && torchMode === 'pulse') runOnPhase()
        }, TORCH_PULSE.offMs)
      }, TORCH_PULSE.onMs)
    }

    runOnPhase()
  }

  function startTorchKeepalive() {
    stopTorchPulse()
    window.clearInterval(torchTimer)
    torchTimer = window.setInterval(() => {
      if (running && torchMode === 'continuous') setTorch(true)
    }, TORCH_KEEPALIVE_MS)
  }

  function startTorchLimitIfNeeded() {
    if (torchMaxMs <= 0) return
    window.clearTimeout(torchLimitTimer)
    torchLimitTimer = window.setTimeout(async () => {
      if (!running || (torchMode !== 'continuous' && torchMode !== 'pulse')) return
      await setTorch(false)
      torchMode = 'limit'
      stopTorchPulse()
      window.clearInterval(torchTimer)
      emitTorch({ limited: true })
      onTorchLimit?.()
    }, torchMaxMs)
  }

  function baseVideoConstraints(deviceId) {
    const base = {
      // Match richrd: tiny capture + manual modes help PPG; torch is separate.
      width: { ideal: IMAGE_WIDTH },
      height: { ideal: IMAGE_HEIGHT },
      facingMode: preferEnvironment ? ['environment', 'user'] : ['user', 'environment'],
      whiteBalanceMode: 'manual',
      exposureMode: 'manual',
      focusMode: 'manual',
    }
    if (deviceId) base.deviceId = { exact: deviceId }
    return base
  }

  async function openStreamForDevice(deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: baseVideoConstraints(deviceId),
        audio: false,
      })
    } catch {
      // Manual modes / tiny size fail on some devices — fall back.
      return navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, facingMode: { ideal: 'environment' } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      })
    }
  }

  /**
   * richrd picks the last videoinput. We also try rear-labeled cams first, then
   * every camera until one accepts torch (multi-lens phones often put torch on one module).
   */
  async function openCamera() {
    // Unlock labels (richrd assumes permission; we probe first).
    try {
      const probe = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      probe.getTracks().forEach((t) => t.stop())
    } catch {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        probe.getTracks().forEach((t) => t.stop())
      } catch {
        /* enumerate may still work */
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras = devices.filter((d) => d.kind === 'videoinput' && d.deviceId)
    const rear = cameras.filter((c) => /back|rear|environment|trás|arrière|背面|後/i.test(c.label || ''))
    // Last cam first (richrd), then other rear, then remaining.
    const ordered = []
    const pushUnique = (c) => {
      if (c && !ordered.some((x) => x.deviceId === c.deviceId)) ordered.push(c)
    }
    if (rear.length) pushUnique(rear[rear.length - 1])
    if (cameras.length) pushUnique(cameras[cameras.length - 1])
    ;[...rear].reverse().forEach(pushUnique)
    ;[...cameras].reverse().forEach(pushUnique)
    if (!ordered.length) ordered.push(null)

    let best = null
    for (const cam of ordered) {
      let candidate
      try {
        candidate = await openStreamForDevice(cam?.deviceId)
      } catch {
        continue
      }
      const track = pickTrack(candidate)
      await waitForTrackCaps(track)
      const lit = await applyTorch(track, true)
      if (lit) {
        if (best) best.getTracks().forEach((t) => t.stop())
        await applyTorch(track, false)
        return candidate
      }
      // Keep first stream as fallback if nothing supports torch.
      if (!best) best = candidate
      else candidate.getTracks().forEach((t) => t.stop())
    }
    if (best) return best
    return openStreamForDevice(undefined)
  }

  async function start() {
    if (running) return
    samples.length = 0
    signalStarted = false
    onBpmChange?.(null)
    torchOn = false

    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.('This browser cannot use the camera.')
      return
    }

    try {
      stream = await openCamera()
    } catch (err) {
      onError?.(err?.message || 'Camera permission was denied.')
      return
    }

    samplingCanvas.width = IMAGE_WIDTH
    samplingCanvas.height = IMAGE_HEIGHT
    if (graphCanvas) {
      graphCanvas.width = graphCanvas.clientWidth || 320
      graphCanvas.height = graphCanvas.clientHeight || 120
    }

    // Start without torch — decide after ambient trial (cooler when room light is enough).
    videoElement.srcObject = stream
    videoElement.muted = true
    videoElement.playsInline = true
    await videoElement.play().catch(() => {})

    running = true

    startTimer = window.setTimeout(() => {
      if (running) decideTorchMode()
    }, startDelayMs)
  }

  async function stop() {
    running = false
    window.clearTimeout(startTimer)
    window.clearTimeout(torchLimitTimer)
    stopTorchPulse()
    window.clearInterval(torchTimer)
    window.cancelAnimationFrame(raf)
    await setTorch(false)
    if (videoElement) {
      videoElement.pause()
      videoElement.srcObject = null
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
    torchOn = false
    torchMode = 'off'
    emitTorch()
  }

  return {
    start,
    stop,
    isRunning: () => running,
  }
}
