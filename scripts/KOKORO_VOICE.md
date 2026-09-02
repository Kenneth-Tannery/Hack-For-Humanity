# Kokoro voice pack for Threshold

Threshold **does not run Kokoro in the browser**. It uses pre-generated WAV clips when present, and falls back to the phone’s built-in speech if a clip is missing or cannot play.

## How voice worked before (robotic)

`src/speech.js` called **`window.speechSynthesis`** (Web Speech API). The OS picks a voice (Samantha, Google US English, etc.). Quality varies by device and often sounds robotic.

## Target workflow (Kokoro → WAV → app)

1. **Generate the line list**
   ```bash
   npm run voice:manifest
   ```
   Creates:
   - `public/audio/voice/manifest.json` — id, text, filename for every clip
   - `public/audio/voice/voice-lines.tsv` — paste-friendly batch sheet

2. **Generate all clips (Python, recommended)**
   ```bash
   pip install kokoro soundfile   # Python 3.12
   npm run voice:generate         # all 62 clips
   ```
   Or in parts if downloads time out: `npm run voice:generate:1` … `:4`

   Manual alternative: [OfflineTTS app](https://offlinetts.com/app/) — paste lines, download, rename to match manifest.

3. **Pick one voice for the whole app**
   - Recommended: **`af_heart`** (calm US English)
   - Speed: **0.92** (matches our slower, concussion-friendly pacing)

4. **Drop files here**
   ```
   public/audio/voice/
     manifest.json
     splash.wav
     disclaimer.wav
     symptom-headache.wav
     …
   ```

5. **Deploy**
   ```bash
   npm run deploy:prod
   ```
   Vite bundles `public/` into the production site. Enable **Voice guide** in Settings to hear clips on each screen.

## How the app plays clips

| File | Role |
| --- | --- |
| `src/voiceClips.js` | Maps screen / symptom → clip id, resolves WAV URL from manifest |
| `src/speech.js` | `speak(text, { clipId })` unlocks audio on tap, tries WAV first, then speechSynthesis |
| `src/App.jsx` | Voice guide calls `speakScreen(screen, ctx)` after navigation |
| `src/screens.jsx` | Symptom / overall check-in call `speak` with clip ids |

## Fallback behavior

If a WAV is missing or playback fails after unlock, the app **still speaks** using browser TTS so nothing breaks during incremental recording.

## Privacy

- Kokoro generation happens **on your machine** via the webpage (English can stay fully local after first model download).
- **No symptom text is sent to a TTS API at runtime** once clips are bundled in the app.
- Only static scripted lines are pre-recorded; dynamic numbers (exact day count) use the nearest static clip or TTS fallback.
