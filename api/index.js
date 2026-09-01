/**
 * Vercel serverless entry — same Express API as local `server/index.js`.
 * SQLite lives under /tmp on Vercel (ephemeral; fine for demos).
 */
import app from '../server/index.js'

export default app
