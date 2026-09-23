# Threshold

A **concussion recovery companion** for the Hack for Humanity Summer 26 Concussion Recovery track (Concussion Alliance and Synapse).

Threshold helps someone recovering from concussion log symptoms, decide whether a session is safe to start, and progress aerobic work with explicit stop/go rules. It is **not a diagnostic tool** and **does not replace clinical care**. Red flags always point to a human (ER, GP, clinician), never resolve in the app.

## Clinical backbone

Rules live in deterministic JavaScript (`server/clinical.js`), not an LLM.

- **Buffalo Concussion Treadmill Test / BCBT:** pause prescribed aerobic work when overall symptoms sit above 7/10.
- **Amsterdam International Consensus Statement on Concussion in Sport (2023):** symptoms may rise by at most 2 points during exercise, and must settle to within 2 points of the pre-session rating within an hour.
- After three stable sessions at Level 5, the app moves to **maintenance** (symptom check-in, no prescribed exercise).

The same rule functions run in production on-device and locally on the Express API, so stop/go logic does not depend on which store is used.

## How it works (and the tech)

### Phone UI and navigation

**What it does:** One phone-sized app. Splash, onboarding, home, check-in, session, settings, and clinician log.

**How it works:** There is no React Router. `src/App.jsx` holds a `screen` string and swaps which view from `src/screens.jsx` is shown. Shared chrome (cards, kickers, buttons) lives in `src/ui.jsx`. Theme is stored in `localStorage`.

**Tech:** React 19, Vite 7, CSS custom properties in `src/styles.css`. Fonts: Atkinson Hyperlegible for UI, Syne on splash only (Google Fonts).

### Onboarding and risk outlook

**What it does:** Disclaimer, injury date and age, optional recovery-risk questions, then an outlook screen before home.

**How it works:** Risk answers are stored on the profile. `outlookFromAnswers()` flags a possibly longer recovery if prior concussion, repeat injury, or migraine is yes. Outlook copy states limits of the app (no diagnosis, no return-to-sport clearance).

**Tech:** React screens plus the same `server/clinical.js` helper used by the API.

### Daily symptom check-in

**What it does:** 22 symptoms (0–6) plus an overall 0–10 rating. Audio-guided or silent.

**How it works:** Each tap advances one item. Scores persist as a check-in for the local calendar day. Overall score later gates whether exercise is allowed (Buffalo pause above 7/10).

**Tech:** React state in `App.jsx`, symptom list in `src/data.js`. Persistence is `localStorage` on Vercel (`src/clientApi.js`) or Express + SQLite locally (`server/index.js`, `better-sqlite3`).

### Red flags and emergency

**What it does:** Before every session, the user must review red flags. Checking any flag goes to emergency. There is a one-tap call path.

**How it works:** The red-flag list is hardcoded (`src/data.js`). The app cannot skip this screen to start exercise. Emergency uses a `tel:911` link so the phone dialer opens. No model is asked whether the flag is “real.”

**Tech:** Deterministic React flow. Native `tel:` URI. Copy cites clinical sources in-product.

### Session progression (stop / stay / level up)

**What it does:** Warmup, timed exertion, after-session rating, one-hour follow-up, then stay at the current level or step up.

**How it works:** `evaluateProgression()` compares before / after / hour ratings to the Amsterdam +2 and settle-within-an-hour rules. Level 5 counts stable days; three in a row graduate to maintenance. Heart-rate alerts (`HrElevated`, `HrUrgent`) are driven by ticks vs the level’s target zone in `src/data.js`.

**Tech:** Pure functions in `server/clinical.js` (imported by both client store and Express). Session timer and screens in React.

### Camera fingertip pulse

**What it does:** Estimates BPM from a fingertip over the rear camera, with torch pulsing so the finger is lit without staying at full LED the whole time.

**How it works:** `getUserMedia` opens the camera. A small canvas samples brightness (photoplethysmography). BPM is inferred from how often the brightness signal crosses its average (peak/interval method, same idea as richrd/heart-rate-monitor). Display BPM is smoothed; a lock fires about 2.5 seconds after a usable BPM appears. Torch is toggled via ImageCapture / MediaTrack `torch` constraint (on ~4.5 s, off ~0.5 s). Needs HTTPS (or localhost).

**Tech:** Web APIs: `MediaDevices.getUserMedia`, `<video>` + `<canvas>`, ImageCapture / `applyConstraints` for torch. On-device DSP in `src/hrCamera.js` and `src/useFingertipHr.jsx`. No cloud HR API.

### Live session heart-rate display

