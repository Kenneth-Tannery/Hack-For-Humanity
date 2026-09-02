/**
 * Build public/audio/voice/manifest.json + voice-lines.tsv for Kokoro batch export.
 *
 * Run: npm run voice:manifest
 *
 * Then open scripts/KOKORO_VOICE.md and generate clips on OfflineTTS (or similar).
 */

import fs from 'node:fs'
import path from 'node:path'
import { SYMPTOMS, RISK_QUESTIONS } from '../src/data.js'
import { overallPrompt, screenPrompt, symptomPrompt } from '../src/speech.js'

const ROOT = path.resolve('public/audio/voice')
const MANIFEST_PATH = path.join(ROOT, 'manifest.json')
const TSV_PATH = path.join(ROOT, 'voice-lines.tsv')

/** Kokoro voice IDs — pick one calm US English voice for the whole app. */
export const RECOMMENDED_VOICE = 'af_heart'
export const RECOMMENDED_SPEED = 0.92

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function clip(id, text) {
  return { id, text, file: `${id}.mp3` }
}

function buildClips() {
  const clips = []

  const staticScreens = [
    'splash',
    'disclaimer',
    'injury',
    'risk-consent',
    'outlook',
    'checkin',
    'checkin-pending',
    'overall',
    'red-flags',
    'emergency',
    'not-today',
    'preflight',
    'connect-ble',
    'connect-camera',
    'pulse-resync',
    'warmup',
    'active',
    'glance',
    'after',
    'hour',
    'settings',
    'clinician-log',
  ]

  for (const screen of staticScreens) {
    if (screen === 'checkin-pending') {
      clips.push(
        clip(
          'checkin-pending',
          screenPrompt('checkin', { pendingSession: true }),
        ),
      )
      continue
    }
    if (screen === 'active') {
      clips.push(clip('active', screenPrompt('active', { zone: { low: 120, high: 140 } })))
      continue
    }
    if (screen === 'not-today') {
      clips.push(clip('not-today', screenPrompt('not-today', { overall: 8 })))
      continue
    }
    if (screen === 'preflight') {
      clips.push(
        clip(
          'preflight',
          screenPrompt('preflight', { overall: 3, zone: { low: 120, high: 140 } }),
        ),
      )
      continue
    }
    clips.push(clip(screen, screenPrompt(screen, {})))
  }

  clips.push(clip('home-not-logged', screenPrompt('home', { day: 1, level: 2, logged: false })))
  clips.push(clip('home-logged', screenPrompt('home', { day: 1, level: 2, logged: true })))
  clips.push(
    clip(
      'home-maintenance',
      screenPrompt('home', { day: 10, level: 5, logged: false, inMaintenance: true }),
    ),
  )
  clips.push(
    clip(
      'home-maintenance-logged',
      screenPrompt('home', { day: 10, level: 5, logged: true, inMaintenance: true }),
    ),
  )

  clips.push(clip('held-level-up', screenPrompt('held', { settled: true, levelBefore: 2, level: 2 })))
  clips.push(
    clip(
      'held-stay',
      screenPrompt('held', { settled: false, levelBefore: 3, level: 3, hour: 4, before: 0, after: 4 }),
    ),
  )
  clips.push(
    clip(
      'held-level-5',
      screenPrompt('held', { settled: true, levelBefore: 5, level: 5, level5StableStreak: 1 }),
    ),
  )
  clips.push(
    clip(
      'held-level-5-streak',
      screenPrompt('held', {
        settled: true,
        levelBefore: 5,
        level: 5,
        level5StableStreak: 2,
      }),
    ),
  )
  clips.push(
    clip('held-graduated', screenPrompt('held', { settled: true, levelBefore: 5, graduated: true })),
  )

  for (const name of SYMPTOMS) {
    const id = `symptom-${slug(name)}`
    clips.push(clip(id, symptomPrompt(name)))
  }

  clips.push(clip('overall', overallPrompt()))

  for (const q of RISK_QUESTIONS) {
    clips.push(clip(`risk-${q.id}`, `${q.title} Yes, no, or skip if shown.`))
  }

  return clips
}

const clips = buildClips()
const manifest = {
  engine: 'kokoro',
  recommendedVoice: RECOMMENDED_VOICE,
  recommendedSpeed: RECOMMENDED_SPEED,
  sourceUrl: 'https://offlinetts.com/app/',
  voiceLibraryUrl: 'https://offlinetts.com/voice/',
  generatedAt: new Date().toISOString(),
  clipCount: clips.length,
  clips,
}

fs.mkdirSync(ROOT, { recursive: true })
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

const tsv = ['id\ttext\tfile', ...clips.map((c) => `${c.id}\t${c.text.replace(/\t/g, ' ')}\t${c.file}`)].join(
  '\n',
)
fs.writeFileSync(TSV_PATH, `${tsv}\n`)

console.log(`Wrote ${clips.length} clips to ${MANIFEST_PATH}`)
console.log(`Wrote batch sheet to ${TSV_PATH}`)
console.log(`Recommended Kokoro voice: ${RECOMMENDED_VOICE} at speed ${RECOMMENDED_SPEED}`)
