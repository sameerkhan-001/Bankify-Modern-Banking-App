/**
 * Demo seed: `npm run seed`
 *
 * Creates (idempotently) the SYSTEM user + account that is needed for the
 * `POST /api/transactions/system/initial-funds` endpoint, plus two demo users
 * with funded accounts and a couple of transfers so the UI has data to show.
 *
 * Writes through the same Mongoose models as the API. DEMO DATA ONLY - refuses
 * to run when NODE_ENV=production.
 */
require("dotenv").config()
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const userModel = require("../src/models/user.model")
const accountModel = require("../src/models/account.model")
const transactionModel = require("../src/models/transaction.model")
const ledgerModel = require("../src/models/ledger.model")

const SYSTEM_EMAIL = process.env.SYSTEM_EMAIL || "system@bankify.local"
const SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD || "ChangeMe123!"
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo@1234"
const DEMO_PIN = process.env.DEMO_PIN || "123456"

async function ensureUser({ email, name, password, systemUser = false, pin }) {
    const existing = await userModel.findOne({ email })
    if (existing) return existing
    const pinHash = pin ? await bcrypt.hash(pin, 10) : undefined
    return userModel.create({ email, name, password, systemUser, pinHash })
}

async function ensureAccounts(user, count) {
    const accounts = await accountModel.find({ user: user._id }).sort({ createdAt: 1 })
    while (accounts.length < count) {
        accounts.push(await accountModel.create({ user: user._id }))
    }
    return accounts
}

// Records a completed transfer + its DEBIT/CREDIT ledger entries (skipped if the key exists).
async function record(key, from, to, amount) {
    if (await transactionModel.findOne({ idempotencyKey: key })) return
    const tx = await transactionModel.create({
        fromAccount: from._id, toAccount: to._id, amount, idempotencyKey: key, status: "COMPLETED"
    })
    await ledgerModel.create([
        { account: from._id, amount, transaction: tx._id, type: "DEBIT" },
        { account: to._id, amount, transaction: tx._id, type: "CREDIT" }
    ], { ordered: true })
}

async function main() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Refusing to seed demo data when NODE_ENV=production")
    }
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set")

    await mongoose.connect(process.env.MONGO_URI)

    const system = await ensureUser({ email: SYSTEM_EMAIL, name: "System Account", password: SYSTEM_PASSWORD, systemUser: true })
    const [systemAccount] = await ensureAccounts(system, 1)

    const rahul = await ensureUser({ email: "rahul@example.com", name: "Rahul Sharma", password: DEMO_PASSWORD, pin: DEMO_PIN })
    const priya = await ensureUser({ email: "priya@example.com", name: "Priya Verma", password: DEMO_PASSWORD, pin: DEMO_PIN })
    const [rahul1, rahul2] = await ensureAccounts(rahul, 2)
    const [priya1] = await ensureAccounts(priya, 1)

    await record("seed-fund-rahul-1", systemAccount, rahul1, 12450)
    await record("seed-fund-rahul-2", systemAccount, rahul2, 8200)
    await record("seed-fund-priya-1", systemAccount, priya1, 5000)
    await record("seed-transfer-priya-to-rahul", priya1, rahul1, 2000)
    await record("seed-transfer-rahul-to-priya", rahul1, priya1, 500)

    console.log("\nSeed complete.\n")
    console.log(`System user : ${SYSTEM_EMAIL} / ${SYSTEM_PASSWORD}   (used by scripts/fund.js)`)
    console.log(`Demo users  : rahul@example.com, priya@example.com / ${DEMO_PASSWORD}   (transaction PIN ${DEMO_PIN})`)
    console.log(`Rahul accts : ${rahul1._id}, ${rahul2._id}`)
    console.log(`Priya acct  : ${priya1._id}   <- use as a transfer recipient`)
}

main()
    .catch((err) => { console.error("Seed failed:", err.message); process.exitCode = 1 })
    .finally(() => mongoose.disconnect())
