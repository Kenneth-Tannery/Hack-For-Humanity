import { useEffect, useState } from 'react'
import {
  dayNumber,
  formatTime,
  OVERALL_CHOICES,
  OVERALL_LABELS,
  RED_FLAGS,
  RISK_QUESTIONS,
  SYMPTOMS,
  targetZone,
} from './data.js'
import {
  Card,
  Clock,
  Danger,
  Disclaimer,
  Foot,
  Ghost,
  InfoCard,
  Kicker,
  Lead,
  Primary,
  Screen,
  Secondary,
  Status,
  Title,
} from './ui.jsx'

function Wave() {
  return (
    <div className="wave" aria-hidden="true">
      <svg viewBox="0 0 320 160" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="var(--in)"
          strokeWidth="2.5"
          points="0,90 18,90 28,90 36,40 44,120 52,70 60,90 88,90 98,90 108,20 118,140 128,90 180,90 190,90 198,50 206,110 214,80 222,90 260,90 270,90 278,35 286,125 294,75 302,90 320,90"
        >
          <animate
            attributeName="points"
            dur="1.2s"
            repeatCount="indefinite"
            values="
              0,90 18,90 28,90 36,40 44,120 52,70 60,90 88,90 98,90 108,20 118,140 128,90 180,90 190,90 198,50 206,110 214,80 222,90 260,90 270,90 278,35 286,125 294,75 302,90 320,90;
              0,90 18,90 28,90 36,70 44,90 52,40 60,90 88,90 98,90 108,90 118,25 128,130 180,90 190,90 198,90 206,45 214,120 222,90 260,90 270,90 278,90 286,30 294,130 302,90 320,90;
              0,90 18,90 28,90 36,40 44,120 52,70 60,90 88,90 98,90 108,20 118,140 128,90 180,90 190,90 198,50 206,110 214,80 222,90 260,90 270,90 278,35 286,125 294,75 302,90 320,90
            "
          />
        </polyline>
      </svg>
    </div>
  )
}

export function Splash({ go, theme, setTheme }) {
  return (
    <Screen>
      <button type="button" className="screen-body splash" onClick={() => go('disclaimer')}>
        <div className="brand">Threshold</div>
        <p className="tag">Paced recovery after concussion.</p>
      </button>
      <div className="screen-foot">
        <Ghost onClick={() => setTheme(theme === 'dark' ? 'paper' : 'dark')}>
          {theme === 'dark' ? 'Use paper theme' : 'Use dark theme'}
        </Ghost>
        <Disclaimer />
      </div>
    </Screen>
  )
}

export function DisclaimerScreen({ go }) {
  return (
    <Screen>
      <Status left={<Clock />} right="1 of 4" />
      <div className="screen-body">
        <Kicker tone="in">Before we start</Kicker>
        <Title>Read this first.</Title>
        <Lead>Thirty seconds. It matters more than anything else in the app.</Lead>
        <div className="stack">
          <InfoCard label="What this does" tone="in">
            Paces daily aerobic exercise at an intensity the research supports, and keeps a log your clinician can read.
          </InfoCard>
          <InfoCard label="What this does not do" tone="above">
            It does not diagnose concussion. It does not replace a doctor. It never clears you to return to contact sport.
          </InfoCard>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('injury')}>I understand</Primary>
      </Foot>
    </Screen>
  )
}

export function Injury({ go, injuryDate, setInjuryDate, age, setAge }) {
  const under18 = Number(age) > 0 && Number(age) < 18
  return (
    <Screen>
      <Status left={<Clock />} right="2 of 4" />
      <div className="screen-body">
        <Kicker>Your injury</Kicker>
        <Title>When did it happen?</Title>
        <Lead>We use this to work out whether you should still be resting.</Lead>
        <div className="stack">
          <div className="field">
            <label htmlFor="injury-date">Date of injury</label>
            <input
              id="injury-date"
              type="date"
              value={injuryDate}
              onChange={(e) => setInjuryDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="age">Your age</label>
            <input
              id="age"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            />
          </div>
          {under18 ? (
            <InfoCard label="Tell an adult" tone="above">
              You’re under 18. Please let a parent, guardian or coach know you’re using this and how you’re feeling.
            </InfoCard>
          ) : null}
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('risk')} disabled={!injuryDate || !age}>
          Continue
        </Primary>
      </Foot>
    </Screen>
  )
}

