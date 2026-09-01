import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { LEVEL_START } from './clinical.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'threshold.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    injury_date TEXT NOT NULL,
    age INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT ${LEVEL_START},
    answers_json TEXT NOT NULL DEFAULT '{}',
    hr_source TEXT
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    logged_at TEXT NOT NULL,
    local_date TEXT NOT NULL,
    scores_json TEXT NOT NULL,
    overall INTEGER NOT NULL,
    UNIQUE (profile_id, local_date),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    local_date TEXT NOT NULL,
    status TEXT NOT NULL,
    red_flags_json TEXT NOT NULL DEFAULT '[]',
    hr_source TEXT,
    before_overall INTEGER,
    after_overall INTEGER,
    hour_overall INTEGER,
    hour_logged_at TEXT,
    rise INTEGER,
    hour_delta INTEGER,
    settled INTEGER,
    level_before INTEGER,
    level_after INTEGER,
    target_low INTEGER,
    target_high INTEGER,
    duration_min INTEGER NOT NULL DEFAULT 20,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_checkins_profile ON checkins(profile_id, local_date);
  CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id, started_at);
`)

function parseJson(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function mapProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    injuryDate: row.injury_date,
    age: row.age,
    level: row.level,
    answers: parseJson(row.answers_json, {}),
    hrSource: row.hr_source,
  }
}

export function mapCheckin(row) {
  if (!row) return null
  const scores = parseJson(row.scores_json, [])
  return {
    id: row.id,
    profileId: row.profile_id,
    loggedAt: row.logged_at,
    localDate: row.local_date,
    scores,
    overall: row.overall,
    symptomTotal: scores.reduce((sum, n) => sum + Number(n || 0), 0),
  }
}

export function mapSession(row) {
  if (!row) return null
  return {
    id: row.id,
    profileId: row.profile_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    localDate: row.local_date,
    status: row.status,
    redFlags: parseJson(row.red_flags_json, []),
    hrSource: row.hr_source,
    before: row.before_overall,
    after: row.after_overall,
    hour: row.hour_overall,
    hourLoggedAt: row.hour_logged_at,
    rise: row.rise,
    hourDelta: row.hour_delta,
    settled: row.settled == null ? null : Boolean(row.settled),
    levelBefore: row.level_before,
    levelAfter: row.level_after,
    zone: row.target_low == null ? null : { low: row.target_low, high: row.target_high },
    durationMin: row.duration_min,
  }
}

export function createProfile({ id, injuryDate, age, answers, level = LEVEL_START }) {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO profiles (id, created_at, updated_at, injury_date, age, level, answers_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, now, now, injuryDate, age, level, JSON.stringify(answers || {}))
  return getProfile(id)
}

export function getProfile(id) {
  return mapProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(id))
}

export function updateProfile(id, patch) {
  const current = getProfile(id)
  if (!current) return null
  const next = {
    injuryDate: patch.injuryDate ?? current.injuryDate,
    age: patch.age ?? current.age,
    level: patch.level ?? current.level,
    answers: patch.answers ?? current.answers,
    hrSource: patch.hrSource === undefined ? current.hrSource : patch.hrSource,
  }
  db.prepare(
    `UPDATE profiles
     SET updated_at = ?, injury_date = ?, age = ?, level = ?, answers_json = ?, hr_source = ?
     WHERE id = ?`,
  ).run(
    new Date().toISOString(),
    next.injuryDate,
    next.age,
    next.level,
    JSON.stringify(next.answers || {}),
    next.hrSource,
    id,
  )
  return getProfile(id)
}

export function upsertCheckin({ id, profileId, localDate, scores, overall }) {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO checkins (id, profile_id, logged_at, local_date, scores_json, overall)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, local_date) DO UPDATE SET
       logged_at = excluded.logged_at,
       scores_json = excluded.scores_json,
       overall = excluded.overall`,
  ).run(id, profileId, now, localDate, JSON.stringify(scores), overall)
  return getCheckinByDate(profileId, localDate)
}

export function getCheckinByDate(profileId, localDate) {
  return mapCheckin(
    db.prepare('SELECT * FROM checkins WHERE profile_id = ? AND local_date = ?').get(profileId, localDate),
  )
}

