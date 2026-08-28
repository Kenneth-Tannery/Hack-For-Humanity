import { useEffect, useState } from 'react'
import * as api from './api.js'
import { SYMPTOMS } from './data.js'
import {
  Active,
  After,
  Checkin,
  ConnectBle,
  ConnectCamera,
  ConnectManual,
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
  RedFlags,
  Risk,
  RiskConsent,
  Splash,
  Symptom,
  Warmup,
} from './screens.jsx'

const THEME_KEY = 'threshold-theme'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [screen, setScreen] = useState('splash')
  const [injuryDate, setInjuryDate] = useState('2026-08-12')
  const [age, setAge] = useState('16')
  const [riskIndex, setRiskIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [flags, setFlags] = useState([])
  const [scores, setScores] = useState(() => Array(SYMPTOMS.length).fill(null))
  const [symptomIndex, setSymptomIndex] = useState(0)
  const [overall, setOverall] = useState(3)
  const [logged, setLogged] = useState(false)
  const [before, setBefore] = useState(3)
  const [after, setAfter] = useState(6)
  const [hour, setHour] = useState(5)
  const [source, setSource] = useState(null)
  const [strap, setStrap] = useState('polar')
  const [level, setLevel] = useState(2)
  const [streak, setStreak] = useState(0)
  const [profileId, setProfileId] = useState(() => api.savedProfileId())
  const [sessionId, setSessionId] = useState(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (screen !== 'home' || !profileId) return undefined
    let cancelled = false
    api
      .getToday(profileId)
      .then((today) => {
        if (cancelled) return
        setInjuryDate(today.injuryDate)
        setAge(String(today.age))
        setLevel(today.level)
        setLogged(today.loggedToday)
        setStreak(today.streak)
        if (today.overall != null) {
          setOverall(today.overall)
          setBefore(today.overall)
        }
        if (today.hrSource) setSource(today.hrSource)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [screen, profileId])

  function go(next) {
    if (next === 'risk' && screen === 'risk-consent') setRiskIndex(0)
    if (next === 'symptom' && screen === 'checkin') setSymptomIndex(0)
    if (next === 'red-flags' && (screen === 'home' || screen === 'not-today')) setFlags([])
    setScreen(next)
  }

  async function persistProfile() {
    try {
      if (profileId) {
        await api.updateProfile(profileId, { injuryDate, age, answers })
      } else {
        const result = await api.createProfile({ injuryDate, age, answers })
        const id = api.rememberProfileId(result.profile.id)
        setProfileId(id)
        applyToday(result.today)
      }
    } catch (err) {
      console.warn('Could not save profile', err)
    }
    go('home')
  }

  function applyToday(today) {
    if (!today) return
    setLevel(today.level)
    setLogged(today.loggedToday)
    setStreak(today.streak)
    if (today.overall != null) {
      setOverall(today.overall)
      setBefore(today.overall)
    }
  }

  async function persistCheckin() {
    setLogged(true)
    setBefore(overall)
    if (profileId) {
      try {
        const result = await api.saveCheckin(profileId, {
          scores: scores.map((n) => n ?? 0),
          overall,
        })
        applyToday(result.today)
      } catch (err) {
        console.warn('Could not save check-in', err)
      }
    }
    go('home')
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
        return result.redirect
      } catch (err) {
        console.warn('Could not start session', err)
      }
    }
    if (intent === 'emergency' || redFlags.length) return 'emergency'
    if (overall >= 8) return 'not-today'
    return 'preflight'
  }

  function persistSource(nextSource) {
    setSource(nextSource)
    if (profileId && sessionId) {
      api.setSessionSource(profileId, sessionId, nextSource).catch((err) => {
        console.warn('Could not save heart-rate source', err)
      })
    }
  }

  async function persistAfter() {
    if (profileId && sessionId) {
      try {
        await api.saveAfter(profileId, sessionId, after)
      } catch (err) {
        console.warn('Could not save after-session rating', err)
      }
    }
    go('hour')
  }

  async function persistHour() {
    if (profileId && sessionId) {
      try {
        await api.saveHour(profileId, sessionId, { hour, after })
      } catch (err) {
        console.warn('Could not save follow-up rating', err)
      }
    }
    go('held')
  }

  const shared = { go, theme, setTheme }
  let view = <Splash {...shared} />

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
  if (screen === 'emergency') view = <Emergency />
  if (screen === 'not-today') view = <NotToday {...shared} overall={overall} />
  if (screen === 'checkin') view = <Checkin {...shared} overall={overall} streak={streak} logged={logged} />
  if (screen === 'symptom') {
    view = (
      <Symptom
        {...shared}
        index={symptomIndex}
        setIndex={setSymptomIndex}
        scores={scores}
        setScores={setScores}
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
  if (screen === 'connect-camera') view = <ConnectCamera {...shared} setSource={persistSource} />
  if (screen === 'connect-manual') view = <ConnectManual {...shared} setSource={persistSource} />
  if (screen === 'warmup') view = <Warmup {...shared} />
  if (screen === 'active') view = <Active {...shared} age={age} source={source} />
  if (screen === 'glance') view = <Glance {...shared} />
  if (screen === 'after') {
    view = <After {...shared} after={after} setAfter={setAfter} onSave={persistAfter} />
  }
  if (screen === 'hour') {
    view = <HourLater {...shared} hour={hour} setHour={setHour} onSave={persistHour} />
  }
  if (screen === 'held') {
    view = (
      <Held {...shared} before={before} after={after} hour={hour} level={level} setLevel={setLevel} />
    )
  }

  return (
    <Phone>
      <div key={screen} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view}
      </div>
    </Phone>
  )
}
