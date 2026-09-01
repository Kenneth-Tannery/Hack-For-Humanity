/**
 * Fingertip camera PPG — same method as richrd/heart-rate-monitor (MIT).
 *
 * Flash/torch: browsers only expose on/off (no LED brightness). PPG needs a
 * steady light source — pulsing the LED would inject a fake ~3 Hz rhythm and
 * break BPM. We skip torch when ambient light is enough; otherwise torch stays
 * on continuously with minimum camera gain.
 */

const IMAGE_WIDTH = 30
const IMAGE_HEIGHT = 30
const MAX_SAMPLES = 60 * 5
const START_DELAY_MS = 1500
/** Sample without torch before turning the LED on. */
const AMBIENT_TRIAL_MS = 900
/** richrd good-range lower bound — below this needs fill light. */
const DARK_THRESHOLD = 0.045
/** Re-assert torch if Android drops it (does not pulse — that would break PPG). */
const TORCH_KEEPALIVE_MS = 4000
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
  if (crossings.length < 3) return null
  const averageInterval =
    (crossings[crossings.length - 1].time - crossings[0].time) / (crossings.length - 1)
  if (!averageInterval || averageInterval <= 0) return null
  const bpm = 60000 / averageInterval
  // Flash PWM / exposure flicker often reads >130 at rest — reject before UI/lock
  if (bpm < 45 || bpm > 135) return null
  return bpm
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
  windowMs: 3000,
  maxSpread: 32,
  minSamples: 2,
  excludeQuality: ['poor'],
  /** Accept a single steady reading after this long (flash heat). */
  emergencyLockMs: 1600,
  /** Multi-sample soft lock. */
  softLockMs: 2200,
  /** UI: suggest lifting finger / try again. */
  maxContactMs: 12000,
  /** Contact timer starts after camera loop begins, not on mount. */
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
    return level === 'good' || (level === 'ok' && range >= 0.002 && range <= 0.025)
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
 * Decide if the pulse reading is “locked in” like a wrist sensor.
 * @param {{ t: number, bpm: number, quality: { level: string } }[]} samples
 */
export function evaluateHrLock(samples, now = Date.now()) {
  const usable = lockEligible(samples, now)

  if (!usable.length) {
    return { phase: 'searching', locked: false, lockedBpm: null, progress: 0, spread: null }
  }

  const elapsed = now - usable[0].t
  const sampleProgress = Math.min(1, usable.length / HR_LOCK.minSamples)
  const timeProgress = Math.min(1, elapsed / HR_LOCK.emergencyLockMs)
  const progress = Math.max(sampleProgress, timeProgress)
  const bpms = usable.map((s) => s.bpm)
  const spread = Math.max(...bpms) - Math.min(...bpms)

  if (usable.length < HR_LOCK.minSamples) {
    return { phase: 'measuring', locked: false, lockedBpm: null, progress, spread }
  }

  if (spread > HR_LOCK.maxSpread) {
    return { phase: 'unstable', locked: false, lockedBpm: null, progress, spread }
  }

  return {
    phase: 'locked',
    locked: true,
    lockedBpm: robustMedian(bpms),
    progress: 1,
    spread,
    soft: false,
  }
}

/** Soft / emergency lock so users aren’t stuck on a hot flash. */
export function evaluateHrLockWithSoft(samples, now = Date.now()) {
  const result = evaluateHrLock(samples, now)
  if (result.locked) return result

  const usable = lockEligible(samples, now)
  if (!usable.length) return result

  const elapsed = now - usable[0].t
  const latest = usable[usable.length - 1]

  if (elapsed >= HR_LOCK.emergencyLockMs) {
    const bpms = usable.map((s) => s.bpm)
    return {
      phase: 'locked',
      locked: true,
      lockedBpm: robustMedian(bpms) ?? latest.bpm,
      progress: 1,
      spread: bpms.length ? Math.max(...bpms) - Math.min(...bpms) : 0,
      soft: true,
      emergency: true,
    }
  }

  if (usable.length < 2 || elapsed < HR_LOCK.softLockMs) return result

  const bpms = usable.map((s) => s.bpm)
  if (!bpms.length) return result

  return {
    phase: 'locked',
    locked: true,
    lockedBpm: robustMedian(bpms) ?? latest.bpm,
    progress: 1,
    spread: Math.max(...bpms) - Math.min(...bpms),
    soft: true,
    emergency: false,
  }
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
  preferEnvironment = true,
  startDelayMs = START_DELAY_MS,
}) {
  const samples = []
  let stream = null
  let running = false
  let raf = 0
  let startTimer = 0
  let torchTimer = 0
  let torchLimitTimer = 0
  let torchOn = false
  let torchMode = 'off' // 'off' | 'ambient' | 'continuous' | 'limit'
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
      torchMode = 'continuous'
      await setTorch(true)
      await softenCaptureKeepingTorch(track, true, { preferMin: true })
      await setTorch(true)
      emitTorch()
      startTorchLimitIfNeeded()
      loop()
      startTorchKeepalive()
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

    torchMode = 'continuous'
    await setTorch(true)
    await softenCaptureKeepingTorch(track, true, { preferMin: true })
    await setTorch(true)
    emitTorch()
    startTorchLimitIfNeeded()
    loop()
    startTorchKeepalive()
  }

  function startTorchKeepalive() {
    window.clearInterval(torchTimer)
    torchTimer = window.setInterval(() => {
      if (running && torchMode === 'continuous') setTorch(true)
    }, TORCH_KEEPALIVE_MS)
  }

  function startTorchLimitIfNeeded() {
    if (torchMaxMs <= 0) return
    window.clearTimeout(torchLimitTimer)
    torchLimitTimer = window.setTimeout(async () => {
      if (!running || torchMode !== 'continuous') return
      await setTorch(false)
      torchMode = 'limit'
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
