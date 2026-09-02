# Kokoro voice pack for Threshold

Threshold **does not run Kokoro in the browser today**. It uses pre-downloaded MP3 clips when present, and falls back to the phone’s built-in speech if a clip is missing.

## How voice worked before (robotic)

`src/speech.js` called **`window.speechSynthesis`** (Web Speech API). The OS picks a voice (Samantha, Google US English, etc.). Quality varies by device and often sounds robotic.

## Target workflow (Kokoro → MP3 → app)

1. **Generate the line list**
   ```bash
   npm run voice:manifest
   ```
   Creates:
   - `public/audio/voice/manifest.json` — id, text, filename for every clip
   - `public/audio/voice/voice-lines.tsv` — paste-friendly batch sheet

2. **Open Kokoro in the browser**
   - [OfflineTTS app](https://offlinetts.com/app/) (Kokoro default)
   - [Voice library](https://offlinetts.com/voice/) to preview voices

3. **Pick one voice for the whole app**
   - Recommended: **`af_heart`** or **`af_bella`** (calm US English)
   - Speed: **0.90–0.92** (matches our slower, concussion-friendly pacing)

4. **Generate and download**
   - **Single mode:** paste one line from the TSV, generate, download **MP3**
   - **Batch mode** (Resodock / OfflineTTS): one line per row, export ZIP, rename files to match `manifest.json` (`splash.mp3`, `symptom-headache.mp3`, …)

5. **Drop files here**
   ```
   public/audio/voice/
     manifest.json
     splash.mp3
     disclaimer.mp3
     symptom-headache.mp3
     …
   ```

6. **Test locally**
   ```bash
   npm run dev
   ```
   Enable **Voice guide** or **Log symptoms (audio)** in Settings. Clips play from `/audio/voice/*.mp3`.

7. **Deploy**
   ```bash
   npm run deploy:prod
   ```
   Vite bundles `public/` into the production site.

## How the app plays clips

| File | Role |
| --- | --- |
| `src/voiceClips.js` | Maps screen / symptom → clip id, resolves MP3 URL |
| `src/speech.js` | `speak(text, { clipId })` tries MP3 first, then speechSynthesis |
| `src/App.jsx` | Voice guide calls `speakScreen(screen, ctx)` |
| `src/screens.jsx` | Symptom / overall check-in call `speak` with clip ids |

## Clip ids (examples)

| id | When it plays |
| --- | --- |
| `splash` | Splash screen |
| `symptom-headache` | Audio check-in, symptom 1 |
| `overall` | Overall rating step |
| `home-logged` | Home with symptoms logged |
| `held-graduated` | Level 5 maintenance graduation |

Full list: run `npm run voice:manifest` and open `manifest.json`.

## Fallback behavior

If an MP3 is missing (not generated yet), the app **still speaks** using browser TTS so nothing breaks during incremental recording.

## Privacy

- Kokoro generation happens **on your machine** via the webpage (English can stay fully local after first model download).
- **No symptom text is sent to a TTS API at runtime** once clips are bundled in the app.
- Only static scripted lines are pre-recorded; dynamic numbers (exact day count) use the nearest static clip or TTS fallback.
