import { useEffect, useRef, useState } from 'react'
import * as api from './api.js'
import { dayNumber, localDate, RISK_QUESTIONS, SYMPTOMS, targetZone } from './data.js'
import { evaluateProgression, recordLevel5Progress } from '../server/clinical.js'
import {
  Active,
  After,
  Checkin,
  ClinicianLog,
  ConnectBle,
  ConnectCamera,
  DisclaimerScreen,
  Emergency,
  Glance,
  Held,
  Home,
  HourLater,
  Injury,
  NotToday,
  Outlook,
  Overall,
  Phone,
  Preflight,
  PulseResync,
  RedFlags,
  Risk,
  RiskConsent,
  Settings,
  Splash,
  Symptom,
  Warmup,
} from './screens.jsx'
import {
  bindAudioUnlock,
  canSpeak,
  cancelSpeak,
  markVoiceClipsAvailable,
  readAudioPreference,
  readVoiceGuidePreference,
  repeatLast,
  speakScreen,
  unlockAudio,
  writeAudioPreference,
  writeVoiceGuidePreference,
} from './speech.js'
import { warmVoiceClips } from './voiceClips.js'
import { VoiceDock, SaveError } from './ui.jsx'

const e2eMode =
  typeof window !== 'undefined' &&
  (window.Cypress || new URLSearchParams(window.location.search).get('e2e') === '1')

const THEME_KEY = 'threshold-theme'
const SAVE_PROFILE = 'Could not save your setup. Check the connection, then tap Start again.'
const SAVE_CHECKIN = 'Could not save today’s check-in. Try Save again.'
const SAVE_SESSION =
  'Could not record this session on the server. You can continue; it may not appear in your log.'