export function latestCheckin(profileId) {
  return mapCheckin(
    db.prepare('SELECT * FROM checkins WHERE profile_id = ? ORDER BY local_date DESC, logged_at DESC LIMIT 1').get(
      profileId,
    ),
  )
}

export function listCheckins(profileId) {
  return db
    .prepare('SELECT * FROM checkins WHERE profile_id = ? ORDER BY local_date DESC, logged_at DESC')
    .all(profileId)
    .map(mapCheckin)
}

export function checkinDates(profileId) {
  return db
    .prepare('SELECT local_date FROM checkins WHERE profile_id = ? ORDER BY local_date DESC')
    .all(profileId)
    .map((row) => row.local_date)
}

export function createSession(fields) {
  db.prepare(
    `INSERT INTO sessions (
      id, profile_id, started_at, ended_at, local_date, status, red_flags_json, hr_source,
      before_overall, after_overall, hour_overall, hour_logged_at, rise, hour_delta, settled,
      level_before, level_after, target_low, target_high, duration_min
    ) VALUES (
      @id, @profileId, @startedAt, @endedAt, @localDate, @status, @redFlagsJson, @hrSource,
      @before, @after, @hour, @hourLoggedAt, @rise, @hourDelta, @settled,
      @levelBefore, @levelAfter, @targetLow, @targetHigh, @durationMin
    )`,
  ).run({
    id: fields.id,
    profileId: fields.profileId,
    startedAt: fields.startedAt,
    endedAt: fields.endedAt ?? null,
    localDate: fields.localDate,
    status: fields.status,
    redFlagsJson: JSON.stringify(fields.redFlags || []),
    hrSource: fields.hrSource ?? null,
    before: fields.before ?? null,
    after: fields.after ?? null,
    hour: fields.hour ?? null,
    hourLoggedAt: fields.hourLoggedAt ?? null,
    rise: fields.rise ?? null,
    hourDelta: fields.hourDelta ?? null,
    settled: fields.settled == null ? null : fields.settled ? 1 : 0,
    levelBefore: fields.levelBefore ?? null,
    levelAfter: fields.levelAfter ?? null,
    targetLow: fields.targetLow ?? null,
    targetHigh: fields.targetHigh ?? null,
    durationMin: fields.durationMin ?? 20,
  })
  return getSession(fields.id)
}

export function getSession(id) {
  return mapSession(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id))
}

export function updateSession(id, patch) {
  const current = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  if (!current) return null
  const next = {
    ended_at: patch.endedAt ?? current.ended_at,
    status: patch.status ?? current.status,
    red_flags_json:
      patch.redFlags !== undefined ? JSON.stringify(patch.redFlags) : current.red_flags_json,
    hr_source: patch.hrSource === undefined ? current.hr_source : patch.hrSource,
    before_overall: patch.before ?? current.before_overall,
    after_overall: patch.after ?? current.after_overall,
    hour_overall: patch.hour ?? current.hour_overall,
    hour_logged_at: patch.hourLoggedAt ?? current.hour_logged_at,
    rise: patch.rise ?? current.rise,
    hour_delta: patch.hourDelta ?? current.hour_delta,
    settled: patch.settled == null ? current.settled : patch.settled ? 1 : 0,
    level_before: patch.levelBefore ?? current.level_before,
    level_after: patch.levelAfter ?? current.level_after,
    target_low: patch.targetLow ?? current.target_low,
    target_high: patch.targetHigh ?? current.target_high,
  }
  db.prepare(
    `UPDATE sessions SET
      ended_at = @ended_at, status = @status, red_flags_json = @red_flags_json, hr_source = @hr_source,
      before_overall = @before_overall, after_overall = @after_overall, hour_overall = @hour_overall,
      hour_logged_at = @hour_logged_at, rise = @rise, hour_delta = @hour_delta, settled = @settled,
      level_before = @level_before, level_after = @level_after, target_low = @target_low, target_high = @target_high
     WHERE id = @id`,
  ).run({ ...next, id })
  return getSession(id)
}

export function listSessions(profileId) {
  return db
    .prepare('SELECT * FROM sessions WHERE profile_id = ? ORDER BY started_at DESC')
    .all(profileId)
    .map(mapSession)
}

export { db }
