/**
 * Adds money to an account through the REAL API:
 *   npm run fund -- <accountId> <amount>
 * Logs in as the system user (see scripts/seed.js) and calls
 * POST /api/transactions/system/initial-funds. The API must be running.
 */
require("dotenv").config()
const crypto = require("crypto")

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`
const EMAIL = process.env.SYSTEM_EMAIL || "system@bankify.local"
const PASSWORD = process.env.SYSTEM_PASSWORD || "ChangeMe123!"

async function call(path, body, token) {
    const response = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body)
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`${response.status} ${data.message || "request failed"}`)
    return data
}

async function main() {
    const [toAccount, rawAmount] = process.argv.slice(2)
    const amount = Number(rawAmount)
    if (!toAccount || !Number.isFinite(amount)) {
        throw new Error("Usage: npm run fund -- <accountId> <amount>")
    }

    const { token } = await call("/api/auth/login", { email: EMAIL, password: PASSWORD })
    const result = await call("/api/transactions/system/initial-funds", {
        toAccount, amount, idempotencyKey: crypto.randomUUID()
    }, token)
    console.log(result.message, "->", result.transaction._id)
}

main().catch((err) => { console.error("Funding failed:", err.message); process.exit(1) })
