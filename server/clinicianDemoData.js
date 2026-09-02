import { SYMPTOMS, targetZone } from './clinical.js'

/** Injury Aug 20 → demo “today” Sep 6 (day 18). Three held sessions, then climb to Level 5 + maintenance. */
export const CLINICIAN_DEMO_INJURY = '2026-08-20'
export const CLINICIAN_DEMO_LOCAL_DATE = '2026-09-06'
export const CLINICIAN_DEMO_AGE = 16

function scoresFrom(map = {}) {
  return SYMPTOMS.map((_, i) => Number(map[i] ?? 0))
}

function symptomTotal(scores) {
  return scores.reduce((sum, n) => sum + Number(n || 0), 0)
}

function mkCheckin(id, profileId, date, overall, scoreMap, time = '09:00') {
  const scores = scoresFrom(scoreMap)
  return {
    id,
    profileId,
    localDate: date,
    loggedAt: `${date}T${time}:00.000Z`,
    scores,
    overall,
    symptomTotal: symptomTotal(scores),
  }
}

function mkSession(id, profileId, date, levelBefore, opts = {}) {
  const {
    status = 'completed',
    before,
    after,
    hour,
    levelAfter,
    settled,
    redFlags = [],
    hrSource = 'camera',
    time = '10:00',
  } = opts
  const rise =
    after != null && before != null ? Number(after) - Number(before) : null
  const hourDelta =
    hour != null && before != null ? Number(hour) - Number(before) : null
  const zone = targetZone(CLINICIAN_DEMO_AGE, levelBefore)
  const endHour = String(Number(time.split(':')[0]) + 1).padStart(2, '0')
  return {
    id,
    profileId,
    localDate: date,
    startedAt: `${date}T${time}:00.000Z`,
    endedAt: `${date}T${endHour}:00:00.000Z`,
    hourLoggedAt: `${date}T${endHour}:00:00.000Z`,
    status,
    redFlags,
    hrSource,
    before,
    after,
    hour,
    rise,
    hourDelta,
    settled,
    levelBefore,
    levelAfter: levelAfter ?? levelBefore,
    zone: { low: zone.low, high: zone.high },
    durationMin: 20,
  }
}

/**
 * Rich demo: daily check-ins, 3 failed (held) sessions at Level 2, progression to Level 5,
 * then maintenance sessions at Level 5.
 */
