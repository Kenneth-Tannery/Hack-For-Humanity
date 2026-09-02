const AUDIO_KEY = 'threshold-audio-checkin'
const VOICE_GUIDE_KEY = 'threshold-voice-guide'

/** Preferred soft / calm voices (name match, case-insensitive). First match wins. */
const SOFT_VOICE_PATTERNS = [
  /samantha/i,
  /karen/i,
  /moira/i,
  /fiona/i,
  /tessa/i,
  /victoria/i,
  /zira/i,
  /google UK English Female/i,
  /google US English/i,
  /Microsoft.*(Natural|Jenny|Aria|Sara)/i,
  /female/i,
  /siri/i,
]

/** @type {{ canSpeak: () => boolean, speak: (text: string) => void, cancel: () => void } | null} */
let engine = null
let cachedVoice = null
let voicesReady = false
let lastSpoken = ''

function scoreVoice(voice) {
  const name = `${voice.name} ${voice.lang}`
  for (let i = 0; i < SOFT_VOICE_PATTERNS.length; i += 1) {
    if (SOFT_VOICE_PATTERNS[i].test(name)) return 100 - i
  }
  if (/^en(-|_)/i.test(voice.lang)) return 10
  return 0
}

function pickSoftVoice(synth) {
  const voices = synth.getVoices?.() || []
  if (!voices.length) return null
  let best = null
  let bestScore = -1
  for (const voice of voices) {
    const score = scoreVoice(voice)
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return best
}

function ensureVoices(synth) {
  if (voicesReady && cachedVoice) return cachedVoice
  cachedVoice = pickSoftVoice(synth)
  if (cachedVoice || (synth.getVoices?.() || []).length) voicesReady = true
  return cachedVoice
}

function browserEngine() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  if (synth && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', () => {
      voicesReady = false
      cachedVoice = null
      ensureVoices(synth)
    })
  }
  return {
    canSpeak() {
      return Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function')
    },
    speak(text) {
      if (!synth || !text) return
      synth.cancel()
      const utter = new window.SpeechSynthesisUtterance(String(text))
      // Softer, slower delivery for concussion-friendly listening
      utter.rate = 0.86
      utter.pitch = 0.9
      utter.volume = 0.85
      const voice = ensureVoices(synth)
      if (voice) utter.voice = voice
      if (voice?.lang) utter.lang = voice.lang
      else utter.lang = 'en-US'
      synth.speak(utter)
    },
    cancel() {
      synth?.cancel()
    },
  }
}

function getEngine() {
  if (!engine) engine = browserEngine()
  return engine
}

/** Inject a mock for tests or console logging. Pass null to restore the browser engine. */
export function setSpeechEngine(next) {
  engine = next
  lastSpoken = ''
}

export function canSpeak() {
  return getEngine().canSpeak()
}

export function speak(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return
  lastSpoken = trimmed
  getEngine().speak(trimmed)
}

export function cancelSpeak() {
  getEngine().cancel()
}

export function repeatLast() {
  if (lastSpoken) getEngine().speak(lastSpoken)
}

export function getLastSpoken() {
  return lastSpoken
}

/** Short check-in lines — less fatiguing than long sentences. */
export function symptomPrompt(name) {
  return `${name}. Zero to six.`
}

export function overallPrompt() {
  return 'Overall. Zero is fine. Ten is worst. Choose, then save.'
}

/**
 * Calm one-line prompts for each screen when full-app voice guide is on.
 * Keep short: easier to hear when symptomatic.
 */
