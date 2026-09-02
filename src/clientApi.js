/**
 * On-device API for Vercel / serverless deploys.
 *
 * Server memory dies between isolates (create profile on A, check-in on B → fail).
 * Keeping recovery data in localStorage matches Data Safety (stays on device) and
 * makes the phone demo reliable. Same Buffalo/Amsterdam rules as server/clinical.js.
 */

import {
  BUFFALO_PAUSE_ABOVE,
  LEVEL_START,
  SESSION_MINUTES,
  canExercise,
  clampLevel,
  computeStreak,
  dayNumberOn,
  evaluateProgression,
  outlookFromAnswers,
  recordLevel5Progress,
  targetZone,
} from '../server/clinical.js'
import { buildClinicianLog } from '../server/clinicianLog.js'
import { buildClinicianDemoRecords } from '../server/clinicianDemoData.js'
import { RED_FLAGS, SYMPTOMS } from './data.js'

const DB_KEY = 'threshold-client-db-v1'

function emptyDb() {
  return { profiles: {}, checkins: {}, sessions: {} }
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return emptyDb()
    const parsed = JSON.parse(raw)
    return {
      profiles: parsed.profiles || {},
      checkins: parsed.checkins || {},
      sessions: parsed.sessions || {},
    }
  } catch {
    return emptyDb()
  }
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function checkinKey(profileId, localDate) {
  return `${profileId}:${localDate}`
}

function mapCheckin(row) {
  if (!row) return null
  return {
    ...row,
    scores: [...row.scores],
    symptomTotal: row.scores.reduce((sum, n) => sum + Number(n || 0), 0),
  }
}

function getProfile(db, id) {
  const p = db.profiles[id]
  if (!p) return null
  return {
    ...p,
    answers: { ...p.answers },
    level5StableStreak: p.level5StableStreak ?? 0,
    progressionPhase: p.progressionPhase ?? 'training',
  }
}

function listCheckins(db, profileId) {
  return Object.values(db.checkins)
    .filter((c) => c.profileId === profileId)
    .sort((a, b) => (a.localDate < b.localDate ? 1 : -1))
    .map(mapCheckin)
}

function getCheckinByDate(db, profileId, localDate) {
  return mapCheckin(db.checkins[checkinKey(profileId, localDate)])
}

function latestCheckin(db, profileId) {
  return listCheckins(db, profileId)[0] || null
}

function checkinDates(db, profileId) {
  return listCheckins(db, profileId).map((c) => c.localDate)
}

function getSession(db, id) {
  const s = db.sessions[id]
  if (!s) return null
  return {
    ...s,
    redFlags: [...(s.redFlags || [])],
    zone: s.zone ? { ...s.zone } : null,
  }
}

function listSessions(db, profileId) {
  return Object.values(db.sessions)
    .filter((s) => s.profileId === profileId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .map((s) => getSession(db, s.id))
}

function todayPayload(db, profile, localDate) {
  const todayCheckin = getCheckinByDate(db, profile.id, localDate)
  const latest = todayCheckin || latestCheckin(db, profile.id)
  const overall = latest?.overall ?? null
  return {
    profileId: profile.id,
    injuryDate: profile.injuryDate,
    age: profile.age,
    under18: profile.age < 18,
    day: dayNumberOn(profile.injuryDate, localDate),
    level: profile.level,
    zone: targetZone(profile.age, profile.level),
    sessionMinutes: SESSION_MINUTES,
    overall,
    loggedToday: Boolean(todayCheckin),
    streak: computeStreak(checkinDates(db, profile.id), localDate),
    canExercise: overall == null ? true : canExercise(overall),
    buffaloPauseAbove: BUFFALO_PAUSE_ABOVE,
    outlook: outlookFromAnswers(profile.answers),
    hrSource: profile.hrSource,
    lastCheckin: latest,
    progressionPhase: profile.progressionPhase ?? 'training',
    level5StableStreak: profile.level5StableStreak ?? 0,
    level5StableRequired: 3,
    inMaintenance: (profile.progressionPhase ?? 'training') === 'maintenance',
  }
}

function fail(status, code, message) {
  const error = new Error(message)
  error.status = status
  error.code = code
  throw error
}

function requireProfile(db, profileId) {
  const profile = getProfile(db, profileId)
  if (!profile) fail(404, 'not_found', 'Profile not found.')
  return profile
}

function parseScores(value) {
  if (!Array.isArray(value) || value.length !== SYMPTOMS.length) {
    fail(400, 'invalid_scores', `Provide ${SYMPTOMS.length} symptom scores.`)
  }
  return value.map((item, i) => {
    const n = Number(item)
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      fail(400, 'invalid_scores', `Score ${i + 1} must be an integer from 0 to 6.`)
    }
    return n
  })
}

