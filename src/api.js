import * as clientApi from './clientApi.js'
import { advanceDemoDay, appLocalDate, resetDemoDay } from './data.js'

const PROFILE_KEY = 'threshold-profile-id'

/**
 * Vercel serverless has no shared memory — phone check-ins failed when the
 * profile lived on a different instance. Production builds keep recovery data
 * on-device (localStorage). Local `npm run dev` still uses the Express API.
 */
function useClientStore() {
  if (import.meta.env.VITE_CLIENT_STORE === '1') return true
  if (import.meta.env.VITE_CLIENT_STORE === '0') return false
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host.endsWith('.vercel.app') || host === 'localhost' && import.meta.env.PROD
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error?.message || 'Request failed')
    error.code = data.error?.code
    error.status = res.status
    throw error
  }
  return data
}

export function localDate() {
  return appLocalDate()
}

export { advanceDemoDay, resetDemoDay }

export function savedProfileId() {
  return localStorage.getItem(PROFILE_KEY) || ''
}

export function rememberProfileId(id) {
  if (id) localStorage.setItem(PROFILE_KEY, id)
  return id
}

export function forgetProfileId() {
  localStorage.removeItem(PROFILE_KEY)
}

export function deleteProfile(profileId) {
  if (useClientStore()) return clientApi.deleteProfile(profileId)
  return request(`/profiles/${profileId}`, { method: 'DELETE' })
}

export function createProfile({ injuryDate, age, answers }) {
  const date = localDate()
  if (useClientStore()) {
    return clientApi.createProfile({ injuryDate, age: Number(age), answers, localDate: date })
  }
  return request('/profiles', {
    method: 'POST',
    body: { injuryDate, age: Number(age), answers, localDate: date },
  })
}

export function updateProfile(profileId, { injuryDate, age, answers, level, level5StableStreak, progressionPhase }) {
  if (useClientStore()) {
    return clientApi.updateProfile(profileId, {
      injuryDate,
      age: age != null ? Number(age) : undefined,
      answers,
      level,
      level5StableStreak,
      progressionPhase,
    })
  }
  return request(`/profiles/${profileId}`, {
    method: 'PATCH',
    body: {
      injuryDate,
      age: age != null ? Number(age) : undefined,
      answers,
      level,
      level5StableStreak,
      progressionPhase,
    },
  })
}

export function getToday(profileId) {
  const date = localDate()
  if (useClientStore()) return clientApi.getToday(profileId, date)
  return request(`/profiles/${profileId}/today?localDate=${encodeURIComponent(date)}`)
}

export function saveCheckin(profileId, { scores, overall }) {
  const date = localDate()
  if (useClientStore()) {
    return clientApi.saveCheckin(profileId, { scores, overall, localDate: date })
  }
  return request(`/profiles/${profileId}/checkins`, {
    method: 'POST',
    body: { scores, overall, localDate: date },
  })
}

export function startSession(profileId, { redFlags, before, hrSource, intent }) {
  const date = localDate()
  if (useClientStore()) {
    return clientApi.startSession(profileId, {
      redFlags,
      before,
      hrSource,
      intent,
      localDate: date,
    })
  }
  return request(`/profiles/${profileId}/sessions`, {
    method: 'POST',
    body: { redFlags, before, hrSource, intent, localDate: date },
  })
}

export function setSessionSource(profileId, sessionId, hrSource) {
  if (useClientStore()) {
    return clientApi.setSessionSource(profileId, sessionId, hrSource)
  }
  return request(`/profiles/${profileId}/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { hrSource },
  })
}

export function saveAfter(profileId, sessionId, after) {
  if (useClientStore()) return clientApi.saveAfter(profileId, sessionId, after)
  return request(`/profiles/${profileId}/sessions/${sessionId}/after`, {
    method: 'POST',
    body: { after },
  })
}

export function saveHour(profileId, sessionId, { hour, after }) {
  if (useClientStore()) return clientApi.saveHour(profileId, sessionId, { hour, after })
  return request(`/profiles/${profileId}/sessions/${sessionId}/hour`, {
    method: 'POST',
    body: { hour, after },
  })
}

export function getClinicianLog(profileId) {
  const date = localDate()
  if (useClientStore()) return clientApi.getClinicianLog(profileId, date)
  return request(`/profiles/${profileId}/log?localDate=${encodeURIComponent(date)}`)
}

export function seedClinicianDemo(profileId) {
  if (!useClientStore()) return profileId
  return clientApi.seedClinicianDemoData(profileId)
}
