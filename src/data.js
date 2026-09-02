export const RED_FLAGS = [
  'Headache getting worse',
  'Vomiting more than once',
  'Seizure or convulsion',
  'More confused than before',
  'Weakness or numbness',
  'Slurred speech',
  'Neck pain',
]

export const SYMPTOMS = [
  'Headache',
  'Pressure in the head',
  'Neck pain',
  'Nausea or vomiting',
  'Dizziness',
  'Blurred vision',
  'Balance problems',
  'Sensitivity to light',
  'Sensitivity to noise',
  'Feeling slowed down',
  'Feeling like “in a fog”',
  '“Don’t feel right”',
  'Difficulty concentrating',
  'Difficulty remembering',
  'Fatigue or low energy',
  'Confusion',
  'Drowsiness',
  'More emotional',
  'Irritability',
  'Sadness',
  'Nervous or anxious',
  'Trouble falling asleep',
]

export const RISK_QUESTIONS = [
  {
    id: 'prior',
    kicker: 'Helps us set expectations',
    title: 'Have you had a concussion before?',
  },
  {
    id: 'migraine',
    kicker: 'Helps us set expectations',
    title: 'Do you get migraines?',
  },
  {
    id: 'adhd',
    kicker: 'Helps us set expectations',
    title: 'Have you been diagnosed with ADHD or a learning difference?',
    allowUnsure: true,
  },
  {
    id: 'anxiety',
    kicker: 'Helps us set expectations',
    title: 'Have you had anxiety or depression that needed treatment?',
    allowUnsure: true,
  },
  {
    id: 'loc',
    kicker: 'About this injury',
    title: 'Did you lose consciousness?',
    allowUnsure: true,
  },
  {
    id: 'amnesia',
    kicker: 'About this injury',
    title: 'Any gap in memory around the injury?',
    allowUnsure: true,
  },
  {
    id: 'repeat',
    kicker: 'About this injury',
    title: 'Is this your second concussion in 12 months?',
  },
  {
    id: 'sport',
    kicker: 'About this injury',
    title: 'Did this happen in contact sport?',
  },
  {
    id: 'worse',
    kicker: 'About this injury',
    title: 'Are symptoms worse than last time, if you’ve had one before?',
    allowSkip: true,
  },
]

export const OVERALL_CHOICES = [0, 3, 6, 10]

export const OVERALL_LABELS = {
  0: 'No symptoms at all',
  1: 'Barely there',
  2: 'Mild',
  3: 'Noticeable but manageable',
  4: 'Getting in the way',
  5: 'Moderate',
  6: 'Hard to concentrate',
  7: 'Hard to function',
  8: 'Severe',
  9: 'Near the worst',
  10: 'Worst it has been',
}

/** Buffalo-style bout length shown in the UI and stored on sessions. */
export const SESSION_MINUTES = 20
/** Ease-in before the target-zone block. */
export const WARMUP_SECONDS = 3 * 60
/** Remainder of the 20-minute bout after warmup. */
export const ACTIVE_SECONDS = SESSION_MINUTES * 60 - WARMUP_SECONDS

/** Camera mid-session pulse check at this fraction of main exercise elapsed. */
export const CAMERA_MIDCHECK_FRACTION = 0.5

export function dayNumber(injuryDate) {
  const start = new Date(`${injuryDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 1
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today - start) / 86400000) + 1
  return Math.max(1, days)
}

export function formatInjuryDate(iso) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const DEMO_DAY_OFFSET_KEY = 'threshold-demo-day-offset'

/** Prototype-only: shift “today” forward after a completed session day. */
export function getDemoDayOffset() {
  const n = Number(localStorage.getItem(DEMO_DAY_OFFSET_KEY) || 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function advanceDemoDay() {
  const next = getDemoDayOffset() + 1
  localStorage.setItem(DEMO_DAY_OFFSET_KEY, String(next))
  return next
}

export function resetDemoDay() {
  localStorage.removeItem(DEMO_DAY_OFFSET_KEY)
}

/** Local calendar date as YYYY-MM-DD (for date inputs and “today” checks). */
export function localDate(d = new Date()) {
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** App “today” with demo day offset applied (sessions, check-ins). */
export function appLocalDate(d = new Date()) {
  const offset = getDemoDayOffset()
  if (!offset) return localDate(d)
  const shifted = new Date(d)
  shifted.setDate(shifted.getDate() + offset)
  return localDate(shifted)
}

/** Per-level target bands (% of age-predicted max HR). Concussion Alliance at-home stages; Amsterdam 2023 return-to-sport steps. */
export const LEVEL_ZONE_BANDS = {
  1: { lowPct: 0.5, highPct: 0.55 },
  2: { lowPct: 0.55, highPct: 0.6 },
  3: { lowPct: 0.6, highPct: 0.65 },
  4: { lowPct: 0.65, highPct: 0.7 },
  5: { lowPct: 0.7, highPct: 0.75 },
}

function clampLevel(level) {
  const n = Number(level)
  if (!Number.isFinite(n)) return 2
  return Math.min(5, Math.max(1, Math.round(n)))
}

/** Age-predicted max HR (220 − age) with level-based subthreshold band. */
export function targetZone(age, level = 2, restingBpm = null) {
  const max = 220 - Number(age || 16)
  const lv = clampLevel(level)
  const band = LEVEL_ZONE_BANDS[lv] ?? LEVEL_ZONE_BANDS[2]
  const rest = Number(restingBpm)
  const reserve = max - rest
  if (Number.isFinite(rest) && reserve > 20) {
    return {
      low: Math.round(rest + reserve * band.lowPct),
      high: Math.round(rest + reserve * band.highPct),
      lowPct: band.lowPct,
      highPct: band.highPct,
      level: lv,
      maxHr: max,
      restingBpm: rest,
      personalized: true,
    }
  }
  return {
    low: Math.round(max * band.lowPct),
    high: Math.round(max * band.highPct),
    lowPct: band.lowPct,
    highPct: band.highPct,
    level: lv,
    maxHr: max,
    personalized: false,
  }
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
