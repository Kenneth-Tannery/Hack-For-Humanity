import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import {
  BUFFALO_PAUSE_ABOVE,
  HR_SOURCES,
  LEVEL_START,
  RED_FLAGS,
  RISK_IDS,
  SESSION_MINUTES,
  SYMPTOMS,
  canExercise,
  catalog,
  clampLevel,
  computeStreak,
  dayNumber,
  dayNumberOn,
  evaluateProgression,
  outlookFromAnswers,
  targetZone,
} from './clinical.js'
import * as store from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function todayLocalFrom(body) {
  if (body?.localDate && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate)) return body.localDate
  const now = new Date()
  const yy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function requireProfile(req) {
  const profile = store.getProfile(req.params.profileId)
  if (!profile) throw new HttpError(404, 'not_found', 'Profile not found.')
  return profile
}

function requireSession(profileId, sessionId) {
  const session = store.getSession(sessionId)
  if (!session || session.profileId !== profileId) {
    throw new HttpError(404, 'not_found', 'Session not found.')
  }
  return session
}

function parseAge(value) {
  const age = Number(value)
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    throw new HttpError(400, 'invalid_age', 'Age must be a whole number between 1 and 120.')
  }
  return age
}

function parseInjuryDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'invalid_date', 'Injury date must be YYYY-MM-DD.')
  }
  const dt = new Date(`${value}T00:00:00`)
  if (Number.isNaN(dt.getTime())) {
    throw new HttpError(400, 'invalid_date', 'Injury date is not a real calendar day.')
  }
  return value
}

function parseAnswers(value) {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_answers', 'Risk answers must be an object.')
  }
  const answers = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!RISK_IDS.includes(key)) continue
    if (raw !== 'yes' && raw !== 'no' && raw !== 'unsure' && raw !== 'skip') {
      throw new HttpError(400, 'invalid_answers', `Answer for ${key} must be yes, no, unsure, or skip.`)
    }
    answers[key] = raw
  }
  return answers
}

function parseOverall(value, label = 'Overall') {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 10) {
    throw new HttpError(400, 'invalid_overall', `${label} must be an integer from 0 to 10.`)
  }
  return n
}

function parseScores(value) {
  if (!Array.isArray(value) || value.length !== SYMPTOMS.length) {
    throw new HttpError(400, 'invalid_scores', `Provide ${SYMPTOMS.length} symptom scores.`)
  }
  return value.map((item, i) => {
    const n = Number(item)
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      throw new HttpError(400, 'invalid_scores', `Score ${i + 1} must be an integer from 0 to 6.`)
    }
    return n
  })
}

function parseRedFlags(value) {
  if (value == null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'invalid_flags', 'Red flags must be an array.')
  const unknown = value.filter((item) => !RED_FLAGS.includes(item))
  if (unknown.length) {
    throw new HttpError(400, 'invalid_flags', 'One or more red flags are not recognised.')
  }
  return [...new Set(value)]
}

function parseHrSource(value) {
  if (value == null || value === '') return null
  if (!HR_SOURCES.includes(value)) {
    throw new HttpError(400, 'invalid_source', 'Heart-rate source is not recognised.')
  }
  return value
}

function todayPayload(profile, localDate) {
  const zone = targetZone(profile.age)
  const todayCheckin = store.getCheckinByDate(profile.id, localDate)
  const latest = todayCheckin || store.latestCheckin(profile.id)
  const overall = latest?.overall ?? null
  return {
    profileId: profile.id,
    injuryDate: profile.injuryDate,
    age: profile.age,
    under18: profile.age < 18,
    day: dayNumberOn(profile.injuryDate, localDate),
    level: profile.level,
    zone,
    sessionMinutes: SESSION_MINUTES,
    overall,
    loggedToday: Boolean(todayCheckin),
    streak: computeStreak(store.checkinDates(profile.id), localDate),
    canExercise: overall == null ? true : canExercise(overall),
    buffaloPauseAbove: BUFFALO_PAUSE_ABOVE,
    outlook: outlookFromAnswers(profile.answers),
    hrSource: profile.hrSource,
    lastCheckin: latest,
  }
}

