import {
  OVERALL_CHOICES,
  OVERALL_LABELS,
  RED_FLAGS,
  RISK_QUESTIONS,
  SESSION_MINUTES,
  SYMPTOMS,
  LEVEL_ZONE_BANDS,
  dayNumber,
  targetZone,
} from '../src/data.js'

export {
  OVERALL_CHOICES,
  OVERALL_LABELS,
  RED_FLAGS,
  RISK_QUESTIONS,
  SESSION_MINUTES,
  SYMPTOMS,
  LEVEL_ZONE_BANDS,
  dayNumber,
  targetZone,
}

/** Buffalo / BCBT: pause aerobic work when overall symptoms sit above 7/10. */
export const BUFFALO_PAUSE_ABOVE = 7

/** Amsterdam consensus 2023: symptoms may rise at most 2 points during exercise. */
export const MAX_SYMPTOM_RISE = 2

/** And they must settle to within 2 points of the pre-session rating within an hour. */
export const MAX_HOUR_DELTA = 2

export const LEVEL_MIN = 1
export const LEVEL_MAX = 5
export const LEVEL_START = 2

export const HR_SOURCES = ['polar', 'garmin', 'camera', 'manual']
export const RISK_IDS = RISK_QUESTIONS.map((q) => q.id)

export function dayNumberOn(injuryDate, localDate) {
  const start = new Date(`${injuryDate}T00:00:00`)
  const today = new Date(`${localDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime())) return 1
  const days = Math.round((today - start) / 86400000) + 1
  return Math.max(1, days)
}

export function canExercise(overall) {
  return Number(overall) <= BUFFALO_PAUSE_ABOVE
}

export function outlookFromAnswers(answers = {}) {
  const reasons = []
  if (answers.prior === 'yes') reasons.push('prior')
  if (answers.repeat === 'yes') reasons.push('repeat')
  if (answers.migraine === 'yes') reasons.push('migraine')
  return { longer: reasons.length > 0, reasons }
}

export function evaluateProgression({ before, after, hour, level }) {
  const rise = Number(after) - Number(before)
  const hourDelta = Number(hour) - Number(before)
  const settled = hourDelta <= MAX_HOUR_DELTA && rise <= MAX_SYMPTOM_RISE
  const levelBefore = clampLevel(level)
  const nextLevel = settled ? Math.min(LEVEL_MAX, levelBefore + 1) : levelBefore
  return {
    rise,
    hourDelta,
    settled,
    levelBefore,
    nextLevel,
  }
}

export function clampLevel(level) {
  const n = Number(level)
  if (!Number.isFinite(n)) return LEVEL_START
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(n)))
}

export function addDays(isoDate, delta) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Consecutive check-in days ending today, or yesterday if today is not logged yet. */
export function computeStreak(localDates, todayLocal) {
  const unique = [...new Set(localDates)].sort().reverse()
  if (!unique.length) return 0
  const yesterday = addDays(todayLocal, -1)
  if (unique[0] !== todayLocal && unique[0] !== yesterday) return 0
  let streak = 0
  let expect = unique[0]
  for (const date of unique) {
    if (date !== expect) break
    streak += 1
    expect = addDays(expect, -1)
  }
  return streak
}

export function catalog() {
  return {
    redFlags: RED_FLAGS,
    symptoms: SYMPTOMS,
    riskQuestions: RISK_QUESTIONS,
    overallChoices: OVERALL_CHOICES,
    overallLabels: OVERALL_LABELS,
    rules: {
      buffaloPauseAbove: BUFFALO_PAUSE_ABOVE,
      maxSymptomRise: MAX_SYMPTOM_RISE,
      maxHourDelta: MAX_HOUR_DELTA,
      sessionMinutes: SESSION_MINUTES,
      hrZone: {
        maxHrFormula: '220-age',
        levelBands: LEVEL_ZONE_BANDS,
        citations: [
          'Concussion Alliance at-home aerobic stages',
          'Amsterdam consensus 2023 return-to-sport HR steps',
        ],
      },
      levels: { min: LEVEL_MIN, max: LEVEL_MAX, start: LEVEL_START },
    },
  }
}
