import { useEffect, useRef, useState } from 'react'
import { SCALE_6_LABELS, usePrefersReducedMotion, useThrottledValue, zoneStatus } from './a11y.js'
import {
  dayNumber,
  formatTime,
  localDate,
  ACTIVE_SECONDS,
  OVERALL_CHOICES,
  OVERALL_LABELS,
  RED_FLAGS,
  RISK_QUESTIONS,
  SYMPTOMS,
  targetZone,
  WARMUP_SECONDS,
} from './data.js'
import { canSpeak, cancelSpeak, overallPrompt, speak, symptomPrompt } from './speech.js'
import { modelSessionBpm } from './sessionBpm.js'
import { useFingertipHr } from './useFingertipHr.jsx'
import {
  Back,
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

export function Splash({ go, theme, setTheme }) {
  return (
    <Screen>
      <button
        type="button"
        className="screen-body splash"
        onClick={() => go('disclaimer')}
        aria-label="Threshold. Paced recovery after concussion. Continue."
      >
        <div className="brand">Threshold</div>
        <p className="tag">Paced recovery after concussion.</p>
      </button>
      <div className="screen-foot">
        <Ghost
          onClick={() => setTheme(theme === 'dark' ? 'paper' : 'dark')}
          aria-pressed={theme === 'paper'}
        >
          {theme === 'dark' ? 'Use paper theme' : 'Use dark theme'}
        </Ghost>
        <Ghost onClick={() => go('settings')}>Settings</Ghost>
        <Disclaimer />
      </div>
    </Screen>
  )
}

export function DisclaimerScreen({ go }) {
  return (
    <Screen>
      <Status left={<Clock />} right="1 of 4" onBack={() => go('splash')} />
      <div className="screen-body intro">
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
      <Status left={<Clock />} right="2 of 4" onBack={() => go('disclaimer')} />
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
              max={localDate()}
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
        <Primary onClick={() => go('risk-consent')} disabled={!injuryDate || !age}>
          Continue
        </Primary>
      </Foot>
    </Screen>
  )
}

export function RiskConsent({ go }) {
  return (
    <Screen>
      <Status left={<Clock />} right="3 of 4" onBack={() => go('injury')} />
      <div className="screen-body intro">
        <Kicker>Optional</Kicker>
        <Title wide>Nine short questions about you.</Title>
        <Lead>They help us set expectations. They are not a diagnosis, and you can skip the whole set.</Lead>
        <div className="stack">
          <InfoCard label="What we ask" tone="in">
            Prior concussion, migraines, ADHD or mood history, and a few things about this injury.
          </InfoCard>
          <InfoCard label="If you skip" tone="above">
            You can still use every session. We will treat recovery as typical unless you tell us otherwise.
          </InfoCard>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go('risk')}>I’ll answer</Primary>
        <Ghost onClick={() => go('outlook')}>Skip these questions</Ghost>
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
  function back() {
    if (riskIndex === 0) go('risk-consent')
    else setRiskIndex(riskIndex - 1)
  }
  const lead = q.allowSkip
    ? 'If this is your first concussion, skip this one.'
    : q.allowUnsure
      ? 'If you do not know, say so. Guessing does not help.'
      : 'Yes or no is enough.'
  return (
    <Screen>
      <div className="progress-row">
        <div
          className="bar"
          style={{ maxWidth: 120 }}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={riskIndex + 1}
          aria-label={`Question ${riskIndex + 1} of ${total}`}
        >
          <span style={{ width: `${((riskIndex + 1) / total) * 100}%` }} />
        </div>
        <span>
          Question {riskIndex + 1} of {total}
        </span>
        <Back onClick={back} />
      </div>
      <div className="screen-body">
        <Kicker>{q.kicker}</Kicker>
        <Title wide>{q.title}</Title>
        <Lead>{lead}</Lead>
        <div className="stack" role="group" aria-label={q.title}>
          <Primary onClick={() => answer('yes')} aria-label={`Yes. ${q.title}`}>
            Yes
          </Primary>
          <Primary onClick={() => answer('no')} aria-label={`No. ${q.title}`}>
            No
          </Primary>
          {q.allowUnsure ? (
            <Ghost onClick={() => answer('unsure')} aria-label={`Not sure. ${q.title}`}>
              I’m not sure
            </Ghost>
          ) : null}
          {q.allowSkip ? (
            <Ghost onClick={() => answer('skip')} aria-label={`Skip. ${q.title}`}>
              Skip this question
            </Ghost>
          ) : null}
        </div>
      </div>
      <Foot />
    </Screen>
  )
}

export function Outlook({ go, answers, onStart, onBack }) {
  const longer = answers.prior === 'yes' || answers.repeat === 'yes' || answers.migraine === 'yes'
  return (
    <Screen>
      <Status
        left={<Clock />}
        right="4 of 4"
        onBack={onBack || (() => go(Object.keys(answers).length ? 'risk' : 'risk-consent'))}
      />
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
        <Primary onClick={() => (onStart ? onStart() : go('home'))}>Start</Primary>
      </Foot>
    </Screen>
  )
}

export function Home({
  go,
  injuryDate,
  age,
  overall,
  logged,
  level,
  todayReady = true,
  setAudioCheckin,
  onOpenCheckin,
  onStartSession,
}) {
  const zone = targetZone(age, level)
  const day = dayNumber(injuryDate)
  function startAudioCheckin() {
    setAudioCheckin?.(true)
    go('symptom')
  }
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
              Level {level} · Target {zone.low}–{zone.high} bpm
            </div>
            <div className="card-cite">
              Age + training level — Concussion Alliance at-home stages; Amsterdam consensus 2023.
            </div>
          </Card>
          <button
            type="button"
            className="card"
            onClick={() => (onOpenCheckin ? onOpenCheckin() : go('checkin'))}
            style={{ textAlign: 'left' }}
            aria-label={
              !todayReady
                ? 'Symptoms today, loading.'
                : logged
                  ? `Symptoms today, logged ${overall} out of 10. Open check-in.`
                  : 'Symptoms today, not logged yet. Open check-in.'
            }
          >
            <div className="card-label">Symptoms today</div>
            <div className="card-value">
              {!todayReady ? 'Loading…' : logged ? `Logged · ${overall} / 10` : 'Not logged yet'}
            </div>
            <div className="card-sub">
              {!todayReady
                ? 'Checking today’s log'
                : logged
                  ? 'Or open check-in to choose audio or silent'
                  : 'Log these before you start a session'}
            </div>
          </button>
        </div>
      </div>
      <Foot>
        <Primary onClick={startAudioCheckin} disabled={!todayReady}>
          Log symptoms (audio)
        </Primary>
        <Secondary
          onClick={() => (onStartSession ? onStartSession() : go('red-flags'))}
          disabled={!todayReady}
          aria-label={
            !todayReady
              ? 'Start session. Loading today’s check-in.'
              : logged
                ? 'Start session. Opens red flag safety check.'
                : 'Start session. You will log symptoms first, then see red flag safety check.'
          }
        >
          Start session
        </Secondary>
        <Ghost onClick={() => go('settings')}>Settings</Ghost>
      </Foot>
    </Screen>
  )
}