function clinicianLog(profile) {
  const checkins = store.listCheckins(profile.id)
  const sessions = store.listSessions(profile.id)
  const timeline = [
    ...checkins.map((item) => ({ type: 'checkin', at: item.loggedAt, date: item.localDate, ...item })),
    ...sessions.map((item) => ({ type: 'session', at: item.startedAt, date: item.localDate, ...item })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    disclaimer:
      'Not medical advice. This log is a prototype record of paced aerobic work and symptom ratings. It does not diagnose concussion or clear return to sport.',
    profile: {
      ...profile,
      day: dayNumber(profile.injuryDate),
      outlook: outlookFromAnswers(profile.answers),
      zone: targetZone(profile.age),
    },
    summary: {
      checkins: checkins.length,
      sessions: sessions.length,
      completedSessions: sessions.filter((s) => s.status === 'completed').length,
      blockedFlags: sessions.filter((s) => s.status === 'blocked_flags').length,
      blockedSymptoms: sessions.filter((s) => s.status === 'blocked_symptoms').length,
      settledSessions: sessions.filter((s) => s.settled).length,
    },
    timeline,
  }
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'threshold', time: new Date().toISOString() })
})

app.get('/api/catalog', (_req, res) => {
  res.json(catalog())
})

app.post('/api/profiles', (req, res) => {
  const injuryDate = parseInjuryDate(req.body?.injuryDate)
  const age = parseAge(req.body?.age)
  const answers = parseAnswers(req.body?.answers)
  const profile = store.createProfile({
    id: crypto.randomUUID(),
    injuryDate,
    age,
    answers,
    level: LEVEL_START,
  })
  res.status(201).json({ profile, today: todayPayload(profile, todayLocalFrom(req.body)) })
})

app.get('/api/profiles/:profileId', (req, res) => {
  const profile = requireProfile(req)
  res.json({ profile })
})

app.patch('/api/profiles/:profileId', (req, res) => {
  const current = requireProfile(req)
  const patch = {}
  if (req.body?.injuryDate != null) patch.injuryDate = parseInjuryDate(req.body.injuryDate)
  if (req.body?.age != null) patch.age = parseAge(req.body.age)
  if (req.body?.answers != null) patch.answers = parseAnswers(req.body.answers)
  if (req.body?.hrSource !== undefined) patch.hrSource = parseHrSource(req.body.hrSource)
  if (req.body?.level != null) patch.level = clampLevel(req.body.level)
  const profile = store.updateProfile(current.id, patch)
  res.json({ profile })
})

app.get('/api/profiles/:profileId/today', (req, res) => {
  const profile = requireProfile(req)
  res.json(todayPayload(profile, todayLocalFrom(req.query)))
})

app.get('/api/profiles/:profileId/log', (req, res) => {
  const profile = requireProfile(req)
  res.json(clinicianLog(profile))
})

app.get('/api/profiles/:profileId/checkins', (req, res) => {
  const profile = requireProfile(req)
  res.json({ checkins: store.listCheckins(profile.id) })
})

app.post('/api/profiles/:profileId/checkins', (req, res) => {
  const profile = requireProfile(req)
  const scores = parseScores(req.body?.scores)
  const overall = parseOverall(req.body?.overall)
  const localDate = todayLocalFrom(req.body)
  const checkin = store.upsertCheckin({
    id: crypto.randomUUID(),
    profileId: profile.id,
    localDate,
    scores,
    overall,
  })
  res.status(201).json({
    checkin,
    today: todayPayload(store.getProfile(profile.id), localDate),
  })
})

app.get('/api/profiles/:profileId/sessions', (req, res) => {
  const profile = requireProfile(req)
  res.json({ sessions: store.listSessions(profile.id) })
})