export function Risk({ go, riskIndex, setRiskIndex, answers, setAnswers }) {
  const q = RISK_QUESTIONS[riskIndex]
  const total = RISK_QUESTIONS.length
  function answer(value) {
    const next = { ...answers, [q.id]: value }
    setAnswers(next)
    if (riskIndex < total - 1) setRiskIndex(riskIndex + 1)
    else go('outlook')
  }
  return (
    <Screen>
      <div className="progress-row">
        <div className="bar" style={{ maxWidth: 120 }}>
          <span style={{ width: `${((riskIndex + 1) / total) * 100}%` }} />
        </div>
        <span>
          Question {riskIndex + 1} of {total}
        </span>
      </div>
      <div className="screen-body">
        <Kicker>{q.kicker}</Kicker>
        <Title wide>{q.title}</Title>
        <Lead>Optional. You can skip these and still use everything.</Lead>
        <div className="stack">
          <Primary onClick={() => answer('yes')}>Yes</Primary>
          <Primary onClick={() => answer('no')}>No</Primary>
        </div>
      </div>
      <Foot>
        <Ghost onClick={() => go('outlook')}>Skip these questions</Ghost>
      </Foot>
    </Screen>
  )
}

export function Outlook({ go, answers }) {
  const longer = answers.prior === 'yes' || answers.repeat === 'yes' || answers.migraine === 'yes'
  return (
    <Screen>
      <Status left={<Clock />} right="4 of 4" />
      <div className="screen-body">
        <Kicker>Your outlook</Kicker>
        <Title wide>{longer ? 'Recovery may take a little longer for you' : 'Most people improve within two weeks'}</Title>
        <div className="stack">
          <InfoCard
            label="What that means"
            cite="5P clinical risk score · Zemek et al., JAMA 2016"
          >
            {longer
              ? 'Some people recover in under two weeks. Based on your answers, yours may run longer than that. This is common and it is not a setback.'
              : 'Relative rest, then paced aerobic work below your symptom threshold, is what the research supports. This app keeps that work honest.'}
          </InfoCard>
          <InfoCard label="See someone if" tone="above">
            You are still symptomatic after 4 weeks, or symptoms get worse rather than better.
          </InfoCard>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('home')}>Start</Primary>
      </Foot>
    </Screen>
  )
}

export function Home({ go, injuryDate, age, overall, logged, level }) {
  const zone = targetZone(age)
  const day = dayNumber(injuryDate)
  return (
    <Screen>
      <Status left={<Clock />} right={`Day ${day}`} />
      <div className="screen-body">
        <Kicker>Today</Kicker>
        <Title wide>
          Subthreshold training
          <span style={{ display: 'block' }}>Level {level}</span>
        </Title>
        <div className="stack">
          <Card>
            <div className="card-label">Today’s session</div>
            <div className="card-value">20 minutes</div>
            <div className="card-sub">
              Target {zone.low}–{zone.high} bpm
            </div>
          </Card>
          <button type="button" className="card" onClick={() => go('checkin')} style={{ textAlign: 'left' }}>
            <div className="card-label">Symptoms today</div>
            <div className="card-value">{logged ? `Logged · ${overall} / 10` : 'Not logged yet'}</div>
          </button>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('red-flags')}>Start session</Primary>
      </Foot>
    </Screen>
  )
}

