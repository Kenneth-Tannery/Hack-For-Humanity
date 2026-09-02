import { RISK_QUESTIONS } from './data.js'

const VOICE_BASE = '/audio/voice'
let manifestPromise = null
let clipIndex = null

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function riskIdFromTitle(title) {
  const q = RISK_QUESTIONS.find((item) => item.title === title)
  return q ? `risk-${q.id}` : `risk-${slug(title)}`
}

export function symptomClipId(name) {
  return `symptom-${slug(name)}`
}

/** Map navigable screen + context to a pre-recorded clip id (if any). */
export function screenClipId(screen, ctx = {}) {
  switch (screen) {
    case 'home':
      if (ctx.inMaintenance) return ctx.logged ? 'home-maintenance-logged' : 'home-maintenance'
      return ctx.logged ? 'home-logged' : 'home-not-logged'
    case 'checkin':
      return ctx.pendingSession ? 'checkin-pending' : 'checkin'
    case 'symptom':
      return ctx.symptomName ? symptomClipId(ctx.symptomName) : null
    case 'overall':
      return 'overall'
    case 'risk':
      return ctx.riskTitle ? riskIdFromTitle(ctx.riskTitle) : 'risk-consent'
    case 'held':
      if (ctx.graduated) return 'held-graduated'
      if (ctx.settled && Number(ctx.levelBefore ?? ctx.level) >= 5) {
        const streak = ctx.level5StableStreak ?? 0
        if (streak >= 2) return 'held-level-5-streak'
        return 'held-level-5'
      }
      if (ctx.settled && Number(ctx.levelBefore ?? ctx.level) < 5) return 'held-level-up'
      return 'held-stay'
    default:
      return screen
  }
}

async function loadManifest() {
  if (clipIndex) return clipIndex
  if (!manifestPromise) {
    manifestPromise = fetch(`${VOICE_BASE}/manifest.json`)
      .then(async (res) => {
        if (!res.ok) return null
        const data = await res.json()
        if (!Array.isArray(data?.clips) || data.clips.length === 0) return null
        return data
      })
      .catch(() => null)
  }
  const manifest = await manifestPromise
  clipIndex = new Map((manifest?.clips || []).map((clip) => [clip.id, clip]))
  return clipIndex
}

export function clipUrlSync(clipId) {
  if (!clipId || !clipIndex) return null
  const clip = clipIndex.get(clipId)
  if (!clip?.file) return null
  return `${VOICE_BASE}/${clip.file}`
}

export async function warmVoiceClips() {
  return loadManifest()
}

export async function clipUrl(clipId) {
  if (!clipId) return null
  const index = await loadManifest()
  const clip = index.get(clipId)
  if (!clip?.file) return null
  return `${VOICE_BASE}/${clip.file}`
}

export async function hasVoiceClip(clipId) {
  const url = await clipUrl(clipId)
  if (!url) return false
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}
