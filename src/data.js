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

export function targetZone(age) {
  const max = 220 - Number(age || 16)
  return {
    low: Math.round(max * 0.63),
    high: Math.round(max * 0.68),
  }
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