export function RedFlags({ go, flags, setFlags, overall }) {
  function toggle(item) {
    setFlags(flags.includes(item) ? flags.filter((f) => f !== item) : [...flags, item])
  }
  function none() {
    if (overall >= 8) go('not-today')
    else go('preflight')
  }
  return (
    <Screen>
      <Status left={<Clock />} right="Step 1 of 3" />
      <div className="screen-body">
        <Kicker>Before you start</Kicker>
        <Title>Any of these right now?</Title>
        <Lead>Tap any that apply.</Lead>
        <div className="check-list">
          {RED_FLAGS.map((item) => (
            <button
              key={item}
              type="button"
              className={`check-row${flags.includes(item) ? ' on' : ''}`}
              onClick={() => toggle(item)}
            >
              <span className="box" />
              {item}
            </button>
          ))}
        </div>
      </div>
      <Foot>
        <Primary onClick={none}>None of these</Primary>
        <Danger onClick={() => go('emergency')}>One or more apply</Danger>
      </Foot>
    </Screen>
  )
}

export function Emergency() {
  return (
    <Screen variant="emergency">
      <Status left={<Clock />} right="" />
      <div className="screen-body">
        <Kicker>Stop — do not exercise</Kicker>
        <Title wide>Get medical help now</Title>
        <Lead>One or more of the things you tapped can be a sign of a serious brain injury.</Lead>
        <div className="stack">
          <InfoCard label="What to do">
            Call emergency services or go to the emergency department. Do not drive yourself. Tell someone where you are.
          </InfoCard>
          <InfoCard label="What to tell them">
            When the injury happened, what you feel now, and that symptoms are getting worse.
          </InfoCard>
        </div>
      </div>
      <Foot>
        <a className="btn btn-emergency" href="tel:911">
          Call emergency services
        </a>
      </Foot>
    </Screen>
  )
}

export function NotToday({ go, overall }) {
  return (
    <Screen>
      <Status left={<Clock />} right="" />
      <div className="screen-body">
        <Kicker tone="above">Not today</Kicker>
        <Title>Let’s skip the session</Title>
        <Lead>
          Your overall symptoms are {overall} out of 10. That’s above the safe level for exercise today.
        </Lead>
        <div className="stack">
          <InfoCard label="Why" cite="BCBT instruction manual · UB Orthopaedics">
            The Buffalo protocols pause aerobic training when symptoms sit above 7/10.
          </InfoCard>
          <InfoCard label="You can still">
            Log symptoms, take a gentle walk if it doesn’t make things worse, and keep a regular sleep time.
          </InfoCard>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('checkin')}>Log symptoms instead</Primary>
        <Ghost onClick={() => go('home')}>Back to today</Ghost>
      </Foot>
    </Screen>
  )
}

export function Checkin({ go, overall, streak }) {
  return (
    <Screen>
      <Status left={<Clock />} right="" />
      <div className="screen-body">
        <Kicker>Daily check-in</Kicker>
        <Title>How are you today?</Title>
        <Lead>22 quick questions, then one overall rating. About a minute.</Lead>
        <div className="stack">
          <Card>
            <div className="card-label">Last logged</div>
            <div className="card-value">Yesterday · {overall} / 10</div>
            <div className="card-sub">You’ve logged {streak} days in a row.</div>
          </Card>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('symptom')}>Start check-in</Primary>
        <Secondary onClick={() => go('home')}>Later</Secondary>
      </Foot>
    </Screen>
  )
}

