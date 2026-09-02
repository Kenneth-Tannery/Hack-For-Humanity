/**
 * Generate all voice clips from manifest.json using Kokoro (kokoro-js).
 * Same voice as OfflineTTS: af_heart @ speed 0.92
 *
 * Run: npm run voice:generate
 * Requires: npm install (kokoro-js devDependency), ~400MB model download on first run.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { KokoroTTS } from 'kokoro-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../public/audio/voice')
const MANIFEST_PATH = path.join(ROOT, 'manifest.json')

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
const voice = manifest.recommendedVoice || 'af_heart'
const speed = manifest.recommendedSpeed ?? 0.92

const seen = new Set()
const clips = manifest.clips.filter((clip) => {
  if (seen.has(clip.file)) return false
  seen.add(clip.file)
  return true
})

console.log(`Loading Kokoro model (first run downloads ~300MB)...`)
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
})

console.log(`Generating ${clips.length} clips with voice=${voice} speed=${speed}`)

for (let i = 0; i < clips.length; i += 1) {
  const clip = clips[i]
  const outPath = path.join(ROOT, clip.file.replace(/\.mp3$/i, '.wav'))
  const label = `[${String(i + 1).padStart(2, '0')}/${clips.length}] ${clip.id}`

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
    console.log(`${label} skip (exists)`)
    continue
  }

  process.stdout.write(`${label} … `)
  try {
    const audio = await tts.generate(clip.text, { voice, speed })
    audio.save(outPath)
    const kb = Math.round(fs.statSync(outPath).size / 1024)
    console.log(`${kb} KB`)
  } catch (err) {
    console.log(`FAILED: ${err.message}`)
  }
}

// Point manifest at .wav outputs (HTML5 Audio plays WAV; smaller than MP3 without ffmpeg).
const nextManifest = {
  ...manifest,
  generatedAt: new Date().toISOString(),
  clipFormat: 'wav',
  clips: manifest.clips.map((clip) => ({
    ...clip,
    file: clip.file.replace(/\.mp3$/i, '.wav'),
  })),
}
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`)
console.log(`\nDone. Updated manifest to .wav. Files in ${ROOT}`)
