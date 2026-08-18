export function Status({ left, right }) {
  return (
    <div className="status">
      <span>{left}</span>
      <span>{right}</span>
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

export function Primary({ children, onClick, type = 'button', disabled }) {
  return (
    <button type={type} className="btn btn-primary" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Secondary({ children, onClick }) {
  return (
    <button type="button" className="btn btn-secondary" onClick={onClick}>
      {children}
    </button>
  )
}

export function Ghost({ children, onClick }) {
  return (
    <button type="button" className="btn btn-ghost" onClick={onClick}>
      {children}
    </button>
  )
}

export function Danger({ children, onClick }) {
  return (
    <button type="button" className="btn btn-danger" onClick={onClick}>
      {children}
    </button>
  )
}

export function Disclaimer() {
  return <p className="disclaimer">Not medical advice. Prototype only.</p>
}

export function Foot({ children }) {
  return (
    <div className="screen-foot">
      {children}
      <Disclaimer />
    </div>
  )
}

export function Screen({ children, variant, onClick }) {
  return (
    <section className={`screen${variant ? ` is-${variant}` : ''}`} onClick={onClick}>
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