export function Symptom({ go, index, scores, setScores, setIndex }) {
  const item = SYMPTOMS[index]
  function pick(n) {
    const next = [...scores]
    next[index] = n
    setScores(next)
    if (index < SYMPTOMS.length - 1) setIndex(index + 1)
    else go('overall')
  }
  return (
    <Screen>
      <div className="progress-row">
        <div className="bar">
          <span style={{ width: `${((index + 1) / SYMPTOMS.length) * 100}%` }} />
        </div>
        <span>
          {index + 1} of {SYMPTOMS.length}
        </span>
      </div>
      <div className="screen-body">
        <Kicker>How bad, right now?</Kicker>
        <Title wide>{item}</Title>
        <Lead>0 is none. 6 is severe.</Lead>
        <div className="scale-grid">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              className={`scale-cell${scores[index] === n ? ' on' : ''}`}
              onClick={() => pick(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <Foot>
        <Secondary
          onClick={() => {
            if (index === 0) go('checkin')
            else setIndex(index - 1)
          }}
        >
          Back
        </Secondary>
      </Foot>
    </Screen>
  )
}

export function Overall({ go, overall, setOverall, setLogged, setBefore }) {
  return (
    <Screen>
      <Status left={<Clock />} right="Last question" />
      <div className="screen-body">
        <Kicker>Overall</Kicker>
        <Title>How bad is it right now?</Title>
        <Lead>0 is completely fine. 10 is the worst it has been.</Lead>
        <div className="choice-stack">
          {OVERALL_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              className={`choice${overall === n ? ' on' : ''}`}
              onClick={() => setOverall(n)}
            >
              {n} {OVERALL_LABELS[n]}
            </button>
          ))}
        </div>
      </div>
      <Foot>
        <Primary
          onClick={() => {
            setLogged(true)
            setBefore(overall)
            go('home')
          }}
        >
          Save
        </Primary>
      </Foot>
    </Screen>
  )
}

export function Preflight({ go, injuryDate, age, overall, source, level }) {
  const zone = targetZone(age)
  const day = dayNumber(injuryDate)
  const sourceLabel =
    source === 'polar' ? 'Polar H10 · connected' : source === 'camera' ? 'Camera · ready' : source === 'manual' ? 'Manual count' : 'Not connected'
  return (
    <Screen>
      <Status left={<Clock />} right={`Day ${day} · Level ${level}`} />
      <div className="screen-body">
        <Kicker>Before you start</Kicker>
        <Title>How do you feel right now?</Title>
        <Lead>We ask again afterwards. The difference is what decides your next level.</Lead>
        <div className="stack">
          <Card>
            <div className="card-label">Right now</div>
            <div className="card-value">{overall} / 10</div>
          </Card>
          <Card>
            <div className="card-label">Heart rate source</div>
            <div className="card-copy" style={{ color: source ? 'var(--in)' : 'var(--ink)' }}>
              {sourceLabel}
            </div>
          </Card>
          <Card>
            <div className="card-label">Today’s target</div>
            <div className="card-value">
              {zone.low}–{zone.high} bpm · 20 min
            </div>
          </Card>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go(source ? 'warmup' : 'connect-ble')}>Start warmup</Primary>
      </Foot>
    </Screen>
  )
}

export function ConnectBle({ go, setSource, selected, setSelected }) {
  return (
    <Screen>
      <Status left={<Clock />} right="Searching…" />
      <div className="screen-body">
        <Kicker>Heart rate</Kicker>
        <Title>Connect your strap</Title>
        <Lead>Chest straps are the most accurate option. Wet the contacts before you put it on.</Lead>
        <div className="stack">
          <button type="button" className={`device${selected === 'polar' ? ' on' : ''}`} onClick={() => setSelected('polar')}>
            <strong>Polar H10</strong>
            <small>Battery 62%</small>
          </button>
          <button
            type="button"
            className={`device${selected === 'garmin' ? ' on' : ''}`}
            onClick={() => setSelected('garmin')}
          >
            <strong>Garmin HRM-Dual</strong>
            <small>Last used 3 days ago</small>
          </button>
        </div>
      </div>
      <Foot>
        <Primary
          onClick={() => {
            setSource('polar')
            go('preflight')
          }}
        >
          {selected === 'garmin' ? 'Use Garmin HRM-Dual' : 'Use Polar H10'}
        </Primary>
        <Ghost onClick={() => go('connect-camera')}>No strap — use my camera</Ghost>
      </Foot>
    </Screen>
  )
}