export function Settings({
  go,
  theme,
  setTheme,
  voiceGuide,
  setVoiceGuide,
  settingsBack,
  injuryDate,
  onInjuryDateChange,
  onResetSetup,
}) {
  const speechOk = canSpeak()
  const today = localDate()
  return (
    <Screen>
      <Status left={<Clock />} right="Settings" onBack={() => go(settingsBack || 'home')} />
      <div className="screen-body">
        <Kicker>Comfort</Kicker>
        <Title>Settings</Title>
        <Lead>Voice guide reads each screen aloud in a calmer voice. You can mute anytime.</Lead>
        <div className="stack">
          <div className="field">
            <label htmlFor="settings-injury-date">Date of injury</label>
            <input
              id="settings-injury-date"
              type="date"
              value={injuryDate || today}
              max={today}
              onChange={(e) => onInjuryDateChange?.(e.target.value)}
            />
            <small style={{ display: 'block', marginTop: 8, color: 'var(--muted)' }}>
              Saved on this device. Defaults to today during setup.
            </small>
          </div>
          <button
            type="button"
            className={`toggle-row${voiceGuide ? ' on' : ''}`}
            onClick={() => setVoiceGuide?.(!voiceGuide)}
            aria-pressed={Boolean(voiceGuide)}
            disabled={!speechOk}
          >
            <span>
              <strong>Voice guide</strong>
              <small>
                {speechOk
                  ? 'Speak every screen. Soft, slow voice.'
                  : 'Speech is not available in this browser.'}
              </small>
            </span>
            <span className="toggle-pill">{voiceGuide ? 'On' : 'Off'}</span>
          </button>
          <button
            type="button"
            className={`toggle-row${theme === 'paper' ? ' on' : ''}`}
            onClick={() => setTheme(theme === 'dark' ? 'paper' : 'dark')}
            aria-pressed={theme === 'paper'}
          >
            <span>
              <strong>Paper theme</strong>
              <small>Warmer light surface. Dark stays the default.</small>
            </span>
            <span className="toggle-pill">{theme === 'paper' ? 'On' : 'Off'}</span>
          </button>
          <InfoCard label="About the voice" tone="in">
            Threshold picks a softer system voice when one exists, speaks slower, and keeps lines short so listening is less tiring.
          </InfoCard>
          <InfoCard label="Start over" tone="above">
            Clears your saved profile on this device and returns to setup. Use this if the injury date or day count looks wrong.
            <div style={{ marginTop: 12 }}>
              <Secondary onClick={() => onResetSetup?.()}>Clear profile &amp; start over</Secondary>
            </div>
          </InfoCard>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => go(settingsBack || 'home')}>Done</Primary>
      </Foot>
    </Screen>
  )
}

