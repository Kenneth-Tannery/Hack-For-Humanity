import { formatClinicianLogMarkdown } from '../server/clinicianLog.js'

export { formatClinicianLogMarkdown }

export function downloadClinicianLogMd(log) {
  if (typeof document === 'undefined' || !log) return
  const md = formatClinicianLogMarkdown(log)
  const date = log.profile?.injuryDate ?? new Date().toISOString().slice(0, 10)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `threshold-recovery-log-${date}.md`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