export function ConnectCamera({ go, setSource }) {
  return (
    <Screen>
      <Status left={<Clock />} right="Camera" />
      <div className="screen-body">
        <Kicker>Heart rate</Kicker>
        <Title wide>Cover the camera with your fingertip</Title>
        <Lead>Rest your index finger flat over the lens and the flash. Keep still.</Lead>
        <div className="stack stack-fill">
          <Wave />
          <Card>
            <div className="card-label">Signal quality</div>
            <div className="card-value" style={{ color: 'var(--in)', fontSize: 24 }}>
              Good
            </div>
            <div className="card-cite">Camera readings are estimates. A chest strap is more accurate.</div>
          </Card>
        </div>
      </div>
      <Foot>
        <Primary
          onClick={() => {
            setSource('camera')
            go('preflight')
          }}
        >
          Use camera
        </Primary>
        <Ghost onClick={() => go('connect-manual')}>Count my pulse instead</Ghost>
      </Foot>
    </Screen>
  )
}

export function ConnectManual({ go, setSource }) {
  const [left, setLeft] = useState(15)
  const [beats, setBeats] = useState(0)
  const running = left > 0
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [running])
  return (
    <Screen>
      <Status left={<Clock />} right="Manual" />
      <div className="screen-body">
        <Kicker>Heart rate</Kicker>
        <Title>Count your pulse</Title>
        <Lead>Two fingers on your wrist or neck. Tap the button each time you feel a beat.</Lead>
        <div className="countdown">{left}</div>
        <div className="kicker">Seconds left</div>
        <button type="button" className="tap-pad" onClick={() => running && setBeats((b) => b + 1)}>
          Tap on each beat · {beats}
        </button>
      </div>
      <Foot>
        <Primary
          onClick={() => {
            setSource('manual')
            go('preflight')
          }}
        >
          Done
        </Primary>
      </Foot>
    </Screen>
  )
}

function useSessionClock(active, startSeconds) {
  const [left, setLeft] = useState(startSeconds)
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [active])
  return [left, setLeft]
}

function useBpm(base) {
  const [bpm, setBpm] = useState(base)
  useEffect(() => {
    const id = setInterval(() => {
      setBpm((n) => {
        const drift = Math.round((Math.random() - 0.5) * 4)
        return Math.max(base - 8, Math.min(base + 8, n + drift))
      })
    }, 900)
    return () => clearInterval(id)
  }, [base])
  return bpm
}

export function Warmup({ go }) {
  const [left] = useSessionClock(true, 175)
  const bpm = useBpm(96)
  return (
    <Screen>
      <div className="session-top">
        <span>Warmup</span>
        <span>{formatTime(left)} left</span>
      </div>
      <div className="session-hero">
        <div className="cue">Ease in gently</div>
        <div className="bpm-row">
          <div className="bpm live">{bpm}</div>
          <div className="bpm-unit">BPM</div>
        </div>
        <p className="hint">Walk or pedal slowly. We’ll tell you when to settle into your target.</p>
      </div>
      <Foot>
        <Secondary onClick={() => go('active')}>Skip to target</Secondary>
        <Primary onClick={() => go('after')}>Stop</Primary>
      </Foot>
    </Screen>
  )
}

export function Active({ go, age, source }) {
  const zone = targetZone(age)
  const [left] = useSessionClock(true, 702)
  const bpm = useBpm(133)
  const min = zone.low - 30
  const max = zone.high + 30
  const pct = ((bpm - min) / (max - min)) * 100
  const sourceLabel = source === 'polar' ? 'Chest strap — signal good' : source === 'camera' ? 'Camera — signal good' : 'Manual pacing'
  useEffect(() => {
    if (left === 0) go('after')
  }, [left, go])
  return (
    <Screen>
      <div className="session-top">
        <span>
          Steady state
          <div className="kicker tone-in" style={{ margin: '6px 0 0' }}>
            Target {zone.low}–{zone.high}
          </div>
        </span>
        <span>{formatTime(left)} left</span>
      </div>
      <div className="session-hero">
        <div className="cue">Hold here</div>
        <div className="bpm-row">
          <div className="bpm">{bpm}</div>
          <div className="bpm-unit">BPM</div>
        </div>
        <div className="gauge">
          <div className="gauge-track">
            <div className="g-below" />
            <div className="g-in" />
            <div className="g-above" />
            <div className="needle" style={{ left: `${Math.max(2, Math.min(98, pct))}%` }} />
          </div>
        </div>
        <p className="sensor">{sourceLabel}</p>
      </div>
      <Foot>
        <Secondary onClick={() => go('glance')}>Dim the screen</Secondary>
        <Primary onClick={() => go('after')}>Stop</Primary>
      </Foot>
    </Screen>
  )
}