export function RedFlags({ go, flags, setFlags, overall, onGate }) {
  function toggle(item) {
    setFlags(flags.includes(item) ? flags.filter((f) => f !== item) : [...flags, item])
  }
  async function none() {
    if (onGate) {
      go(await onGate([]))
      return
    }
    if (overall >= 8) go('not-today')
    else go('preflight')
  }
  async function flagged() {
    if (onGate) {
      go(await onGate(flags, 'emergency'))
      return
    }
    go('emergency')
  }
  return (
    <Screen>
      <Status left={<Clock />} right="Step 1 of 3" onBack={() => go('home')} />
      <div className="screen-body">
        <Kicker>Before you start</Kicker>
        <Title>Any of these right now?</Title>
        <Lead>Tap any that apply.</Lead>
        <div className="check-list">
          {RED_FLAGS.map((item) => {
            const on = flags.includes(item)
            return (
              <button
                key={item}
                type="button"
                className={`check-row${on ? ' on' : ''}`}
                onClick={() => toggle(item)}
                aria-pressed={on}
                aria-label={`${item}, ${on ? 'checked' : 'not checked'}`}
              >
                <span className="box" aria-hidden="true" />
                {item}
              </button>
            )
          })}
        </div>
      </div>
      <Foot>
        <Primary onClick={none}>None of these</Primary>
        <Danger onClick={flagged}>One or more apply</Danger>
      </Foot>
    </Screen>
  )
}

export function Emergency({ go }) {
  return (
    <Screen variant="emergency" alert>
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
        <a
          className="btn btn-emergency"
          href="tel:911"
          aria-label="Call emergency services. Phone number 9 1 1."
        >
          Call emergency services
        </a>
        {go ? (
          <Ghost
            onClick={() => go('home')}
            aria-label="I have help. Return to today without starting exercise."
          >
            I’ve got help — back to today
          </Ghost>
        ) : null}
      </Foot>
    </Screen>
  )
}

export function NotToday({ go, overall, onOpenCheckin }) {
  return (
    <Screen>
      <Status left={<Clock />} onBack={() => go('home')} />
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
        <Primary onClick={() => (onOpenCheckin ? onOpenCheckin() : go('checkin'))}>Log symptoms instead</Primary>
      </Foot>
    </Screen>
  )
}

export function Checkin({ go, overall, streak, logged, setAudioCheckin, pendingSession }) {
  const speechOk = canSpeak()
  function start(withAudio) {
    setAudioCheckin?.(withAudio)
    go('symptom')
  }
  return (
    <Screen>
      <Status left={<Clock />} onBack={() => go('home')} />
      <div className="screen-body">
        <Kicker>Daily check-in</Kicker>
        <Title>{pendingSession ? 'Log symptoms first' : 'How are you today?'}</Title>
        <Lead>
          {pendingSession
            ? 'A session needs today’s rating before the safety questions. 22 quick questions, then overall.'
            : '22 quick questions. Choose audio if you want each symptom read aloud so you do not have to stare at the screen.'}
        </Lead>
        <div className="stack">
          <Card>
            <div className="card-label">Last logged</div>
            <div className="card-value">
              {logged ? `Today · ${overall} / 10` : streak ? `Last · ${overall} / 10` : 'Not yet'}
            </div>
            <div className="card-sub">
              {streak ? `You’ve logged ${streak} day${streak === 1 ? '' : 's'} in a row.` : 'Start a streak today.'}
            </div>
          </Card>
          <InfoCard label="Eyes-off mode" tone="in">
            {speechOk
              ? 'Start with audio speaks each symptom. Tap a number from zero to six. Or start without audio for the visual flow only.'
              : 'This browser may not speak prompts. You can still try Start with audio; if you hear nothing, use Start without audio.'}
          </InfoCard>
        </div>
      </div>
      <Foot>
        <Primary onClick={() => start(true)}>Start with audio</Primary>
        <Ghost onClick={() => start(false)}>Start without audio</Ghost>
      </Foot>
    </Screen>
  )
}

