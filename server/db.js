/**
 * Storage facade: SQLite locally, in-memory on Vercel.
 * Native better-sqlite3 often crashes serverless — that caused “Could not save check-in” on the phone URL.
 */
const useMemory = Boolean(process.env.VERCEL) || process.env.THRESHOLD_STORE === 'memory'

const store = useMemory
  ? await import('./memoryStore.js')
  : await import('./db.sqlite.js')

export const createProfile = store.createProfile
export const getProfile = store.getProfile
export const updateProfile = store.updateProfile
export const upsertCheckin = store.upsertCheckin
export const getCheckinByDate = store.getCheckinByDate
export const latestCheckin = store.latestCheckin
export const listCheckins = store.listCheckins
export const checkinDates = store.checkinDates
export const createSession = store.createSession
export const getSession = store.getSession
export const updateSession = store.updateSession
export const listSessions = store.listSessions

export const db = useMemory ? null : store.db
