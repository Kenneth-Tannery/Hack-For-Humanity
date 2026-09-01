import { LEVEL_START } from './clinical.js'

/** In-memory store for Vercel serverless (no native SQLite). Data resets on cold start. */

const profiles = new Map()
const checkins = new Map() // key: `${profileId}:${localDate}`
const sessions = new Map()

function checkinKey(profileId, localDate) {
  return `${profileId}:${localDate}`
}

export function createProfile({ id, injuryDate, age, answers, level = LEVEL_START }) {
  const now = new Date().toISOString()
  const profile = {
    id,
    createdAt: now,
    updatedAt: now,
    injuryDate,
    age,
    level,
    answers: answers || {},
    hrSource: null,
  }
  profiles.set(id, profile)
  return getProfile(id)
}

export function getProfile(id) {
  const p = profiles.get(id)
  return p ? { ...p, answers: { ...p.answers } } : null
}

export function updateProfile(id, patch) {
  const current = profiles.get(id)
  if (!current) return null
  Object.assign(current, {
    injuryDate: patch.injuryDate ?? current.injuryDate,
    age: patch.age ?? current.age,
    level: patch.level ?? current.level,
    answers: patch.answers ?? current.answers,
    hrSource: patch.hrSource === undefined ? current.hrSource : patch.hrSource,
    updatedAt: new Date().toISOString(),
  })
  return getProfile(id)
}

export function upsertCheckin({ id, profileId, localDate, scores, overall }) {
  const key = checkinKey(profileId, localDate)
  const existing = checkins.get(key)
  const row = {
    id: existing?.id || id,
    profileId,
    loggedAt: new Date().toISOString(),
    localDate,
    scores: [...scores],
    overall,
  }
  checkins.set(key, row)
  return getCheckinByDate(profileId, localDate)
}

function mapCheckin(row) {
  if (!row) return null
  return {
    ...row,
    scores: [...row.scores],
    symptomTotal: row.scores.reduce((sum, n) => sum + Number(n || 0), 0),
  }
}

export function getCheckinByDate(profileId, localDate) {
  return mapCheckin(checkins.get(checkinKey(profileId, localDate)))
}

export function latestCheckin(profileId) {
  const rows = [...checkins.values()]
    .filter((c) => c.profileId === profileId)
    .sort((a, b) => (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : 0))
  return mapCheckin(rows[0] || null)
}

export function listCheckins(profileId) {
  return [...checkins.values()]
    .filter((c) => c.profileId === profileId)
    .sort((a, b) => (a.localDate < b.localDate ? 1 : -1))
    .map(mapCheckin)
}

export function checkinDates(profileId) {
  return listCheckins(profileId).map((c) => c.localDate)
}

export function createSession(fields) {
  const session = {
    id: fields.id,
    profileId: fields.profileId,
    startedAt: fields.startedAt,
    endedAt: fields.endedAt ?? null,
    localDate: fields.localDate,
    status: fields.status,
    redFlags: [...(fields.redFlags || [])],
    hrSource: fields.hrSource ?? null,
    before: fields.before ?? null,
    after: fields.after ?? null,
    hour: fields.hour ?? null,
    hourLoggedAt: fields.hourLoggedAt ?? null,
    rise: fields.rise ?? null,
    hourDelta: fields.hourDelta ?? null,
    settled: fields.settled == null ? null : Boolean(fields.settled),
    levelBefore: fields.levelBefore ?? null,
    levelAfter: fields.levelAfter ?? null,
    zone: fields.targetLow == null ? null : { low: fields.targetLow, high: fields.targetHigh },
    durationMin: fields.durationMin ?? 20,
  }
  sessions.set(fields.id, session)
  return getSession(fields.id)
}

export function getSession(id) {
  const s = sessions.get(id)
  return s
    ? {
        ...s,
        redFlags: [...s.redFlags],
        zone: s.zone ? { ...s.zone } : null,
      }
    : null
}

export function updateSession(id, patch) {
  const current = sessions.get(id)
  if (!current) return null
  if (patch.endedAt !== undefined) current.endedAt = patch.endedAt
  if (patch.status !== undefined) current.status = patch.status
  if (patch.redFlags !== undefined) current.redFlags = [...patch.redFlags]
  if (patch.hrSource !== undefined) current.hrSource = patch.hrSource
  if (patch.before !== undefined) current.before = patch.before
  if (patch.after !== undefined) current.after = patch.after
  if (patch.hour !== undefined) current.hour = patch.hour
  if (patch.hourLoggedAt !== undefined) current.hourLoggedAt = patch.hourLoggedAt
  if (patch.rise !== undefined) current.rise = patch.rise
  if (patch.hourDelta !== undefined) current.hourDelta = patch.hourDelta
  if (patch.settled !== undefined) current.settled = patch.settled
  if (patch.levelBefore !== undefined) current.levelBefore = patch.levelBefore
  if (patch.levelAfter !== undefined) current.levelAfter = patch.levelAfter
  if (patch.targetLow !== undefined || patch.targetHigh !== undefined) {
    current.zone = {
      low: patch.targetLow ?? current.zone?.low,
      high: patch.targetHigh ?? current.zone?.high,
    }
  }
  return getSession(id)
}

export function listSessions(profileId) {
  return [...sessions.values()]
    .filter((s) => s.profileId === profileId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .map((s) => getSession(s.id))
}