app.post('/api/profiles/:profileId/sessions', (req, res) => {
  const profile = requireProfile(req)
  const localDate = todayLocalFrom(req.body)
  const redFlags = parseRedFlags(req.body?.redFlags)
  const hrSource = parseHrSource(req.body?.hrSource ?? profile.hrSource)
  const latest = store.latestCheckin(profile.id)
  const before =
    req.body?.before != null ? parseOverall(req.body.before, 'Before') : (latest?.overall ?? null)
  const emergency = req.body?.intent === 'emergency' || redFlags.length > 0

  if (emergency) {
    const session = store.createSession({
      id: crypto.randomUUID(),
      profileId: profile.id,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      localDate,
      status: 'blocked_flags',
      redFlags,
      hrSource,
      before,
      levelBefore: profile.level,
      levelAfter: profile.level,
    })
    return res.status(201).json({ session, redirect: 'emergency' })
  }

  if (before != null && !canExercise(before)) {
    const session = store.createSession({
      id: crypto.randomUUID(),
      profileId: profile.id,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      localDate,
      status: 'blocked_symptoms',
      redFlags,
      hrSource,
      before,
      levelBefore: profile.level,
      levelAfter: profile.level,
    })
    return res.status(201).json({ session, redirect: 'not-today' })
  }

  const zone = targetZone(profile.age)
  const session = store.createSession({
    id: crypto.randomUUID(),
    profileId: profile.id,
    startedAt: new Date().toISOString(),
    localDate,
    status: 'in_progress',
    redFlags,
    hrSource,
    before,
    levelBefore: profile.level,
    targetLow: zone.low,
    targetHigh: zone.high,
    durationMin: SESSION_MINUTES,
  })
  if (hrSource) store.updateProfile(profile.id, { hrSource })
  res.status(201).json({ session, redirect: 'preflight' })
})

app.patch('/api/profiles/:profileId/sessions/:sessionId', (req, res) => {
  const profile = requireProfile(req)
  const current = requireSession(profile.id, req.params.sessionId)
  const patch = {}
  if (req.body?.hrSource !== undefined) {
    patch.hrSource = parseHrSource(req.body.hrSource)
    if (patch.hrSource) store.updateProfile(profile.id, { hrSource: patch.hrSource })
  }
  if (req.body?.after != null) patch.after = parseOverall(req.body.after, 'After')
  if (req.body?.status === 'abandoned' && current.status === 'in_progress') {
    patch.status = 'abandoned'
    patch.endedAt = new Date().toISOString()
  }
  const session = store.updateSession(current.id, patch)
  res.json({ session })
})

app.post('/api/profiles/:profileId/sessions/:sessionId/after', (req, res) => {
  const profile = requireProfile(req)
  const current = requireSession(profile.id, req.params.sessionId)
  if (current.status !== 'in_progress') {
    throw new HttpError(409, 'session_closed', 'This session is no longer in progress.')
  }
  const after = parseOverall(req.body?.after, 'After')
  const session = store.updateSession(current.id, { after })
  res.json({ session })
})

app.post('/api/profiles/:profileId/sessions/:sessionId/hour', (req, res) => {
  const profile = requireProfile(req)
  const current = requireSession(profile.id, req.params.sessionId)
  if (current.status !== 'in_progress') {
    throw new HttpError(409, 'session_closed', 'This session is no longer in progress.')
  }
  const hour = parseOverall(req.body?.hour, 'Hour')
  const after = req.body?.after != null ? parseOverall(req.body.after, 'After') : current.after
  if (after == null) throw new HttpError(400, 'missing_after', 'Log the after-session rating first.')
  const before = current.before ?? 0
  const result = evaluateProgression({
    before,
    after,
    hour,
    level: current.levelBefore ?? profile.level,
  })
  store.updateProfile(profile.id, { level: result.nextLevel })
  const session = store.updateSession(current.id, {
    after,
    hour,
    hourLoggedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    status: 'completed',
    rise: result.rise,
    hourDelta: result.hourDelta,
    settled: result.settled,
    levelBefore: result.levelBefore,
    levelAfter: result.nextLevel,
  })
  res.json({
    session,
    evaluation: result,
    today: todayPayload(store.getProfile(profile.id), current.localDate),
  })
})

app.use('/api', (_req, _res, next) => {
  next(new HttpError(404, 'not_found', 'Not found.'))
})

const distDir = path.join(__dirname, '../dist')
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } })
  }
  console.error(err)
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong.' } })
})

const server = app.listen(PORT, () => {
  console.log(`Threshold API on http://localhost:${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Threshold API already running on http://localhost:${PORT}`)
    process.exit(0)
  }
  throw err
})