export function screenPrompt(screen, ctx = {}) {
  const day = ctx.day != null ? `Day ${ctx.day}.` : ''
  const level = ctx.level != null ? `Level ${ctx.level}.` : ''
  const overall = ctx.overall != null ? `${ctx.overall} out of 10.` : ''
  const zone =
    ctx.zone?.low != null ? `Target ${ctx.zone.low} to ${ctx.zone.high}.` : ''

  switch (screen) {
    case 'splash':
      return 'Threshold. Paced recovery after concussion. Tap to continue.'
    case 'disclaimer':
      return 'Read this first. This paces exercise and keeps a log. It does not diagnose or clear return to sport. Tap I understand.'
    case 'injury':
      return 'When did the injury happen? Enter the date and your age, then continue.'
    case 'risk-consent':
      return 'Optional questions about you. Answer to set expectations, or skip.'
    case 'risk':
      return ctx.riskTitle
        ? `${ctx.riskTitle} Yes, no, or skip if shown.`
        : 'Risk question. Yes or no.'
    case 'outlook':
      return 'Your outlook. This is not a diagnosis. Tap Start when ready.'
    case 'home':
      if (ctx.inMaintenance) {
        return ctx.logged
          ? `Maintenance mode. ${day} Symptoms logged. Log again anytime.`
          : `Maintenance mode. ${day} Log symptoms today. No prescribed exercise.`
      }
      if (ctx.logged) {
        return `Today. ${day} ${level} Symptoms logged. Start session, or log again.`
      }
      return `Today. ${day} ${level} Log symptoms before you start a session.`
    case 'checkin':
      return ctx.pendingSession
        ? 'Log symptoms first. A session needs today’s rating. Start with audio, or without.'
        : 'Daily check-in. Start with audio, or without.'
    case 'symptom':
      return ctx.symptomName ? symptomPrompt(ctx.symptomName) : 'Symptom. Zero to six.'
    case 'overall':
      return overallPrompt()
    case 'red-flags':
      return 'Before you start. Any red flags right now? None of these, or one or more apply.'
    case 'emergency':
      return 'Stop. Do not exercise. Get medical help now. Call emergency services. Or say you’ve got help to go back.'
    case 'not-today':
      return `Not today. Symptoms ${overall} Above the safe level for exercise. Log symptoms instead, or go back.`
    case 'preflight':
      return `Before you start. Right now ${overall} ${zone} Start warmup when ready.`
    case 'connect-ble':
      return 'Connect a chest strap, or use the camera instead.'
    case 'connect-camera':
      return 'Lock your pulse. Remove your phone case if you have one. Cover camera and flash. When a number appears, hold still about three seconds, then hands free.'
    case 'pulse-resync':
      return 'Quick pulse check. Remove your phone case if needed. Cover camera and flash briefly, then continue.'
    case 'warmup':
      return 'Warmup. Ease in gently. Skip to target when ready, or stop.'
    case 'active':
      return `Steady state. ${zone} Hold here. Dim the screen, or stop.`
    case 'glance':
      return 'Glance mode. Heart rate on screen. Tap to return.'
    case 'after':
      return 'After session. How do you feel now? Choose a rating, then save.'
    case 'hour':
      return 'One hour later. How do you feel now? Choose a rating on the same scale.'
    case 'held': {
      const levelBefore = Number(ctx.levelBefore ?? ctx.level ?? 2)
      const next = Math.min(5, levelBefore + 1)
      if (ctx.graduated) {
        return 'Progression complete. Three stable Level 5 sessions done. Maintenance mode starts tomorrow. Symptom check-in only.'
      }
      if (ctx.settled && next > levelBefore) {
        return `Moving up to level ${next}. Symptoms stayed inside the rule. See you tomorrow.`
      }
      if (ctx.settled && levelBefore >= 5) {
        const streak = ctx.level5StableStreak ?? 0
        const required = 3
        if (streak > 0 && streak < required) {
          return `Level 5. Stable session ${streak} of ${required}. See you tomorrow.`
        }
        return 'Level 5. Top of the progression. See you tomorrow.'
      }
      return `Staying at level ${levelBefore}. Try again tomorrow.`
    }
    case 'settings':
      return 'Settings. Voice guide and theme. Open recovery log for your clinician. Back when done.'
    case 'clinician-log':
      return 'Recovery log. Timeline of check-ins and sessions for your clinician. Not medical advice.'
    default:
      return ''
  }
}

/** Every navigable screen should have a non-empty guide line. */
export const VOICE_SCREENS = [
  'splash',
  'disclaimer',
  'injury',
  'risk-consent',
  'risk',
  'outlook',
  'home',
  'checkin',
  'symptom',
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
  'held',
  'settings',
  'clinician-log',
]


export function readAudioPreference() {
  if (typeof localStorage === 'undefined') return canSpeak()
  const raw = localStorage.getItem(AUDIO_KEY)
  if (raw === null) return canSpeak()
  return raw === '1'
}

export function writeAudioPreference(on) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(AUDIO_KEY, on ? '1' : '0')
}

export function readVoiceGuidePreference() {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(VOICE_GUIDE_KEY) === '1'
}

export function writeVoiceGuidePreference(on) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(VOICE_GUIDE_KEY, on ? '1' : '0')
}

export { AUDIO_KEY, VOICE_GUIDE_KEY }