function parseOverall(value, label = 'Overall') {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 10) {
    fail(400, 'invalid_overall', `${label} must be an integer from 0 to 10.`)
  }
  return n
}

function parseRedFlags(value) {
  if (value == null) return []
  if (!Array.isArray(value)) fail(400, 'invalid_flags', 'Red flags must be an array.')
  const unknown = value.filter((item) => !RED_FLAGS.includes(item))
  if (unknown.length) fail(400, 'invalid_flags', 'One or more red flags are not recognised.')
  return [...new Set(value)]
}

export async function createProfile({ injuryDate, age, answers, localDate }) {
  const db = loadDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const profile = {
    id,
    createdAt: now,
    updatedAt: now,
    injuryDate,
    age: Number(age),
    level: LEVEL_START,
    answers: answers || {},
    hrSource: null,
    level5StableStreak: 0,
    progressionPhase: 'training',
  }
  db.profiles[id] = profile
  saveDb(db)
  return { profile: getProfile(db, id), today: todayPayload(db, profile, localDate) }
}

export async function updateProfile(profileId, { injuryDate, age, answers, hrSource, level, level5StableStreak, progressionPhase }) {
  const db = loadDb()
  const current = requireProfile(db, profileId)
  Object.assign(current, {
    injuryDate: injuryDate ?? current.injuryDate,
    age: age != null ? Number(age) : current.age,
    answers: answers ?? current.answers,
    hrSource: hrSource === undefined ? current.hrSource : hrSource,
    level: level != null ? clampLevel(level) : current.level,
    level5StableStreak:
      level5StableStreak != null ? Math.max(0, Math.floor(level5StableStreak)) : current.level5StableStreak,
    progressionPhase: progressionPhase ?? current.progressionPhase,
    updatedAt: new Date().toISOString(),
  })
  db.profiles[profileId] = current
  saveDb(db)
  return { profile: getProfile(db, profileId) }
}

export async function deleteProfile(profileId) {
  const db = loadDb()
  if (!db.profiles[profileId]) return { ok: true }
  delete db.profiles[profileId]
  for (const key of Object.keys(db.checkins)) {
    if (db.checkins[key]?.profileId === profileId) delete db.checkins[key]
  }
  for (const key of Object.keys(db.sessions)) {
    if (db.sessions[key]?.profileId === profileId) delete db.sessions[key]
  }
  saveDb(db)
  return { ok: true }
}

export async function getToday(profileId, localDate) {
  const db = loadDb()
  const profile = requireProfile(db, profileId)
  return todayPayload(db, profile, localDate)
}

export async function saveCheckin(profileId, { scores, overall, localDate }) {
  const db = loadDb()
  requireProfile(db, profileId)
  const key = checkinKey(profileId, localDate)
  const existing = db.checkins[key]
  const row = {
    id: existing?.id || crypto.randomUUID(),
    profileId,
    loggedAt: new Date().toISOString(),
    localDate,
    scores: parseScores(scores),
    overall: parseOverall(overall),
  }
  db.checkins[key] = row
  saveDb(db)
  return {
    checkin: mapCheckin(row),
    today: todayPayload(db, getProfile(db, profileId), localDate),
  }
}

export async function startSession(profileId, { redFlags, before, hrSource, intent, localDate }) {
  const db = loadDb()
  const profile = requireProfile(db, profileId)
  const flags = parseRedFlags(redFlags)
  const latest = latestCheckin(db, profileId)
  const beforeScore =
    before != null ? parseOverall(before, 'Before') : (latest?.overall ?? null)
  const source = hrSource ?? profile.hrSource
  const emergency = intent === 'emergency' || flags.length > 0
  const zone = targetZone(profile.age, profile.level)

  if (emergency) {
    const session = {
      id: crypto.randomUUID(),
      profileId,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      localDate,
      status: 'blocked_flags',
      redFlags: flags,
      hrSource: source,
      before: beforeScore,
      after: null,
      hour: null,
      hourLoggedAt: null,
      rise: null,
      hourDelta: null,
      settled: null,
      levelBefore: profile.level,
      levelAfter: profile.level,
      zone: { low: zone.low, high: zone.high },
      durationMin: SESSION_MINUTES,
    }
    db.sessions[session.id] = session
    saveDb(db)
    return { session: getSession(db, session.id), redirect: 'emergency' }
  }

  if (beforeScore != null && !canExercise(beforeScore)) {
    const session = {
      id: crypto.randomUUID(),
      profileId,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      localDate,
      status: 'blocked_symptoms',
      redFlags: flags,
      hrSource: source,
      before: beforeScore,
      after: null,
      hour: null,
      hourLoggedAt: null,
      rise: null,
      hourDelta: null,
      settled: null,
      levelBefore: profile.level,
      levelAfter: profile.level,
      zone: { low: zone.low, high: zone.high },
      durationMin: SESSION_MINUTES,
    }
    db.sessions[session.id] = session
    saveDb(db)
    return { session: getSession(db, session.id), redirect: 'not-today' }
  }

  const session = {
    id: crypto.randomUUID(),
    profileId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    localDate,
    status: 'in_progress',
    redFlags: flags,
    hrSource: source,
    before: beforeScore,
    after: null,
    hour: null,
    hourLoggedAt: null,
    rise: null,
    hourDelta: null,
    settled: null,
    levelBefore: profile.level,
    levelAfter: profile.level,
    zone: { low: zone.low, high: zone.high },
    durationMin: SESSION_MINUTES,
  }
  db.sessions[session.id] = session
  if (source) {
    profile.hrSource = source
    profile.updatedAt = new Date().toISOString()
    db.profiles[profileId] = profile
  }
  saveDb(db)
  return { session: getSession(db, session.id), redirect: 'preflight' }
}

