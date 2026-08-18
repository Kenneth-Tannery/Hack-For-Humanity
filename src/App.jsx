import { useEffect, useState } from 'react'
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
  const [logged, setLogged] = useState(true)
  const [before, setBefore] = useState(3)
  const [after, setAfter] = useState(6)
  const [hour, setHour] = useState(5)
  const [source, setSource] = useState(null)
  const [strap, setStrap] = useState('polar')
  const [level, setLevel] = useState(2)
  const [streak] = useState(5)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  function go(next) {
    if (next === 'risk') setRiskIndex(0)
    if (next === 'symptom') setSymptomIndex(0)
    if (next === 'red-flags') setFlags([])
    setScreen(next)
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
  if (screen === 'outlook') view = <Outlook {...shared} answers={answers} />
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
    view = <RedFlags {...shared} flags={flags} setFlags={setFlags} overall={overall} />
  }
  if (screen === 'emergency') view = <Emergency />
  if (screen === 'not-today') view = <NotToday {...shared} overall={overall} />
  if (screen === 'checkin') view = <Checkin {...shared} overall={overall} streak={streak} />
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
        setLogged={setLogged}
        setBefore={setBefore}
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
    view = <ConnectBle {...shared} setSource={setSource} selected={strap} setSelected={setStrap} />
  }
  if (screen === 'connect-camera') view = <ConnectCamera {...shared} setSource={setSource} />
  if (screen === 'connect-manual') view = <ConnectManual {...shared} setSource={setSource} />
  if (screen === 'warmup') view = <Warmup {...shared} />
  if (screen === 'active') view = <Active {...shared} age={age} source={source} />
  if (screen === 'glance') view = <Glance {...shared} />
  if (screen === 'after') view = <After {...shared} after={after} setAfter={setAfter} />
  if (screen === 'hour') view = <HourLater {...shared} hour={hour} setHour={setHour} />
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
