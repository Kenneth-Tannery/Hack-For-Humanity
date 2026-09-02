import {
  BUFFALO_PAUSE_ABOVE,
  MAX_HOUR_DELTA,
  MAX_SYMPTOM_RISE,
  SYMPTOMS,
  dayNumberOn,
  outlookFromAnswers,
  targetZone,
} from './clinical.js'

export const LOG_DISCLAIMER =
  'Not medical advice. This log is a prototype record of paced aerobic work and symptom ratings. It does not diagnose concussion or clear return to sport.'

export const LOG_LIMITATIONS = {
  text: 'Threshold does not diagnose concussion, predict recovery time, or clear return to sport. This device log supports symptom monitoring and paced exertion only. Clinical decisions stay with your care team.',
  cite: 'Amsterdam International Consensus Statement on Concussion in Sport, 2023; Buffalo Concussion Treadmill Test protocol',
}

const AMSTERDAM_CITE = 'Amsterdam consensus 2023'
const BUFFALO_CITE = `Buffalo protocol · pause above ${BUFFALO_PAUSE_ABOVE}/10`

function topSymptoms(scores = []) {
  return SYMPTOMS.map((name, i) => ({ name, score: Number(scores[i] ?? 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3)
}

export function sessionOutcome(session) {
  if (session.status === 'blocked_flags') return 'blocked_flags'
  if (session.status === 'blocked_symptoms') return 'blocked_symptoms'
  if (session.status !== 'completed') return 'in_progress'
  const levelBefore = session.levelBefore ?? null
  const levelAfter = session.levelAfter ?? null
  if (levelBefore != null && levelAfter != null && levelAfter > levelBefore) return 'progressed'
  return 'held'
}

function formatRiseDetail(rise) {
  if (rise == null) return 'rise unknown'
  const ok = rise <= MAX_SYMPTOM_RISE
  return `rose ${rise} pt during exercise (${ok ? '≤' : '>'}${MAX_SYMPTOM_RISE})`
}

function formatHourDetail(hourDelta) {
  if (hourDelta == null) return 'hour change unknown'
  const ok = hourDelta <= MAX_HOUR_DELTA
  return `hour rating ${hourDelta >= 0 ? '+' : ''}${hourDelta} from baseline (${ok ? '≤' : '>'}${MAX_HOUR_DELTA})`
}

export function sessionClinicalNote(session) {
  if (session.status === 'blocked_flags') {
    const flags = session.redFlags?.length ? session.redFlags.join('; ') : 'red flags reported'
    return `Session blocked before exercise. ${flags}. Seek clinical care if needed.`
  }
  if (session.status === 'blocked_symptoms') {
    const before = session.before ?? '?'
    return `Session skipped. Symptoms ${before}/10 above safe threshold (Buffalo pause above ${BUFFALO_PAUSE_ABOVE}/10). ${BUFFALO_CITE}.`
  }
  if (session.status !== 'completed') return 'Session in progress or incomplete.'

  const before = session.before ?? '?'
  const after = session.after ?? '?'
  const hour = session.hour ?? '?'
  const rise = session.rise
  const hourDelta = session.hourDelta
  const settled = Boolean(session.settled)
  const lvBefore = session.levelBefore ?? '?'
  const lvAfter = session.levelAfter ?? lvBefore
  const outcome = sessionOutcome(session)

  const parts = [
    `Before ${before} → after ${after} → 1 hr ${hour}.`,
    formatRiseDetail(rise) + '.',
    formatHourDetail(hourDelta) + '.',
    settled
      ? outcome === 'progressed'
        ? `Settled — progressed Level ${lvBefore} → ${lvAfter}.`
        : `Settled — held at Level ${lvBefore}.`
      : `Not settled — held at Level ${lvBefore}.`,
    AMSTERDAM_CITE + '.',
  ]
  return parts.join(' ')
}

export function checkinClinicalNote(checkin) {
  const overall = checkin.overall ?? '?'
  const tops = topSymptoms(checkin.scores)
  const topText = tops.length
    ? tops.map((t) => `${t.name.toLowerCase()} ${t.score}`).join(', ')
    : 'no elevated symptoms'
  const total = checkin.symptomTotal ?? checkin.scores?.reduce((s, n) => s + Number(n || 0), 0) ?? 0
  return `Overall ${overall}/10 · symptom total ${total} · top: ${topText}`
}

function enrichCheckin(item) {
  const tops = topSymptoms(item.scores)
  return {
    type: 'checkin',
    at: item.loggedAt,
    date: item.localDate,
    id: item.id,
    overall: item.overall,
    scores: item.scores,
    symptomTotal: item.symptomTotal ?? item.scores?.reduce((s, n) => s + Number(n || 0), 0),
    topSymptoms: tops,
    note: checkinClinicalNote(item),
    clinical: {
      overall: item.overall,
      symptomTotal: item.symptomTotal,
      topSymptoms: tops,
    },
  }
}

function enrichSession(item) {
  const outcome = sessionOutcome(item)
  return {
    type: 'session',
    at: item.startedAt,
    date: item.localDate,
    id: item.id,
    status: item.status,
    before: item.before,
    after: item.after,
    hour: item.hour,
    rise: item.rise,
    hourDelta: item.hourDelta,
    settled: item.settled,
    levelBefore: item.levelBefore,
    levelAfter: item.levelAfter,
    zone: item.zone,
    hrSource: item.hrSource,
    redFlags: item.redFlags ?? [],
    outcome,
    note: sessionClinicalNote(item),
    clinical: {
      before: item.before,
      after: item.after,
      hour: item.hour,
      rise: item.rise,
      hourDelta: item.hourDelta,
      settled: item.settled,
      levelBefore: item.levelBefore,
      levelAfter: item.levelAfter,
      zone: item.zone,
      hrSource: item.hrSource,
      redFlags: item.redFlags ?? [],
      outcome,
      cite: AMSTERDAM_CITE,
      buffaloCite: BUFFALO_CITE,
    },
  }
}

export function buildClinicianLog({ profile, checkins, sessions, localDate }) {
  const timeline = [
    ...checkins.map(enrichCheckin),
    ...sessions.map(enrichSession),
  ].sort((a, b) => (a.at < b.at ? 1 : -1))

  const completed = sessions.filter((s) => s.status === 'completed')
  const settled = completed.filter((s) => s.settled)
  const progressed = completed.filter((s) => sessionOutcome(s) === 'progressed')
  const held = completed.filter((s) => sessionOutcome(s) === 'held')

  return {
    generatedAt: new Date().toISOString(),
    disclaimer: LOG_DISCLAIMER,
    limitations: LOG_LIMITATIONS,
    profile: {
      injuryDate: profile.injuryDate,
      age: profile.age,
      day: dayNumberOn(profile.injuryDate, localDate),
      level: profile.level,
      outlook: outlookFromAnswers(profile.answers),
      zone: targetZone(profile.age, profile.level),
      inMaintenance: (profile.progressionPhase ?? 'training') === 'maintenance',
      progressionPhase: profile.progressionPhase ?? 'training',
      level5StableStreak: profile.level5StableStreak ?? 0,
    },
    summary: {
      checkins: checkins.length,
      sessions: sessions.length,
      completedSessions: completed.length,
      blockedFlags: sessions.filter((s) => s.status === 'blocked_flags').length,
      blockedSymptoms: sessions.filter((s) => s.status === 'blocked_symptoms').length,
      settledSessions: settled.length,
      progressedSessions: progressed.length,
      heldSessions: held.length,
    },
    timeline,
  }
}

function sessionMarkdownTitle(item) {
  if (item.outcome === 'blocked_flags') return `Session (blocked · red flags)`
  if (item.outcome === 'blocked_symptoms') return `Session (skipped · symptoms above threshold)`
  if (item.status !== 'completed') return `Session (${item.status || 'incomplete'})`
  const lv = item.levelBefore ?? '?'
  if (item.outcome === 'progressed') return `Session (completed · progressed to Level ${item.levelAfter ?? '?'})`
  return `Session (completed · held at Level ${lv})`
}

export function formatClinicianLogMarkdown(log) {
  if (!log) return ''
  const p = log.profile ?? {}
  const s = log.summary ?? {}
  const zone = p.zone ? `${p.zone.low}–${p.zone.high} bpm` : '—'
  const lines = [
    '# Threshold recovery log',
    '',
    `Generated: ${log.generatedAt ?? new Date().toISOString()} | Not medical advice | Does not clear return to sport`,
    '',
    log.disclaimer ?? LOG_DISCLAIMER,
    '',
    '## Profile',
    `- Injury: ${p.injuryDate ?? '—'} | Age ${p.age ?? '—'} | Day ${p.day ?? '—'} | Level ${p.level ?? '—'}`,
    `- Maintenance: ${p.inMaintenance ? 'yes' : 'no'} | Target zone: ${zone} (${BUFFALO_CITE})`,
    p.outlook?.longer
      ? `- Outlook: recovery may take longer (risk factors: ${(p.outlook.reasons ?? []).join(', ') || 'reported'})`
      : `- Outlook: typical recovery window`,
    '',
    '## Limitations',
    log.limitations?.text ?? LOG_LIMITATIONS.text,
    log.limitations?.cite ? `Source: ${log.limitations.cite}` : '',
    '',
    '## Summary',
    `${s.checkins ?? 0} check-in${s.checkins === 1 ? '' : 's'} · ${s.completedSessions ?? 0} completed session${s.completedSessions === 1 ? '' : 's'} · ${s.settledSessions ?? 0} settled · ${s.progressedSessions ?? 0} progressed · ${s.heldSessions ?? 0} held`,
    ...(s.blockedFlags || s.blockedSymptoms
      ? [` · ${(s.blockedFlags ?? 0) + (s.blockedSymptoms ?? 0)} blocked`]
      : []),
    '',
    '## Timeline',
  ]

  if (!log.timeline?.length) {
    lines.push('', '_No entries yet._')
  } else {
    for (const item of log.timeline) {
      lines.push('')
      if (item.type === 'checkin') {
        lines.push(`### ${item.date} — Check-in`)
        lines.push(item.note ?? checkinClinicalNote(item))
      } else {
        lines.push(`### ${item.date} — ${sessionMarkdownTitle(item)}`)
        lines.push(item.note ?? sessionClinicalNote(item))
        if (item.hrSource) lines.push(`HR source: ${item.hrSource}`)
        if (item.redFlags?.length) lines.push(`Red flags: ${item.redFlags.join('; ')}`)
      }
    }
  }

  lines.push('')
  return lines.filter((line) => line !== undefined).join('\n')
}
