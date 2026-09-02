export function Back({ onClick }) {
  return (
    <button type="button" className="back-link" onClick={onClick} aria-label="Back">
      &lt; Back
    </button>
  )
}

export function ProgressTrack({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Status({ left, right, onBack }) {
  return (
    <div className="status">
      <span>
        {left}
        {onBack && right ? ` · ${right}` : null}
      </span>
      {onBack ? <Back onClick={onBack} /> : <span>{right}</span>}
    </div>
  )
}

export function Kicker({ children, tone }) {
  return <div className={`kicker${tone ? ` tone-${tone}` : ''}`}>{children}</div>
}

export function Title({ children, wide }) {
  return <h1 className={`title${wide ? ' wide' : ''}`}>{children}</h1>
}

export function Lead({ children }) {
  return <p className="lead">{children}</p>
}

export function Card({ children }) {
  return <div className="card">{children}</div>
}

export function InfoCard({ label, tone, children, cite }) {
  return (
    <div className="card">
      <div className={`card-label${tone ? ` tone-${tone}` : ''}`}>{label}</div>
      <div className="card-copy">{children}</div>
      {cite ? <div className="card-cite">{cite}</div> : null}
    </div>
  )
}

export function Primary({ children, onClick, type = 'button', disabled, ...rest }) {
  return (
    <button type={type} className="btn btn-primary" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}

export function Secondary({ children, onClick, disabled, ...rest }) {
  return (
    <button type="button" className="btn btn-secondary" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}

export function Ghost({ children, onClick, ...rest }) {
  return (
    <button type="button" className="btn btn-ghost" onClick={onClick} {...rest}>
      {children}
    </button>
  )
}

export function Danger({ children, onClick, disabled }) {
  return (
    <button type="button" className="btn btn-danger" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Disclaimer() {
  return <p className="disclaimer">Not medical advice. Prototype only.</p>
}

export function VoiceDock({ muted, onMute, onRepeat, visible }) {
  if (!visible) return null
  return (
    <div className="voice-dock" role="group" aria-label="Voice guide">
      <button type="button" className="btn btn-secondary voice-dock-btn" onClick={onRepeat} disabled={muted}>
        Repeat
      </button>
      <button type="button" className="btn btn-ghost voice-dock-btn" onClick={onMute} aria-pressed={muted}>
        {muted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  )
}

export function SaveError({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="save-error" role="alert">
      <p>{message}</p>
      <button type="button" className="save-error-dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}

export function Foot({ children }) {
  return (
    <div className="screen-foot">
      {children}
      <Disclaimer />
    </div>
  )
}

export function ToggleSwitch({ on, label }) {
  return (
    <span className="toggle-switch" aria-hidden={label ? undefined : true} aria-label={label}>
      <span className="toggle-knob" />
    </span>
  )
}

export function Screen({ children, variant, onClick, alert, calm }) {
  const classes = ['screen']
  if (variant) classes.push(`is-${variant}`)
  if (calm) classes.push('is-calm')
  return (
    <section
      className={classes.join(' ')}
      onClick={onClick}
      role={alert ? 'alert' : undefined}
      aria-live={alert ? 'assertive' : undefined}
    >
      {children}
    </section>
  )
}

export function Clock() {
  const now = new Date()
  const h = now.getHours()
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h % 12 || 12}:${m}`
}