export async function setSessionSource(profileId, sessionId, hrSource) {
  const db = loadDb()
  requireProfile(db, profileId)
  const session = db.sessions[sessionId]
  if (!session || session.profileId !== profileId) fail(404, 'not_found', 'Session not found.')
  session.hrSource = hrSource
  const profile = db.profiles[profileId]
  if (profile && hrSource) {
    profile.hrSource = hrSource
    profile.updatedAt = new Date().toISOString()
  }
  saveDb(db)
  return { session: getSession(db, sessionId) }
}

export async function saveAfter(profileId, sessionId, after) {
  const db = loadDb()
  requireProfile(db, profileId)
  const session = db.sessions[sessionId]
  if (!session || session.profileId !== profileId) fail(404, 'not_found', 'Session not found.')
  if (session.status !== 'in_progress') fail(409, 'session_closed', 'This session is no longer in progress.')
  session.after = parseOverall(after)
  saveDb(db)
  return { session: getSession(db, sessionId) }
}

export async function saveHour(profileId, sessionId, { hour, after }) {
  const db = loadDb()
  const profile = requireProfile(db, profileId)
  const session = db.sessions[sessionId]
  if (!session || session.profileId !== profileId) fail(404, 'not_found', 'Session not found.')
  if (session.status !== 'in_progress') fail(409, 'session_closed', 'This session is no longer in progress.')
  const hourScore = parseOverall(hour, 'Hour')
  const afterScore = after != null ? parseOverall(after, 'After') : session.after
  if (afterScore == null) fail(400, 'missing_after', 'Log the after-session rating first.')
  const before = session.before ?? 0
  const result = evaluateProgression({
    before,
    after: afterScore,
    hour: hourScore,
    level: session.levelBefore ?? profile.level,
  })
  profile.level = result.nextLevel
  const l5 = recordLevel5Progress(profile, { settled: result.settled, levelBefore: result.levelBefore })
  profile.level5StableStreak = l5.level5StableStreak
  profile.progressionPhase = l5.progressionPhase
  profile.updatedAt = new Date().toISOString()
  Object.assign(session, {
    after: afterScore,
    hour: hourScore,
    hourLoggedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    status: 'completed',
    rise: result.rise,
    hourDelta: result.hourDelta,
    settled: result.settled,
    levelBefore: result.levelBefore,
    levelAfter: result.nextLevel,
  })
  saveDb(db)
  return {
    session: getSession(db, sessionId),
    evaluation: { ...result, ...l5 },
    today: todayPayload(db, getProfile(db, profileId), session.localDate),
  }
}

export async function getClinicianLog(profileId, localDate) {
  const db = loadDb()
  const profile = requireProfile(db, profileId)
  return buildClinicianLog({
    profile,
    checkins: listCheckins(db, profileId),
    sessions: listSessions(db, profileId),
    localDate,
  })
}

/** E2E / demo: multi-week log — 3 failed sessions, progression to Level 5, maintenance. */
export function seedClinicianDemoData(profileId = 'e2e-clinician-demo', localDate) {
  const db = loadDb()
  const demo = buildClinicianDemoRecords(profileId)
  const effectiveDate = localDate ?? demo.localDate

  db.profiles[profileId] = {
    ...demo.profile,
    updatedAt: `${effectiveDate}T08:00:00.000Z`,
  }

  for (const key of Object.keys(db.checkins)) {
    if (key.startsWith(`${profileId}:`)) delete db.checkins[key]
  }
  for (const key of Object.keys(db.sessions)) {
    if (db.sessions[key]?.profileId === profileId) delete db.sessions[key]
  }

  for (const ck of demo.checkins) {
    db.checkins[`${profileId}:${ck.localDate}`] = ck
  }
  for (const sess of demo.sessions) {
    db.sessions[sess.id] = sess
  }

  saveDb(db)
  return profileId
}