export function Symptom({ go, index, scores, setScores, setIndex, audioCheckin, voiceGuide, voiceMuted, backScreen }) {
  const item = SYMPTOMS[index]
  const prompt = symptomPrompt(item)
  const useAudio = Boolean(audioCheckin || voiceGuide)

  useEffect(() => {
    if (!useAudio || voiceMuted || !canSpeak()) {
      cancelSpeak()
      return undefined
    }
    speak(prompt)
    return () => cancelSpeak()
  }, [useAudio, voiceMuted, prompt, index])

  function pick(n) {
    cancelSpeak()
    const next = [...scores]
    next[index] = n
    setScores(next)
    if (index < SYMPTOMS.length - 1) setIndex(index + 1)
    else go('overall')
  }

  function back() {
    cancelSpeak()
    if (index === 0) go(backScreen || 'checkin')
    else setIndex(index - 1)
  }

  return (
    <Screen>
      <div className="progress-row">
        <div
          className="bar"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={SYMPTOMS.length}
          aria-valuenow={index + 1}
          aria-label={`Symptom ${index + 1} of ${SYMPTOMS.length}`}
        >
          <span style={{ width: `${((index + 1) / SYMPTOMS.length) * 100}%` }} />
        </div>
        <span>
          {index + 1} of {SYMPTOMS.length}
        </span>
        <Back onClick={back} />
      </div>
      <div className="screen-body">
        <Kicker>{useAudio ? 'Listen, then tap' : 'How bad, right now?'}</Kicker>
        <Title wide>{item}</Title>
        <Lead>0 is none. 6 is severe.</Lead>
        <div
          className="scale-grid"
          role="radiogroup"
          aria-label={`${item}. Scale from 0 none to 6 severe.`}
        >
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={scores[index] === n}
              aria-label={`${n} of 6, ${SCALE_6_LABELS[n]}`}
              className={`scale-cell${scores[index] === n ? ' on' : ''}`}
              onClick={() => pick(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <Foot />
    </Screen>
  )
}

export function Overall({
  go,
  overall,
  setOverall,
  setLogged,
  setBefore,
  onSave,
  audioCheckin,
  voiceGuide,
  voiceMuted,
}) {
  const prompt = overallPrompt()
  const useAudio = Boolean(audioCheckin || voiceGuide)

  useEffect(() => {
    if (!useAudio || voiceMuted || !canSpeak()) {
      cancelSpeak()
      return undefined
    }
    speak(prompt)
    return () => cancelSpeak()
  }, [useAudio, voiceMuted, prompt])

  function back() {
    cancelSpeak()
    go('symptom')
  }

  function save() {
    cancelSpeak()
    if (onSave) {
      onSave()
      return
    }
    setLogged(true)
    setBefore(overall)
    go('home')
  }

  return (
    <Screen>
      <Status left={<Clock />} right="Last question" onBack={back} />
      <div className="screen-body">
        <Kicker>{useAudio ? 'Listen, then choose' : 'Overall'}</Kicker>
        <Title>How bad is it right now?</Title>
        <Lead>0 is completely fine. 10 is the worst it has been.</Lead>
        <div
          className="choice-stack"
          role="radiogroup"
          aria-label="Overall symptoms. Scale from 0 completely fine to 10 the worst it has been."
        >
          {OVERALL_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={overall === n}
              aria-label={`${n} of 10, ${OVERALL_LABELS[n]}`}
              className={`choice${overall === n ? ' on' : ''}`}
              onClick={() => {
                cancelSpeak()
                setOverall(n)
              }}
            >
              {n} {OVERALL_LABELS[n]}
            </button>
          ))}
        </div>
      </div>
      <Foot>
        <Primary onClick={save}>Save</Primary>
      </Foot>
    </Screen>
  )
}