const SAVE_AFTER = 'Could not save that rating. Try Save again.'
const SAVE_HOUR = 'Could not save the follow-up rating. Try again.'
const SAVE_SOURCE = 'Could not save the heart-rate source.'
const LOAD_TODAY = 'Could not load today. Check the connection.'
const PROFILE_GONE = 'Saved profile was not found. Please set up again.'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [screen, setScreen] = useState(() => (api.savedProfileId() ? 'home' : 'splash'))
  const [settingsBack, setSettingsBack] = useState('home')
  const [injuryDate, setInjuryDate] = useState(() => localDate())
  const [age, setAge] = useState('16')
  const [riskIndex, setRiskIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [flags, setFlags] = useState([])
  const [scores, setScores] = useState(() => Array(SYMPTOMS.length).fill(null))
  const [symptomIndex, setSymptomIndex] = useState(0)
  const [symptomFrom, setSymptomFrom] = useState('checkin')
  const [pendingSession, setPendingSession] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [todayReady, setTodayReady] = useState(() => !api.savedProfileId())
  const [overall, setOverall] = useState(3)
  const [logged, setLogged] = useState(false)
  const [before, setBefore] = useState(3)
  const [after, setAfter] = useState(6)
  const [hour, setHour] = useState(5)
  const [heldEval, setHeldEval] = useState(null)
  const [source, setSource] = useState(null)
  const [cameraBpm, setCameraBpm] = useState(null)
  const [strap, setStrap] = useState('polar')
  const [level, setLevel] = useState(2)
  const [level5StableStreak, setLevel5StableStreak] = useState(0)
  const [inMaintenance, setInMaintenance] = useState(false)
  const [clinicianLog, setClinicianLog] = useState(null)
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState(null)
  const [streak, setStreak] = useState(0)
  const [profileId, setProfileId] = useState(() => api.savedProfileId())
  const [sessionId, setSessionId] = useState(null)
  const [audioCheckin, setAudioCheckinState] = useState(() => readAudioPreference())
  const [voiceGuide, setVoiceGuideState] = useState(() => readVoiceGuidePreference())
  const [voiceMuted, setVoiceMuted] = useState(false)
  const prevRisk = useRef(riskIndex)
  const testApiRef = useRef({})

  function setAudioCheckin(on) {
    setAudioCheckinState(on)
    writeAudioPreference(on)
  }

  function setVoiceGuide(on) {
    setVoiceGuideState(on)
    writeVoiceGuidePreference(on)
    if (on) {
      setAudioCheckin(true)
      setVoiceMuted(false)
      unlockAudio().then(() => {
        speakScreen(screen, voiceCtx())
      })
    }
  }

  function voiceCtx(overrides = {}) {
    return {
      day: dayNumber(injuryDate),
      level: heldEval?.nextLevel ?? heldEval?.levelAfter ?? level,
      overall,
      zone: targetZone(age, level),
      riskTitle: RISK_QUESTIONS[riskIndex]?.title,
      symptomName: SYMPTOMS[symptomIndex],
      settled: heldEval?.settled ?? (hour - before <= 2 && after - before <= 2),
      levelBefore: heldEval?.levelBefore ?? level,
      logged,
      pendingSession,
      inMaintenance,
      level5StableStreak: heldEval?.level5StableStreak ?? level5StableStreak,
      graduated: heldEval?.graduated,
      ...overrides,
    }
  }

  function maybeSpeakScreen(next, extra = {}) {
    if (!canSpeak() || voiceMuted || !voiceGuide) return
    if (next === 'symptom' || next === 'overall') return
    speakScreen(next, voiceCtx(extra))
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    bindAudioUnlock()
    warmVoiceClips()
      .then((index) => {
        markVoiceClipsAvailable(Boolean(index?.size))
      })
      .catch(() => markVoiceClipsAvailable(false))
  }, [])

  useEffect(() => {
    if (screen === 'injury' && !profileId) {
      setInjuryDate(localDate())
    }
  }, [screen, profileId])

  useEffect(() => {
    if (screen !== 'home' || !profileId) return undefined
    let cancelled = false
    setTodayReady(false)
    api
      .getToday(profileId)
      .then((today) => {
        if (cancelled) return
        setSaveError(null)
        setInjuryDate(today.injuryDate)
        setAge(String(today.age))
        setLevel(today.level)
        setLevel5StableStreak(today.level5StableStreak ?? 0)
        setInMaintenance(Boolean(today.inMaintenance))
        setLogged(today.loggedToday)
        setStreak(today.streak)
        if (today.overall != null) {
          setOverall(today.overall)
          setBefore(today.overall)
        }
        if (today.hrSource) setSource(today.hrSource === 'manual' ? null : today.hrSource)
        setTodayReady(true)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 404) {
          api.forgetProfileId()
          setProfileId('')
          setInjuryDate(localDate())
          setScreen('splash')
          setSaveError(PROFILE_GONE)
          setTodayReady(true)
          return
        }
        setSaveError(LOAD_TODAY)
        setTodayReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [screen, profileId])

  useEffect(() => {
    if (screen !== 'clinician-log' || !profileId) return undefined
    let cancelled = false
    setLogLoading(true)
    setLogError(null)
    setClinicianLog(null)
    api
      .getClinicianLog(profileId)
      .then((data) => {
        if (cancelled) return
        setClinicianLog(data)
        setLogLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('Could not load clinician log', err)
        setLogError('Could not load your log. Try again from Settings.')
        setLogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [screen, profileId])

  useEffect(() => {
    if (!voiceGuide && !audioCheckin) cancelSpeak()
  }, [voiceGuide, audioCheckin])

  // Voice guide: speak on in-screen risk turns (screen changes speak from go()).
  useEffect(() => {
    const riskTurn = screen === 'risk' && prevRisk.current !== riskIndex
    prevRisk.current = riskIndex

    if (!canSpeak() || voiceMuted || !voiceGuide) return undefined
    if (screen !== 'risk' || !riskTurn) return undefined

    speakScreen('risk', voiceCtx())
    return undefined
  }, [screen, voiceGuide, voiceMuted, riskIndex, injuryDate, level, overall, age, heldEval, logged, pendingSession, inMaintenance, level5StableStreak, before, after, hour, symptomIndex])

  function go(next) {
    if (next === 'home') setPendingSession(false)
    if (next === 'after') {
      setAfter(before)
      setHour(before)
    }
    if (next === 'settings') setSettingsBack(screen === 'settings' ? settingsBack : screen)
    if (next === 'risk' && screen === 'risk-consent') setRiskIndex(0)
    if (next === 'injury' && !profileId) setInjuryDate(localDate())
    if (next === 'symptom' && (screen === 'checkin' || screen === 'home')) {
      setSymptomIndex(0)
      setSymptomFrom(screen)
    }
    if (next === 'red-flags') setFlags([])
    setScreen(next)
    unlockAudio().then(() => {
      maybeSpeakScreen(next)
    })
  }

  function openCheckin() {
    setPendingSession(false)
    go('checkin')
  }

  function startSessionAttempt() {
    if (!todayReady || inMaintenance) return
    setCameraBpm(null)
    if (!logged) {
      setPendingSession(true)
      go('checkin')
      return
    }
    go('red-flags')
  }

  async function persistInjuryDate(nextDate) {
    setInjuryDate(nextDate)
    if (!profileId) return
    try {
      await api.updateProfile(profileId, { injuryDate: nextDate, age, answers })
      setSaveError(null)
    } catch (err) {
      console.warn('Could not save injury date', err)
      setSaveError(SAVE_PROFILE)
    }
  }

  async function resetSetup() {
    setSaveError(null)
    try {
      if (profileId) await api.deleteProfile(profileId)
    } catch (err) {
      console.warn('Could not delete profile', err)
    }
    api.forgetProfileId()
    api.resetDemoDay()
    setProfileId('')
    setSessionId(null)
    setLogged(false)
    setStreak(0)
    setAnswers({})
    setScores(Array(SYMPTOMS.length).fill(null))
    setInjuryDate(localDate())
    setTodayReady(true)
    go('splash')
  }

  async function persistProfile() {
    setSaveError(null)
    try {
      if (profileId) {
        await api.updateProfile(profileId, { injuryDate, age, answers })
      } else {
        const result = await api.createProfile({ injuryDate, age, answers })
        const id = api.rememberProfileId(result.profile.id)
        setProfileId(id)
        applyToday(result.today)
      }
      setTodayReady(true)
      go('home')
    } catch (err) {
      console.warn('Could not save profile', err)
      setSaveError(SAVE_PROFILE)
    }
  }

  function applyToday(today) {
    if (!today) return
    setLevel(today.level)
    setLevel5StableStreak(today.level5StableStreak ?? 0)
    setInMaintenance(Boolean(today.inMaintenance))
    setLogged(today.loggedToday)
    setStreak(today.streak)
    if (today.overall != null) {
      setOverall(today.overall)
      setBefore(today.overall)
    }
  }

  async function persistCheckin() {
    setSaveError(null)
    let id = profileId
    try {
      // After a Vercel redeploy the old profile id can be gone — recreate from onboarding fields.
      if (!id) {
        const created = await api.createProfile({ injuryDate, age, answers })
        id = api.rememberProfileId(created.profile.id)
        setProfileId(id)
      }
      let result
      try {
        result = await api.saveCheckin(id, {
          scores: scores.map((n) => n ?? 0),
          overall,
        })
      } catch (err) {
        if (err.status !== 404) throw err
        const created = await api.createProfile({ injuryDate, age, answers })
        id = api.rememberProfileId(created.profile.id)
        setProfileId(id)
        result = await api.saveCheckin(id, {
          scores: scores.map((n) => n ?? 0),
          overall,
        })
      }
      setLogged(true)
      setBefore(overall)
      applyToday(result.today)
      const next = pendingSession && !inMaintenance ? 'red-flags' : 'home'
      setPendingSession(false)
      go(next)
    } catch (err) {
      console.warn('Could not save check-in', err)
      setSaveError(SAVE_CHECKIN)
    }
  }

  async function gateSession(redFlags, intent) {
    if (profileId) {
      try {
        const result = await api.startSession(profileId, {
          redFlags,
          intent,
          before: overall,
          hrSource: source,
        })
        setSessionId(result.session.id)
        setSaveError(null)
        return result.redirect
      } catch (err) {
        console.warn('Could not start session', err)
        setSaveError(SAVE_SESSION)
      }
    } else {
      setSaveError(SAVE_SESSION)
    }
    if (intent === 'emergency' || redFlags.length) return 'emergency'
    if (overall >= 8) return 'not-today'
    return 'preflight'
  }

  function persistCameraLock(bpm) {
    setCameraBpm(bpm)
    persistSource('camera')
  }

  function persistSource(nextSource) {
    const normalized = nextSource === 'manual' ? null : nextSource
    setSource(normalized)
    if (profileId && sessionId && normalized) {
      api.setSessionSource(profileId, sessionId, normalized).catch((err) => {
        console.warn('Could not save heart-rate source', err)
        setSaveError(SAVE_SOURCE)
      })
    }
  }

  async function persistAfter() {
    setSaveError(null)
    if (profileId && sessionId) {
      try {
        await api.saveAfter(profileId, sessionId, after)
      } catch (err) {
        console.warn('Could not save after-session rating', err)
        setSaveError(SAVE_AFTER)
        return
      }
    }
    go('hour')
  }

  async function persistHour() {
    setSaveError(null)
    if (profileId && sessionId) {
      try {
        const result = await api.saveHour(profileId, sessionId, { hour, after })
        if (result?.evaluation) {
          setHeldEval(result.evaluation)
          setLevel(result.evaluation.nextLevel)
          if (result.evaluation.level5StableStreak != null) {
            setLevel5StableStreak(result.evaluation.level5StableStreak)
          }
          if (result.evaluation.progressionPhase === 'maintenance') {
            setInMaintenance(true)
          }
        } else if (result?.today?.level != null) {
          applyToday(result.today)
        }
      } catch (err) {
        console.warn('Could not save follow-up rating', err)
        setSaveError(SAVE_HOUR)
        return
      }
    } else {
      const result = evaluateProgression({ before, after, hour, level })
      const l5 = recordLevel5Progress(
        {
          level5StableStreak,
          progressionPhase: inMaintenance ? 'maintenance' : 'training',
        },
        { settled: result.settled, levelBefore: result.levelBefore },
      )
      setHeldEval({
        ...result,
        ...l5,
        levelAfter: result.nextLevel,
      })
      setLevel(result.nextLevel)
      setLevel5StableStreak(l5.level5StableStreak)
      if (l5.progressionPhase === 'maintenance') setInMaintenance(true)
      if (profileId) {
        api
          .updateProfile(profileId, {
            level: result.nextLevel,
            level5StableStreak: l5.level5StableStreak,
            progressionPhase: l5.progressionPhase,
          })
          .catch((err) => {
            console.warn('Could not save training level', err)
          })
      }
    }
    go('held')
  }

  async function finishHeld({ settled }) {
    const promotedLevel = heldEval?.nextLevel ?? heldEval?.levelAfter
    setSessionId(null)
    setPendingSession(false)
    setCameraBpm(null)
    setSource(null)
    setHeldEval(null)
    if (settled) {
      if (promotedLevel != null) setLevel(promotedLevel)
      if (profileId && promotedLevel != null) {
        try {
          await api.updateProfile(profileId, {
            level: promotedLevel,
            level5StableStreak: heldEval?.level5StableStreak,
            progressionPhase: heldEval?.progressionPhase,
          })
        } catch (err) {
          console.warn('Could not save training level', err)
        }
      }
      api.advanceDemoDay()
      setLogged(false)
      if (profileId) {
        setTodayReady(false)
        try {
          const today = await api.getToday(profileId)
          setSaveError(null)
          setInjuryDate(today.injuryDate)
          setAge(String(today.age))
          setLevel(promotedLevel ?? today.level)
          setLevel5StableStreak(today.level5StableStreak ?? 0)
          setInMaintenance(Boolean(today.inMaintenance))
          setLogged(today.loggedToday)
          setStreak(today.streak)
          if (today.overall != null) setOverall(today.overall)
        } catch (err) {
          console.warn('Could not load tomorrow', err)
          setSaveError(LOAD_TODAY)
        } finally {
          setTodayReady(true)
        }
      }
    }
    go('home')
  }

  testApiRef.current = {
    go,
    seed(patch = {}) {
      if (patch.reset) {
        localStorage.clear()
        api.forgetProfileId()
        api.resetDemoDay()
      }
      if (patch.demoDayOffset != null) {
        localStorage.setItem('threshold-demo-day-offset', String(patch.demoDayOffset))
      }
      if (patch.profileId !== undefined) {
        if (patch.profileId) api.rememberProfileId(patch.profileId)
        else api.forgetProfileId()
        setProfileId(patch.profileId || '')
      }
      if (patch.injuryDate != null) setInjuryDate(patch.injuryDate)
      if (patch.age != null) setAge(String(patch.age))
      if (patch.level != null) setLevel(patch.level)
      if (patch.level5StableStreak != null) setLevel5StableStreak(patch.level5StableStreak)
      if (patch.inMaintenance != null) setInMaintenance(patch.inMaintenance)
      if (patch.overall != null) setOverall(patch.overall)
      if (patch.logged != null) setLogged(patch.logged)
      if (patch.todayReady != null) setTodayReady(patch.todayReady)
      if (patch.before != null) setBefore(patch.before)
      if (patch.after != null) setAfter(patch.after)
      if (patch.hour != null) setHour(patch.hour)
      if (patch.streak != null) setStreak(patch.streak)
      if (patch.source != null) setSource(patch.source)
      if (patch.cameraBpm != null) setCameraBpm(patch.cameraBpm)
      if (patch.heldEval !== undefined) setHeldEval(patch.heldEval)
      if (patch.screen != null) setScreen(patch.screen)
      if (patch.saveError !== undefined) setSaveError(patch.saveError)
      if (patch.seedClinicianDemo) {
        const id = api.seedClinicianDemo(patch.profileId || 'e2e-clinician-demo')
        api.rememberProfileId(id)
        setProfileId(id)
        setInjuryDate('2026-09-01')
        setAge('16')
        setLevel(3)
        setLogged(true)
        setOverall(3)
        setTodayReady(true)
      }
    },
  }

  useEffect(() => {
    if (!e2eMode) return undefined
    window.__THRESHOLD_TEST__ = {
      go: (next) => testApiRef.current.go(next),
      seed: (patch) => testApiRef.current.seed(patch),
    }
    return undefined
  }, [])

  const shared = { go, theme, setTheme }
  const voiceDockVisible =
    canSpeak() && (voiceGuide || (audioCheckin && (screen === 'symptom' || screen === 'overall')))

  let view = <Splash {...shared} />

  if (screen === 'settings') {
    view = (
      <Settings
        {...shared}
        injuryDate={injuryDate}
        onInjuryDateChange={persistInjuryDate}
        onResetSetup={resetSetup}
        onOpenLog={profileId ? () => go('clinician-log') : undefined}
        voiceGuide={voiceGuide}
        setVoiceGuide={setVoiceGuide}
        settingsBack={settingsBack}
      />
    )
  }
  if (screen === 'clinician-log') {
    view = (
      <ClinicianLog
        {...shared}
        log={clinicianLog}
        loading={logLoading}
        error={logError}
      />
    )
  }
  if (screen === 'disclaimer') view = <DisclaimerScreen {...shared} />
  if (screen === 'injury') {
    view = (
      <Injury
        {...shared}
        injuryDate={injuryDate}
        setInjuryDate={setInjuryDate}
        age={age}
        setAge={setAge}
      />
    )
  }
  if (screen === 'risk-consent') view = <RiskConsent {...shared} />
  if (screen === 'risk') {
    view = (
      <Risk
        {...shared}
        riskIndex={riskIndex}
        setRiskIndex={setRiskIndex}
        answers={answers}
        setAnswers={setAnswers}
      />
    )
  }
  if (screen === 'outlook') view = <Outlook {...shared} answers={answers} onStart={persistProfile} />
  if (screen === 'home') {
    view = (
      <Home
        {...shared}
        injuryDate={injuryDate}
        age={age}
        overall={overall}
        logged={logged}
        level={level}
        todayReady={todayReady}
        inMaintenance={inMaintenance}
        level5StableStreak={level5StableStreak}
        setAudioCheckin={setAudioCheckin}
        onOpenCheckin={openCheckin}
        onStartSession={startSessionAttempt}
      />
    )
  }
  if (screen === 'red-flags') {
    view = (
      <RedFlags
        {...shared}
        flags={flags}
        setFlags={setFlags}
        overall={overall}
        onGate={gateSession}
      />
    )
  }
  if (screen === 'emergency') view = <Emergency go={go} />
  if (screen === 'not-today') view = <NotToday {...shared} overall={overall} onOpenCheckin={openCheckin} />
  if (screen === 'checkin') {
    view = (
      <Checkin
        {...shared}
        overall={overall}
        streak={streak}
        logged={logged}
        setAudioCheckin={setAudioCheckin}
        pendingSession={pendingSession}
      />
    )
  }
  if (screen === 'symptom') {
    view = (
      <Symptom
        {...shared}
        index={symptomIndex}
        setIndex={setSymptomIndex}
        scores={scores}
        setScores={setScores}
        audioCheckin={audioCheckin}
        voiceGuide={voiceGuide}
        voiceMuted={voiceMuted}
        backScreen={symptomFrom}
      />
    )
  }
  if (screen === 'overall') {
    view = (
      <Overall
        go={go}
        overall={overall}
        setOverall={setOverall}
        onSave={persistCheckin}
        audioCheckin={audioCheckin}
        voiceGuide={voiceGuide}
        voiceMuted={voiceMuted}
      />
    )
  }
  if (screen === 'preflight') {
    view = (
      <Preflight
        {...shared}
        injuryDate={injuryDate}
        age={age}
        overall={overall}
        source={source}
        level={level}
      />
    )
  }
  if (screen === 'connect-ble') {
    view = (
      <ConnectBle
        {...shared}
        setSource={persistSource}
        selected={strap}
        setSelected={setStrap}
      />
    )
  }
  if (screen === 'connect-camera') {
    view = (
      <ConnectCamera {...shared} setSource={persistSource} onCameraLocked={persistCameraLock} />
    )
  }
  if (screen === 'pulse-resync') {
    view = (
      <PulseResync {...shared} setSource={persistSource} onCameraLocked={persistCameraLock} />
    )
  }
  if (screen === 'warmup') {
    view = (
      <Warmup {...shared} source={source} cameraBpm={cameraBpm} age={age} level={level} />
    )
  }
  if (screen === 'active') {
    view = <Active {...shared} age={age} level={level} source={source} cameraBpm={cameraBpm} />
  }
  if (screen === 'glance') {
    view = (
      <Glance {...shared} source={source} cameraBpm={cameraBpm} age={age} level={level} />
    )
  }
  if (screen === 'after') {
    view = <After {...shared} after={after} setAfter={setAfter} onSave={persistAfter} />
  }
  if (screen === 'hour') {
    view = (
      <HourLater
        {...shared}
        hour={hour}
        setHour={setHour}
        onSave={persistHour}
        before={before}
        after={after}
      />
    )
  }
  if (screen === 'held') {
    view = (
      <Held
        {...shared}
        before={before}
        after={after}
        hour={hour}
        level={level}
        evaluation={heldEval}
        onFinish={finishHeld}
      />
    )
  }

  return (
    <Phone data-testid="threshold-phone" data-screen={screen}>
      <div key={screen} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view}
      </div>
      <SaveError message={saveError} onDismiss={() => setSaveError(null)} />
      <VoiceDock
        visible={voiceDockVisible}
        muted={voiceMuted}
        onRepeat={() => {
          if (!voiceMuted) repeatLast()
        }}
        onMute={() => {
          setVoiceMuted((m) => {
            const next = !m
            if (next) cancelSpeak()
            else repeatLast()
            return next
          })
        }}
      />
    </Phone>
  )
}