**What it does:** After a camera lock, the camera turns off. The session shows a paced BPM that drifts toward the target zone instead of claiming a live sensor for 20 minutes.

**How it works:** Baseline is the locked camera BPM. `modelSessionBpm()` eases toward zone midpoint during warmup, then holds a small wobble in-band during active work. Strap labels (Polar / Garmin) are UI choices only; they do not talk to Bluetooth hardware in this build.

**Tech:** Client-side model in `src/sessionBpm.js`. No Web Bluetooth.

### Voice guidance

**What it does:** Speaks each screen and symptom line at a slower, concussion-friendly pace. User can turn voice on or off.

**How it works:** Kokoro does **not** run in the browser. Clips are pre-generated WAV files under `public/audio/voice/` plus `manifest.json`. `src/speech.js` plays the matching clip with `HTMLAudioElement`. If a clip is missing, it falls back to `window.speechSynthesis` (Web Speech API) and prefers a soft English voice. A silent WAV unlocks iOS audio on first tap.

**Tech:** Static WAV assets, Web Audio playback, Web Speech API fallback. Offline generation: Python Kokoro (`scripts/generate-kokoro-clips.py`) or `kokoro-js` (`scripts/generate-kokoro-clips.mjs`). See `scripts/KOKORO_VOICE.md`.

### Clinician recovery log

**What it does:** A timeline of check-ins and sessions, with Markdown export a caregiver can share.

**How it works:** `buildClinicianLog()` assembles profile, ratings, session outcomes, and citations. Demo data can fill a multi-week timeline for judging. Export builds a `.md` file in the browser and triggers a download.

**Tech:** `server/clinicianLog.js` + `server/clinicianDemoData.js`. Download via `Blob` + object URL in `src/clinicianLogExport.js`. No email or cloud upload.

### Accessibility

**What it does:** Screen-reader labels on key controls, larger tap targets, contrast-oriented warm dark UI, and quieter motion when requested.

**How it works:** `aria-label` / `aria-pressed` on screens. `usePrefersReducedMotion()` and CSS `@media (prefers-reduced-motion: reduce)` cut animation. Symptom scale numbers have spoken severity labels.

**Tech:** Native ARIA, `matchMedia`, CSS. Helpers in `src/a11y.js`.

### Where data lives

**What it does:** Saves profile, check-ins, and sessions so the phone demo survives reloads.

**How it works:** Production (Vercel) cannot keep a shared SQLite file across serverless instances, so `VITE_CLIENT_STORE=1` keeps a JSON database in `localStorage` (`src/clientApi.js`). Local `npm run dev` proxies `/api` to Express on port 3001, which writes SQLite at `server/data/threshold.db`. Clinical math is the same in both paths.

**Tech:** `localStorage` (prod). Express 5, CORS, `better-sqlite3` (local). Vercel serverless wraps the same Express app (`api/index.js`) with an in-memory store if the API is hit without the client store.

### Hosting

**What it does:** Serves the SPA over HTTPS so camera and torch work on a real phone.

**How it works:** `vite build` emits `dist/`. Vercel serves the static app and rewrites `/api/*` to the serverless function. SPA routes fall through to `index.html`.

**Tech:** Vercel, `vercel.json`, Node 24. `npm run deploy:prod` is `npx vercel --prod`.

## Run it

**Hosted production** is the default for testing. Phone camera, torch, and HTTPS need a real deploy.

```bash
npm install
npm run deploy:prod
```

Use the unique Production URL from that command (the `*-adaptive-its.vercel.app` host), not only the stable alias.

**Local development** (Vite + Express SQLite):

```bash
npm install
npm run dev
```

Vite is on port 5173. The API is on 3001.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite UI + API |
| `npm run build` | Production client build |
| `npm run deploy:prod` | Deploy to Vercel production |
| `npm run voice:manifest` | Rebuild the Kokoro clip list |

## Repo layout

```
src/           React UI, camera PPG, speech, on-device store
server/        Clinical rules, Express API, SQLite / memory stores
api/           Vercel serverless entry
public/audio/  Pre-recorded Kokoro voice pack
scripts/       Voice generation and log helpers
```

Do not send symptom scores, HR, or free text to a third-party API without consent, minimization, and encryption.

## Safety

- Threshold does not diagnose concussion or clear return to sport.
- Red-flag logic is hardcoded and not skippable when a flag is checked.
- Escalation is to emergency services or a clinician, never an in-app “you’re fine.”
- An LLM must not diagnose, reassure, or override red-flag rules.

## License

Private hackathon project. Not medical software for clinical use.