export function Preflight({ go, injuryDate, age, overall, source, level }) {
  const zone = targetZone(age, level)
  const day = dayNumber(injuryDate)
  const sourceLabel =
    source === 'polar' || source === 'garmin'
      ? 'Chest strap · demo signal'
      : source === 'camera'
        ? 'Camera · pulse locked at start'
        : 'Not connected'
  return (
    <Screen>
      <Status left={<Clock />} right={`Day ${day} · Level ${level}`} onBack={() => go('red-flags')} />
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
            <div className="card-sub">
              Level {level} · based on your age, not weight. Stop if symptoms worsen — that matters
              more than the number.
              {source === 'camera'
                ? ' Camera stays off during exercise; pace is tracked from your pulse checks.'
                : ''}
            </div>
            <div className="card-cite">
              Concussion Alliance at-home stages; Amsterdam consensus 2023 return-to-sport HR steps.
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
      <Status left={<Clock />} right="Searching…" onBack={() => go('preflight')} />
      <div className="screen-body">
        <Kicker>Heart rate</Kicker>
        <Title>Connect your strap</Title>
        <Lead>Chest straps are the most accurate option. Wet the contacts before you put it on.</Lead>
        <div className="stack">
          <button
            type="button"
            className={`device${selected === 'polar' ? ' on' : ''}`}
            onClick={() => setSelected('polar')}
            aria-pressed={selected === 'polar'}
            aria-label="Polar H10 chest strap"
          >
            <strong>Polar H10</strong>
            <small>Battery 62%</small>
          </button>
          <button
            type="button"
            className={`device${selected === 'garmin' ? ' on' : ''}`}
            onClick={() => setSelected('garmin')}
            aria-pressed={selected === 'garmin'}
            aria-label="Garmin HRM-Dual chest strap"
          >
            <strong>Garmin HRM-Dual</strong>
            <small>Last used 3 days ago</small>
          </button>
        </div>
      </div>
      <Foot>
        <Primary
          onClick={() => {
            setSource(selected === 'garmin' ? 'garmin' : 'polar')
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

function ConnectCameraInner({
  go,
  setSource,
  onCameraLocked,
  mode = 'connect',
  goTarget,
  onRetry,
}) {
  const target = goTarget ?? (mode === 'resync' ? 'active' : 'preflight')
  const isResync = mode === 'resync'
  const { bpm, quality, error, nodes, torch, lock, timedOut, stop } = useFingertipHr({
    enabled: true,
    showGraph: !isResync,
    trackLock: true,
    preferTorch: true,
    torchMaxMs: 0,
    startDelayMs: 400,
  })
  const advanced = useRef(false)
  const displayBpm = lock.locked ? lock.lockedBpm ?? bpm : bpm
  const progressPct = Math.round((lock.progress ?? 0) * 100)
  const noTorch = !error && !lock.locked && torch.supported === false
  const readingHigh = !lock.locked && bpm != null && bpm > 115

  useEffect(() => {
    if (lock.locked) stop()
  }, [lock.locked, stop])

  useEffect(() => {
    if (timedOut) stop()
  }, [timedOut, stop])

  useEffect(() => {
    if (advanced.current || error || timedOut || !lock.locked) return undefined
    const id = setTimeout(() => {
      if (advanced.current) return
      advanced.current = true
      const locked = lock.lockedBpm ?? bpm
      if (onCameraLocked) onCameraLocked(locked)
      else setSource('camera')
      go(target)
    }, 400)
    return () => clearTimeout(id)
  }, [lock.locked, lock.lockedBpm, bpm, error, timedOut, go, setSource, onCameraLocked, target])

  const title = isResync ? 'Quick pulse check' : 'Lock your pulse'
  const cue = lock.locked
    ? 'Got it — lift your finger'
    : timedOut
      ? 'Couldn’t lock in time'
      : noTorch
        ? 'Flash not available here'
        : lock.phase === 'unstable'
          ? 'Hold steadier'
          : readingHigh
            ? 'Reading high — cover lens lightly'
            : 'Cover camera + flash'

  const hint = lock.locked
    ? isResync
      ? 'Updating your pace — continuing to steady state.'
      : 'Continuing — camera off for the session so you can move hands-free.'
    : timedOut
      ? 'Try again with firm contact on lens and flash, or use a chest strap.'
      : noTorch
        ? 'Use Android Chrome with the rear camera, or connect a chest strap instead.'
        : lock.phase === 'measuring'
          ? 'Almost there — keep still a moment longer.'
          : readingHigh
            ? 'Flash noise can read too high. Cover the lens gently — don’t press hard.'
            : isResync
            ? 'Quick check before steady state (~3 sec after your pulse shows). Camera off again after.'
            : 'We lock ~3 sec after your pulse appears, then track your pace like a strap.'

  const flashNote = torch.on
    ? 'Flash on · lift finger when it locks'
    : torch.mode === 'ambient'
      ? 'No flash needed'
      : torch.supported
        ? 'Starting flash…'
        : 'Flash unavailable in this browser'

  return (
    <Screen calm>
      <div className="session-top">
        <span>{title}</span>
        <span>
          {lock.locked ? 'Locked' : error || timedOut ? '—' : `${progressPct}%`}
        </span>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {error
          ? `Camera error. ${error}`
          : timedOut
            ? 'Could not lock pulse in time. Try again or use a chest strap.'
            : lock.locked
              ? `Pulse locked at ${displayBpm} beats per minute. Continuing.`
              : `${displayBpm ? `${displayBpm} beats per minute.` : 'Waiting for pulse.'} ${hint} ${flashNote}.`}
      </p>
      <div className="session-hero">
        <div className="cue">{cue}</div>
        <div className="bpm-row">
          <div className={`bpm${lock.locked ? '' : ' live'}`} aria-hidden="true">
            {displayBpm ?? '—'}
          </div>
          <div className="bpm-unit">BPM</div>
        </div>
        {!lock.locked && !error && !timedOut ? (
          <div
            className="hr-lock-bar hr-lock-bar-hero"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Lock progress"
          >
            <div className="hr-lock-fill" style={{ width: `${progressPct}%` }} />
          </div>
        ) : null}
        <p className="hint">{error ? error : hint}</p>
        {!lock.locked && !error && !timedOut ? (
          <div className="hr-stage hr-stage-compact" aria-hidden="true">
            {nodes}
          </div>
        ) : null}
        {!error && !timedOut ? (
          <p className="sensor" style={{ marginTop: 8 }}>
            {flashNote}. {quality.label}.
            {lock.emergency ? ' Quick lock.' : lock.soft ? ' Stable lock.' : ''}
          </p>
        ) : null}
      </div>
      <Foot>
        {error || timedOut ? (
          <>
            <Primary onClick={onRetry}>Try again</Primary>
            <Ghost onClick={() => go('connect-ble')}>Use chest strap</Ghost>
          </>
        ) : isResync ? (
          <>
            <Ghost onClick={() => go('active')}>Skip — use last reading</Ghost>
            <Ghost onClick={() => go('after')}>Stop session</Ghost>
          </>
        ) : (
          <>
            <Ghost onClick={() => go('connect-ble')}>Back</Ghost>
            {noTorch ? (
              <Primary onClick={() => go('connect-ble')}>Connect strap</Primary>
            ) : null}
          </>
        )}
      </Foot>
    </Screen>
  )
}

export function ConnectCamera(props) {
  const { mode = 'connect' } = props
  const [retryKey, setRetryKey] = useState(0)
  return (
    <ConnectCameraInner
      key={`${mode}-${retryKey}`}
      {...props}
      onRetry={() => setRetryKey((k) => k + 1)}
    />
  )
}

export function PulseResync(props) {
  return <ConnectCamera {...props} mode="resync" goTarget="active" />
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
  const reduce = usePrefersReducedMotion()
  const [bpm, setBpm] = useState(base)
  useEffect(() => {
    if (reduce) {
      setBpm(base)
      return undefined
    }
    const id = setInterval(() => {
      setBpm((n) => {
        const drift = Math.round((Math.random() - 0.5) * 4)
        return Math.max(base - 8, Math.min(base + 8, n + drift))
      })
    }, 900)
    return () => clearInterval(id)
  }, [base, reduce])
  return bpm
}

function useTrackedSessionBpm({
  source,
  cameraBpm,
  zone,
  phase,
  elapsedSec,
  durationSec,
  mockBase,
}) {
  const reduce = usePrefersReducedMotion()
  const useCamera = source === 'camera' && cameraBpm != null && zone
  const strapBpm = useBpm(mockBase)
  const [bpm, setBpm] = useState(() => (useCamera ? cameraBpm : mockBase))
  const tickRef = useRef(0)

  useEffect(() => {
    if (useCamera) setBpm(cameraBpm)
  }, [useCamera, cameraBpm])

  useEffect(() => {
    if (!useCamera) return undefined
    const tick = () => {
      tickRef.current += 1
      setBpm(
        modelSessionBpm({
          baseline: cameraBpm,
          zone,
          phase,
          elapsedSec,
          durationSec,
          reduceMotion: reduce,
          tick: tickRef.current,
        }),
      )
    }
    tick()
    const id = setInterval(tick, reduce ? 2000 : 900)
    return () => clearInterval(id)
  }, [useCamera, cameraBpm, zone, phase, elapsedSec, durationSec, reduce])

  if (!useCamera) {
    return { bpm: strapBpm, lockedCamera: false, lockedBpm: cameraBpm }
  }
  return { bpm, lockedCamera: true, lockedBpm: cameraBpm }
}

export function Warmup({ go, source, cameraBpm, age, level }) {
  const zone = targetZone(age, level)
  const [left] = useSessionClock(true, WARMUP_SECONDS)
  const elapsed = WARMUP_SECONDS - left
  const { bpm, lockedCamera, lockedBpm } = useTrackedSessionBpm({
    source,
    cameraBpm,
    zone,
    phase: 'warmup',
    elapsedSec: elapsed,
    durationSec: WARMUP_SECONDS,
    mockBase: 96,
  })
  const announced = useThrottledValue(bpm)
  const nextScreen =
    source === 'camera' && cameraBpm != null ? 'pulse-resync' : 'active'
  useEffect(() => {
    if (left === 0) go(nextScreen)
  }, [left, go, nextScreen])
  return (
    <Screen calm>
      <div className="session-top">
        <span>Warmup</span>
        <span>{formatTime(left)} left</span>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Warmup. {announced} beats per minute
        {lockedCamera ? ', tracked from pulse check' : ''}. {formatTime(left)} left. Ease in gently.
      </p>
      <div className="session-hero">
        <div className="cue">Ease in gently</div>
        <div className="bpm-row">
          <div className="bpm live" aria-hidden="true">
            {bpm}
          </div>
          <div className="bpm-unit">BPM</div>
        </div>
        <p className="hint">
          {lockedCamera
            ? `Tracking toward your target zone from pulse check (${lockedBpm} bpm at start) — hands free.`
            : 'Walk or pedal slowly. We’ll tell you when to settle into your target.'}
        </p>
      </div>
      <Foot>
        <Secondary onClick={() => go(nextScreen)}>Skip to target</Secondary>
        <Primary onClick={() => go('after')}>Stop</Primary>
      </Foot>
    </Screen>
  )
}

export function Active({ go, age, level, source, cameraBpm }) {
  const zone = targetZone(age, level)
  const [left] = useSessionClock(true, ACTIVE_SECONDS)
  const elapsed = ACTIVE_SECONDS - left
  const { bpm, lockedCamera, lockedBpm } = useTrackedSessionBpm({
    source,
    cameraBpm,
    zone,
    phase: 'active',
    elapsedSec: elapsed,
    durationSec: ACTIVE_SECONDS,
    mockBase: 133,
  })
  const announced = useThrottledValue(bpm)
  const status = zoneStatus(bpm, zone)
  const min = zone.low - 30
  const max = zone.high + 30
  const pct = ((bpm - min) / (max - min)) * 100
  const sourceLabel = lockedCamera
    ? `Tracked pace · target ${zone.low}–${zone.high} · from pulse checks`
    : source === 'polar' || source === 'garmin'
      ? 'Chest strap · demo signal'
      : 'Pacing estimate'
  useEffect(() => {
    if (left === 0) go('after')
  }, [left, go])
  return (
    <Screen calm>
      <div className="session-top">
        <span>
          Steady state
          <div className="kicker tone-in" style={{ margin: '6px 0 0' }}>
            Target {zone.low}–{zone.high}
          </div>
        </span>
        <span>{formatTime(left)} left</span>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announced} beats per minute, {status}. Target {zone.low} to {zone.high}. {formatTime(left)} left.{' '}
        {sourceLabel}.
      </p>
      <div className="session-hero">
        <div className="cue">Hold here</div>
        <div className="bpm-row">
          <div className={`bpm${lockedCamera ? ' live' : ''}`} aria-hidden="true">
            {bpm}
          </div>
          <div className="bpm-unit">BPM</div>
        </div>
        <div
          className="gauge"
          role="img"
          aria-label={`Heart rate ${bpm}, ${status}. Target ${zone.low} to ${zone.high}.`}
        >
          <div className="gauge-track">
            <div className="g-below" />
            <div className="g-in" />
            <div className="g-above" />
            <div className="needle" style={{ left: `${Math.max(2, Math.min(98, pct))}%` }} />
          </div>
        </div>
        <p className="sensor">
          {sourceLabel}. {status}.
        </p>
      </div>
      <Foot>
        <Secondary onClick={() => go('glance')}>Dim the screen</Secondary>
        <Primary onClick={() => go('after')}>Stop</Primary>
      </Foot>
    </Screen>
  )
}

export function Glance({ go, source, cameraBpm, age, level }) {
  const zone = targetZone(age, level)
  const { bpm, lockedCamera } = useTrackedSessionBpm({
    source,
    cameraBpm,
    zone,
    phase: 'active',
    elapsedSec: ACTIVE_SECONDS / 2,
    durationSec: ACTIVE_SECONDS,
    mockBase: 133,
  })
  const announced = useThrottledValue(bpm)
  return (
    <Screen variant="glance" calm>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Heart rate {announced} beats per minute
        {lockedCamera ? ', from camera lock' : ''}.
      </p>
      <button
        type="button"
        className="glance-hit"
        onClick={() => go('active')}
        aria-label={`Heart rate ${bpm} beats per minute. Tap to return to the session.`}
      >
        <div className="glance-bpm" aria-hidden="true">
          {bpm}
        </div>
        <p className="glance-hint">Tap anywhere to return</p>
      </button>
    </Screen>
  )
}

export function After({ go, after, setAfter, onSave }) {
  return (
    <Screen>
      <Status left={<Clock />} right="After session" />
      <div className="screen-body">
        <Kicker>After</Kicker>
        <Title>How do you feel now?</Title>
        <Lead>We’ll ask once more in an hour. That settling is what the rule uses.</Lead>
        <div
          className="choice-stack"
          role="radiogroup"
          aria-label="After session. Overall symptoms from 0 completely fine to 10 the worst it has been."
        >
          {OVERALL_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={after === n}
              aria-label={`${n} of 10, ${OVERALL_LABELS[n]}`}
              className={`choice${after === n ? ' on' : ''}`}
              onClick={() => setAfter(n)}
            >
              {n} {OVERALL_LABELS[n]}
            </button>
          ))}
        </div>
      </div>
      <Foot>
        <Primary onClick={() => (onSave ? onSave() : go('hour'))}>Save</Primary>
      </Foot>
    </Screen>
  )
}

export function HourLater({ go, hour, setHour, onSave }) {
  return (
    <Screen>
      <Status left={<Clock />} right="Follow-up" />
      <div className="screen-body">
        <Kicker>One hour later</Kicker>
        <Title wide>Have symptoms settled?</Title>
        <Lead>In a real day this waits an hour. For the prototype, log it now.</Lead>
        <div
          className="choice-stack"
          role="radiogroup"
          aria-label="One hour later. Overall symptoms from 0 completely fine to 10 the worst it has been."
        >
          {[3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={hour === n}
              aria-label={`${n} of 10, ${OVERALL_LABELS[n] || `${n} out of 10`}`}
              className={`choice${hour === n ? ' on' : ''}`}
              onClick={() => setHour(n)}
            >
              {n} / 10
            </button>
          ))}
        </div>
      </div>
      <Foot>
        <Primary onClick={() => (onSave ? onSave() : go('held'))}>See today’s rule</Primary>
      </Foot>
    </Screen>
  )
}

