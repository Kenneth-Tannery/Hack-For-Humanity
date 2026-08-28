const PROFILE_KEY = 'threshold-profile-id'

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
  const now = new Date()
  const yy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function savedProfileId() {
  return localStorage.getItem(PROFILE_KEY) || ''
}

export function rememberProfileId(id) {
  if (id) localStorage.setItem(PROFILE_KEY, id)
  return id
}

export function createProfile({ injuryDate, age, answers }) {
  return request('/profiles', {
    method: 'POST',
    body: { injuryDate, age: Number(age), answers, localDate: localDate() },
  })
}

export function updateProfile(profileId, { injuryDate, age, answers }) {
  return request(`/profiles/${profileId}`, {
    method: 'PATCH',
    body: { injuryDate, age: Number(age), answers },
  })
}

export function getToday(profileId) {
  const date = localDate()
  return request(`/profiles/${profileId}/today?localDate=${encodeURIComponent(date)}`)
}

export function saveCheckin(profileId, { scores, overall }) {
  return request(`/profiles/${profileId}/checkins`, {
    method: 'POST',
    body: { scores, overall, localDate: localDate() },
  })
}

export function startSession(profileId, { redFlags, before, hrSource, intent }) {
  return request(`/profiles/${profileId}/sessions`, {
    method: 'POST',
    body: { redFlags, before, hrSource, intent, localDate: localDate() },
  })
}

export function setSessionSource(profileId, sessionId, hrSource) {
  return request(`/profiles/${profileId}/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { hrSource },
  })
}

export function saveAfter(profileId, sessionId, after) {
  return request(`/profiles/${profileId}/sessions/${sessionId}/after`, {
    method: 'POST',
    body: { after },
  })
}

export function saveHour(profileId, sessionId, { hour, after }) {
  return request(`/profiles/${profileId}/sessions/${sessionId}/hour`, {
    method: 'POST',
    body: { hour, after },
  })
}
