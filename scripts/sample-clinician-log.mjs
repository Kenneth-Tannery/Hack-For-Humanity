import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildClinicianLog, formatClinicianLogMarkdown } from '../server/clinicianLog.js'
import { buildClinicianDemoRecords } from '../server/clinicianDemoData.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const { profile, checkins, sessions, localDate } = buildClinicianDemoRecords()
const log = buildClinicianLog({ profile, checkins, sessions, localDate })
const md = formatClinicianLogMarkdown(log)
const outDir = path.join(root, '.cypress', 'exports')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'sample-clinician-log.md')
fs.writeFileSync(outPath, md)
console.log(`Wrote ${outPath} (${md.length} chars, ${checkins.length} check-ins, ${sessions.length} sessions)`)
