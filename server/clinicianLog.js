import {
  BUFFALO_PAUSE_ABOVE,
  MAX_HOUR_DELTA,
  MAX_SYMPTOM_RISE,
  OVERALL_LABELS,
  RISK_QUESTIONS,
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
const SYMPTOM_SCALE_MAX = 6
const SYMPTOM_COUNT = SYMPTOMS.length
const SYMPTOM_TOTAL_MAX = SYMPTOM_COUNT * SYMPTOM_SCALE_MAX

const SYMPTOM_SEVERITY = {
  0: 'none',
  1: 'barely there',
  2: 'mild',
  3: 'noticeable',
  4: 'getting in the way',
  5: 'strong',
  6: 'severe',
}

const ANSWER_LABELS = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Unsure',
  skip: 'Skipped',
}

function topSymptoms(scores = []) {
  return SYMPTOMS.map((name, i) => ({ name, score: Number(scores[i] ?? 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3)
}

function symptomRows(scores = []) {
  return SYMPTOMS.map((name, i) => {
    const score = Number(scores[i] ?? 0)
    return {
      name,
      score,
      severity: SYMPTOM_SEVERITY[score] ?? String(score),
    }
  })
}

function overallSeverityLabel(overall) {
  if (overall == null) return '—'
  return OVERALL_LABELS[overall] ?? `${overall}/10`
}

function symptomTotalBand(total) {
  if (total <= 10) return 'low burden'
  if (total <= 30) return 'moderate burden'
  return 'high burden'
}

function formatRiskAnswers(answers = {}) {
  return RISK_QUESTIONS.map((q) => {
    const raw = answers[q.id]
    if (raw == null || raw === 'skip') {
      return { id: q.id, question: q.title, answer: raw === 'skip' ? 'Skipped' : 'Not answered' }
    }
    return { id: q.id, question: q.title, answer: ANSWER_LABELS[raw] ?? raw }
  }).filter((row) => row.answer !== 'Not answered' || Object.keys(answers).length > 0)
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
  return `Overall ${overall}/10 (${overallSeverityLabel(checkin.overall)}) · symptom total ${total}/${SYMPTOM_TOTAL_MAX} (${symptomTotalBand(total)}) · top: ${topText}`
}

function enrichCheckin(item) {
  const tops = topSymptoms(item.scores)
  const rows = symptomRows(item.scores)
  const total =
    item.symptomTotal ?? item.scores?.reduce((s, n) => s + Number(n || 0), 0) ?? 0
  return {
    type: 'checkin',
    at: item.loggedAt,
    date: item.localDate,
    id: item.id,
    overall: item.overall,
    overallSeverity: overallSeverityLabel(item.overall),
    scores: item.scores,
    symptomTotal: total,
    symptomTotalMax: SYMPTOM_TOTAL_MAX,
    symptomBurden: symptomTotalBand(total),
    symptomRows: rows,
    topSymptoms: tops,
    note: checkinClinicalNote(item),
    clinical: {
      overall: item.overall,
      overallSeverity: overallSeverityLabel(item.overall),
      symptomTotal: total,
      symptomTotalMax: SYMPTOM_TOTAL_MAX,
      symptomBurden: symptomTotalBand(total),
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
  const riskAnswers = formatRiskAnswers(profile.answers ?? {})

  return {
    generatedAt: new Date().toISOString(),
    disclaimer: LOG_DISCLAIMER,
    limitations: LOG_LIMITATIONS,
    glossary: {
      symptomTotal:
        `Sum of ${SYMPTOM_COUNT} symptom scores (0–${SYMPTOM_SCALE_MAX} each). Maximum ${SYMPTOM_TOTAL_MAX}. Not a diagnosis — shows burden across the checklist.`,
      overall:
        'Single 0–10 rating for how the patient feels overall that day.',
    },
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
      riskAnswers,
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

function mdEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.map(mdEscape).join(' | ')} |`).join('\n')
  return [head, sep, body].filter(Boolean).join('\n')
}

function sessionMarkdownTitle(item) {
  if (item.outcome === 'blocked_flags') return `Session (blocked · red flags)`
  if (item.outcome === 'blocked_symptoms') return `Session (skipped · symptoms above threshold)`
  if (item.status !== 'completed') return `Session (${item.status || 'incomplete'})`
  if (item.outcome === 'progressed') return `Session (completed · progressed to Level ${item.levelAfter ?? '?'})`
  return `Session (completed · held at Level ${item.levelBefore ?? '?'})`
}

function checkinMarkdownSection(item) {
  const lines = [
    `### ${item.date} — Check-in`,
    '',
    `**Overall:** ${item.overall ?? '?'}/10 — ${item.overallSeverity ?? '—'}`,
    `**Symptom total:** ${item.symptomTotal ?? '?'}/${item.symptomTotalMax ?? SYMPTOM_TOTAL_MAX} — ${item.symptomBurden ?? '—'}`,
    '_Symptom total = sum of all checklist items (0–6 each). Lower is better._',
    '',
    mdTable(
      ['Symptom', 'Score (0–6)', 'Severity'],
      (item.symptomRows ?? []).map((row) => [row.name, row.score, row.severity]),
    ),
    '',
    item.note ?? checkinClinicalNote(item),
  ]
  return lines.join('\n')
}

export function formatClinicianLogMarkdown(log) {
  if (!log) return ''
  const p = log.profile ?? {}
  const s = log.summary ?? {}
  const zone = p.zone ? `${p.zone.low}–${p.zone.high} bpm` : '—'
  const riskRows = (p.riskAnswers ?? []).filter((r) => r.answer !== 'Not answered' && r.answer !== 'Skipped')

  const lines = [
    '# Threshold recovery log',
    '',
    `Generated: ${log.generatedAt ?? new Date().toISOString()} | Not medical advice | Does not clear return to sport`,
    '',
    log.disclaimer ?? LOG_DISCLAIMER,
    '',
    '## How to read this log',
    '',
    '| Term | Meaning |',
    '| --- | --- |',
    `| Symptom total | ${log.glossary?.symptomTotal ?? 'Sum of 22 symptom scores (0–6 each)'} |`,
    `| Overall | ${log.glossary?.overall ?? '0–10 how the patient feels that day'} |`,
    '| Severity (0–6) | none → severe on each symptom line |',
    '',
    '## Profile',
    '',
    mdTable(
      ['Field', 'Value'],
      [
        ['Injury date', p.injuryDate ?? '—'],
        ['Age', p.age ?? '—'],
        ['Recovery day', p.day ?? '—'],
        ['Training level', p.level ?? '—'],
        ['Maintenance mode', p.inMaintenance ? 'yes' : 'no'],
        ['Target HR zone', zone],
        [
          'Outlook',
          p.outlook?.longer
            ? `May take longer (${(p.outlook.reasons ?? []).join(', ') || 'risk factors'})`
            : 'Typical recovery window',
        ],
      ],
    ),
    '',
    '## Limitations',
    '',
    log.limitations?.text ?? LOG_LIMITATIONS.text,
    log.limitations?.cite ? `Source: ${log.limitations.cite}` : '',
    '',
  ]

  if (riskRows.length) {
    lines.push(
      '## Optional onboarding answers',
      '',
      '_Patient chose to answer these during setup. Skipped questions are omitted._',
      '',
      mdTable(
        ['Question', 'Answer'],
        riskRows.map((r) => [r.question, r.answer]),
      ),
      '',
    )
  }

  lines.push(
    '## Summary',
    '',
    mdTable(
      ['Metric', 'Count'],
      [
        ['Check-ins', s.checkins ?? 0],
        ['Completed sessions', s.completedSessions ?? 0],
        ['Settled sessions', s.settledSessions ?? 0],
        ['Progressed', s.progressedSessions ?? 0],
        ['Held at level', s.heldSessions ?? 0],
        ['Blocked (flags or symptoms)', (s.blockedFlags ?? 0) + (s.blockedSymptoms ?? 0)],
      ],
    ),
    '',
    '## Timeline',
  )

  if (!log.timeline?.length) {
    lines.push('', '_No entries yet._')
  } else {
    const sessionRows = []
    for (const item of log.timeline) {
      if (item.type === 'checkin') {
        lines.push('', checkinMarkdownSection(item))
      } else {
        sessionRows.push([
          item.date,
          sessionMarkdownTitle(item).replace(/^Session /, ''),
          item.before ?? '—',
          item.after ?? '—',
          item.hour ?? '—',
          item.settled ? 'yes' : 'no',
          item.levelBefore ?? '—',
          item.levelAfter ?? '—',
        ])
      }
    }
    if (sessionRows.length) {
      lines.push(
        '',
        '### Sessions (summary table)',
        '',
        mdTable(
          ['Date', 'Outcome', 'Before', 'After', '1 hr', 'Settled', 'Lv before', 'Lv after'],
          sessionRows,
        ),
      )
    }
    for (const item of log.timeline) {
      if (item.type !== 'session') continue
      lines.push('', `### ${item.date} — ${sessionMarkdownTitle(item)}`, '', item.note ?? sessionClinicalNote(item))
      if (item.hrSource) lines.push(`HR source: ${item.hrSource}`)
      if (item.redFlags?.length) lines.push(`Red flags: ${item.redFlags.join('; ')}`)
    }
  }

  lines.push('')
  return lines.filter((line) => line !== undefined).join('\n')
}