export function Held({ go, before, after, hour, setLevel, level }) {
  const rise = after - before
  const settled = hour - before <= 2 && rise <= 2
  const nextLevel = settled ? Math.min(5, level + 1) : level
  const advanced = settled && nextLevel > level
  const atMax = level >= 5
  const kicker = advanced
    ? `Moving to level ${nextLevel}`
    : atMax && settled
      ? 'Level 5 — top of the progression'
      : `Staying at level ${level}`
  const title = advanced
    ? 'That sat inside the rule'
    : atMax && settled
      ? 'You’re already at the top level'
      : 'Not moving up today'
  const button = advanced || (atMax && settled) ? 'Back to today' : 'Try again tomorrow'
  return (
    <Screen>
      <Status left={<Clock />} right="" />
      <div className="screen-body">
        <Kicker tone={settled ? 'in' : 'above'}>{kicker}</Kicker>
        <Title wide>{title}</Title>
        <div className="stack">
          <div className="metric-row">
            <span>Before session</span>
            <strong>{before} / 10</strong>
          </div>
          <div className={`metric-row${rise > 2 ? ' hot' : ''}`}>
            <span>After session{rise > 2 ? ' — rose more than 2 points' : ''}</span>
            <strong>{after} / 10</strong>
          </div>
          <div className={`metric-row${hour - before > 2 ? ' hot' : ''}`}>
            <span>One hour later{hour - before > 2 ? ' — had not settled' : ''}</span>
            <strong>{hour} / 10</strong>
          </div>
          {atMax ? (
            <InfoCard label="About levels" tone="in">
              Levels run from 1 to 5. Five is the highest subthreshold step in this prototype — staying here after a
              good session is expected, not a bug.
            </InfoCard>
          ) : null}
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
            if (advanced) setLevel(nextLevel)
            go('home')
          }}
        >
          {button}
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