export function Glance({ go }) {
  const bpm = useBpm(133)
  return (
    <Screen variant="glance" onClick={() => go('active')}>
      <div className="glance-bpm">{bpm}</div>
      <p className="glance-hint">Tap anywhere to stop</p>
    </Screen>
  )
}

export function After({ go, after, setAfter }) {
  return (
    <Screen>
      <Status left={<Clock />} right="After session" />
      <div className="screen-body">
        <Kicker>After</Kicker>
        <Title>How do you feel now?</Title>
        <Lead>We’ll ask once more in an hour. That settling is what the rule uses.</Lead>
        <div className="choice-stack">
          {OVERALL_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              className={`choice${after === n ? ' on' : ''}`}
              onClick={() => setAfter(n)}
            >
              {n} {OVERALL_LABELS[n]}
            </button>
          ))}
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('hour')}>Save</Primary>
      </Foot>
    </Screen>
  )
}

export function HourLater({ go, hour, setHour }) {
  return (
    <Screen>
      <Status left={<Clock />} right="Follow-up" />
      <div className="screen-body">
        <Kicker>One hour later</Kicker>
        <Title wide>Have symptoms settled?</Title>
        <Lead>In a real day this waits an hour. For the prototype, log it now.</Lead>
        <div className="choice-stack">
          {[3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              className={`choice${hour === n ? ' on' : ''}`}
              onClick={() => setHour(n)}
            >
              {n} / 10
            </button>
          ))}
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('held')}>See today’s rule</Primary>
      </Foot>
    </Screen>
  )
}

export function Held({ go, before, after, hour, setLevel, level }) {
  const rise = after - before
  const settled = hour - before <= 2 && rise <= 2
  const nextLevel = settled ? Math.min(5, level + 1) : level
  return (
    <Screen>
      <Status left={<Clock />} right="" />
      <div className="screen-body">
        <Kicker tone={settled ? 'in' : 'above'}>
          {settled ? `Moving to level ${nextLevel}` : `Staying at level ${level}`}
        </Kicker>
        <Title wide>{settled ? 'That sat inside the rule' : 'Not moving up today'}</Title>
        <div className="stack">
          <div className="metric-row">
            <span>Before session</span>
            <strong>{before} / 10</strong>
          </div>
          <div className={`metric-row${rise > 2 ? ' hot' : ''}`}>
            <span>After session</span>
            <strong>{after} / 10</strong>
          </div>
          <div className={`metric-row${hour - before > 2 ? ' hot' : ''}`}>
            <span>One hour later</span>
            <strong>{hour} / 10</strong>
          </div>
          <div className="card">
            <div className="card-label">The rule this follows</div>
            <div className="rule-card">
              <div className="rule-bar" />
              <div>
                <div className="card-copy">
                  Symptoms may rise up to 2 points during exercise, as long as they settle within an hour.
                  {settled
                    ? ' Yours stayed inside that window.'
                    : ` Yours rose ${Math.max(0, rise)} and had not settled.`}
                </div>
                <div className="card-cite">Amsterdam consensus 2023 · Br J Sports Med 57:695–711</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Foot>
        <Primary
          onClick={() => {
            if (settled) setLevel(nextLevel)
            go('home')
          }}
        >
          {settled ? 'Back to today' : 'Try again tomorrow'}
        </Primary>
      </Foot>
    </Screen>
  )
}

export function Phone({ children }) {
  return (
    <div className="stage">
      <div className="phone">{children}</div>
    </div>
  )
}