export function buildClinicianDemoRecords(profileId = 'e2e-clinician-demo') {
  const checkins = [
    // Early recovery — higher symptom burden
    mkCheckin('ck-d01', profileId, '2026-08-20', 5, { 0: 3, 4: 2, 14: 2, 20: 1 }),
    mkCheckin('ck-d02', profileId, '2026-08-21', 4, { 0: 2, 4: 2, 14: 2 }),
    mkCheckin('ck-d03', profileId, '2026-08-22', 4, { 0: 2, 14: 1, 7: 1 }),
    mkCheckin('ck-d04', profileId, '2026-08-23', 4, { 0: 2, 14: 1 }),
    mkCheckin('ck-d05', profileId, '2026-08-24', 3, { 0: 2, 14: 1 }),
    // First success + mid recovery
    mkCheckin('ck-d06', profileId, '2026-08-25', 3, { 0: 1, 14: 1 }),
    mkCheckin('ck-d07', profileId, '2026-08-26', 3, { 0: 1, 14: 1, 7: 1 }),
    mkCheckin('ck-d08', profileId, '2026-08-27', 3, { 0: 1, 14: 1 }),
    mkCheckin('ck-d09', profileId, '2026-08-28', 2, { 0: 1, 14: 1 }),
    mkCheckin('ck-d10', profileId, '2026-08-29', 2, { 0: 1 }),
    mkCheckin('ck-d11', profileId, '2026-08-30', 2, { 0: 1 }),
    mkCheckin('ck-d12', profileId, '2026-08-31', 2, { 0: 1 }),
    mkCheckin('ck-d13', profileId, '2026-09-01', 2, { 0: 1 }),
    mkCheckin('ck-d14', profileId, '2026-09-02', 1, { 0: 1 }),
    mkCheckin('ck-d15', profileId, '2026-09-03', 1, { 0: 1 }),
    mkCheckin('ck-d16', profileId, '2026-09-04', 1, {}),
    mkCheckin('ck-d17', profileId, '2026-09-05', 1, {}),
    mkCheckin('ck-d18', profileId, '2026-09-06', 1, {}),
  ]

  const sessions = [
    // Day 2 — symptoms too high to start (Buffalo pause)
    mkSession('sess-d02-skip', profileId, '2026-08-21', 2, {
      status: 'blocked_symptoms',
      before: 8,
      after: null,
      hour: null,
      settled: false,
      levelAfter: 2,
    }),
    // Three failed attempts at Level 2 (symptoms did not settle within an hour)
    mkSession('sess-fail-1', profileId, '2026-08-22', 2, {
      before: 3,
      after: 6,
      hour: 5,
      settled: false,
      levelAfter: 2,
    }),
    mkSession('sess-fail-2', profileId, '2026-08-23', 2, {
      before: 3,
      after: 4,
      hour: 6,
      settled: false,
      levelAfter: 2,
    }),
    mkSession('sess-fail-3', profileId, '2026-08-24', 2, {
      before: 4,
      after: 5,
      hour: 7,
      settled: false,
      levelAfter: 2,
    }),
    // Progression ladder
    mkSession('sess-pass-l3', profileId, '2026-08-25', 2, {
      before: 3,
      after: 4,
      hour: 4,
      settled: true,
      levelAfter: 3,
    }),
    mkSession('sess-hold-l3', profileId, '2026-08-26', 3, {
      before: 3,
      after: 6,
      hour: 5,
      settled: false,
      levelAfter: 3,
    }),
    mkSession('sess-pass-l4', profileId, '2026-08-27', 3, {
      before: 3,
      after: 4,
      hour: 3,
      settled: true,
      levelAfter: 4,
    }),
    mkSession('sess-pass-l5', profileId, '2026-08-28', 4, {
      before: 2,
      after: 3,
      hour: 2,
      settled: true,
      levelAfter: 5,
    }),
    // Level 5 — building stable streak then maintenance
    mkSession('sess-l5-a', profileId, '2026-08-29', 5, {
      before: 2,
      after: 3,
      hour: 3,
      settled: true,
      levelAfter: 5,
    }),
    mkSession('sess-l5-b', profileId, '2026-08-30', 5, {
      before: 2,
      after: 3,
      hour: 2,
      settled: true,
      levelAfter: 5,
    }),
    mkSession('sess-l5-c', profileId, '2026-08-31', 5, {
      before: 2,
      after: 3,
      hour: 2,
      settled: true,
      levelAfter: 5,
    }),
    mkSession('sess-maint-1', profileId, '2026-09-01', 5, {
      before: 1,
      after: 2,
      hour: 1,
      settled: true,
      levelAfter: 5,
    }),
    mkSession('sess-maint-2', profileId, '2026-09-03', 5, {
      before: 1,
      after: 2,
      hour: 2,
      settled: true,
      levelAfter: 5,
    }),
    mkSession('sess-maint-3', profileId, '2026-09-05', 5, {
      before: 1,
      after: 2,
      hour: 1,
      settled: true,
      levelAfter: 5,
    }),
  ]

  const profile = {
    id: profileId,
    injuryDate: CLINICIAN_DEMO_INJURY,
    age: CLINICIAN_DEMO_AGE,
    answers: {
      prior: 'yes',
      repeat: 'no',
      migraine: 'yes',
      anxiety: 'unsure',
      sport: 'yes',
    },
    level: 5,
    level5StableStreak: 3,
    progressionPhase: 'maintenance',
    hrSource: 'camera',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: `${CLINICIAN_DEMO_LOCAL_DATE}T08:00:00.000Z`,
  }

  return {
    profile,
    checkins,
    sessions,
    localDate: CLINICIAN_DEMO_LOCAL_DATE,
  }
}
