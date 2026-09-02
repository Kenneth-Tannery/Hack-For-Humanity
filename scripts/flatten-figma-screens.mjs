import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.cypress/exports/figma-screens')

if (!fs.existsSync(root)) {
  console.log('No .cypress/exports/figma-screens folder — nothing to flatten.')
  process.exit(0)
}

function flattenDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      flattenDir(full)
      continue
    }
    if (!entry.name.endsWith('.png')) continue
    const flat = path.join(root, entry.name)
    if (full === flat) continue
    if (fs.existsSync(flat)) fs.unlinkSync(flat)
    fs.renameSync(full, flat)
  }
}

flattenDir(root)

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  fs.rmSync(path.join(root, entry.name), { recursive: true, force: true })
}

const pngs = fs.readdirSync(root).filter((n) => n.endsWith('.png'))
console.log(`Flattened ${pngs.length} PNG(s) into ${root}`)
