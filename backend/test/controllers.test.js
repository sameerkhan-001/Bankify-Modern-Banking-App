/**
 * Controller LOGIC tests - run with `npm test` (no MongoDB needed).
 *
 * The real controllers are loaded, but `mongoose`, the models, jsonwebtoken and the
 * email service are replaced with small in-memory fakes. These tests prove the
 * control flow (validation, ownership, idempotency, rollback-on-error, error
 * mapping). They do NOT prove real MongoDB behaviour such as transaction
 * isolation or write-conflict retries - that needs a replica set.
 */
const test = require("node:test")
const assert = require("node:assert/strict")
const Module = require("node:module")

/* ----------------------------- in-memory fakes ---------------------------- */

const db = { users: [], accounts: [], transactions: [], ledger: [], blacklist: [] }
let seq = 0
const newId = () => (++seq).toString(16).padStart(24, "0")
const reset = () => { Object.keys(db).forEach((k) => (db[k] = [])) }

const matches = (doc, filter = {}) => Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return cond.some((f) => matches(doc, f))
    const value = doc[key]
    if (cond && typeof cond === "object" && cond.$in) return cond.$in.map(String).includes(String(value))
    if (cond && typeof cond === "object" && (cond.$gte || cond.$lte)) return true
    return String(value) === String(cond)
})

// thenable query object supporting the chain methods the controllers use
const query = (resolve) => {
    const q = { then: (ok, fail) => Promise.resolve().then(resolve).then(ok, fail) }
    for (const m of ["sort", "skip", "limit", "select", "lean", "populate", "session"]) q[m] = () => q
    return q
}

const balanceOf = (accountId) => db.ledger
    .filter((l) => l.account === accountId)
    .reduce((sum, l) => sum + (l.type === "CREDIT" ? l.amount : -l.amount), 0)

const withBalance = (doc) => doc && Object.assign(doc, { getBalance: async () => balanceOf(doc._id) })

const accountModel = {
    findOne: (f) => query(() => withBalance(db.accounts.find((a) => matches(a, f)) || null)),
    find: (f) => query(() => db.accounts.filter((a) => matches(a, f))),
    exists: (f) => query(() => (db.accounts.some((a) => matches(a, f)) ? { _id: 1 } : null)),
    findOneAndUpdate: (f) => query(() => {
        const doc = db.accounts.find((a) => matches(a, f))
        if (!doc) return null
        doc.transferSeq = (doc.transferSeq || 0) + 1
        return withBalance(doc)
    }),
    create: async (data) => {
        const doc = { _id: newId(), status: "ACTIVE", currency: "INR", ...data }
        db.accounts.push(doc)
        return doc
    }
}

const populated = (tx) => {
    const party = (id) => {
        const account = db.accounts.find((a) => a._id === String(id))
        const user = account && db.users.find((u) => u._id === account.user)
        return { _id: String(id), user: user ? { name: user.name } : undefined }
    }
    return { ...tx, fromAccount: party(tx.fromAccount), toAccount: party(tx.toAccount) }
}

const transactionModel = {
    findOne: (f) => query(() => db.transactions.find((t) => matches(t, f)) || null),
    findById: (id) => query(() => {
        const tx = db.transactions.find((t) => t._id === String(id))
        return tx ? populated(tx) : null
    }),
    countDocuments: async (f) => db.transactions.filter((t) => matches(t, f)).length,
    find: (f) => query(() => db.transactions.filter((t) => matches(t, f)).map(populated).reverse()),
    aggregate: async () => [],
    create: async (docs) => docs.map((data) => {
        if (db.transactions.some((t) => t.idempotencyKey === data.idempotencyKey)) {
            throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 })
        }
        const doc = { _id: newId(), createdAt: new Date(), updatedAt: new Date(), ...data, save: async () => doc }
        db.transactions.push(doc)
        return doc
    })
}

const ledgerModel = {
    create: async (docs) => docs.map((data) => { db.ledger.push({ ...data }); return data })
}

const userModel = {
    findOne: (f) => query(() => db.users.find((u) => matches(u, f)) || null),
    findById: (id) => query(() => db.users.find((u) => u._id === String(id)) || null),
    // mirrors pin.service's atomic "reserve one attempt" update (synchronous, like MongoDB's single-document atomicity)
    findOneAndUpdate: (f, update) => query(() => {
        const u = db.users.find((x) => x._id === String(f._id))
        if (!u) return null
        const attempts = u.pinFailedAttempts || 0
        if (f.pinFailedAttempts && attempts >= f.pinFailedAttempts.$lt) return null
        if (u.pinLockedUntil && u.pinLockedUntil > new Date()) return null
        if (update.$inc) u.pinFailedAttempts = attempts + update.$inc.pinFailedAttempts
        return { ...u }
    }),
    updateOne: (f, update) => query(() => {
        const u = db.users.find((x) => x._id === String(f._id))
        if (!u) return { matchedCount: 0 }
        Object.assign(u, update.$set || {})
        for (const key of Object.keys(update.$unset || {})) delete u[key]
        return { matchedCount: 1 }
    }),
    create: async (data) => {
        const doc = {
            _id: newId(), createdAt: new Date(), ...data,
            comparePassword: async (pw) => { await new Promise((r) => setTimeout(r, 5)); return pw === data.password }
        }
        db.users.push(doc)
        return doc
    }
}

const blackListModel = {
    create: async (data) => {
        if (db.blacklist.some((b) => b.token === data.token)) throw Object.assign(new Error("dup"), { code: 11000 })
        db.blacklist.push(data)
    },
    findOne: (f) => query(() => db.blacklist.find((b) => b.token === f.token) || null)
}

// session.withTransaction: roll back ledger/transaction rows if the callback throws
let sessionFailure = null
const fakeMongoose = {
    Types: { ObjectId: function (id) { return String(id) } },
    startSession: async () => ({
        withTransaction: async (fn) => {
            if (sessionFailure) throw sessionFailure
            const counts = [db.transactions.length, db.ledger.length]
            try { await fn() } catch (err) {
                db.transactions.length = counts[0]
                db.ledger.length = counts[1]
                throw err
            }
        },
        endSession: async () => {}
    })
}

const emailCalls = []
const fakeEmail = {
    sendingRegistrationEmail: async (...a) => emailCalls.push(["register", ...a]),
    sendTransactionEmail: async (...a) => emailCalls.push(["transaction", ...a]),
    sendTransactionFailureEmail: async () => {}
}

const realLoad = Module._load
Module._load = function (request, ...rest) {
    if (request === "mongoose") return fakeMongoose
    if (request === "bcryptjs") return { hash: async (p) => "h:" + p, compare: async (p, h) => h === "h:" + p }
    if (request === "jsonwebtoken") return { sign: (p) => `token-${p.userId}`, verify: (t) => ({ userId: t.replace("token-", "") }) }
    if (request.endsWith("account.model")) return accountModel
    if (request.endsWith("transaction.model")) return transactionModel
    if (request.endsWith("ledger.model")) return ledgerModel
    if (request.endsWith("user.model")) return userModel
    if (request.endsWith("blackList.model")) return blackListModel
    if (request.endsWith("email.service")) return fakeEmail
    return realLoad.call(this, request, ...rest)
}

process.env.JWT_SECRET = "test-secret"
const auth = require("../src/controllers/auth.controller")
const tx = require("../src/controllers/transaction.controller")
const { authMiddleware } = require("../src/middleware/auth.middleware")

/* -------------------------------- helpers -------------------------------- */

const mkRes = () => {
    const res = { statusCode: 200, body: undefined, cookies: {}, cleared: [] }
    res.status = (c) => { res.statusCode = c; return res }
    res.json = (b) => { res.body = b; return res }
    res.cookie = (n, v, o) => { res.cookies[n] = { v, o }; return res }
    res.clearCookie = (n) => { res.cleared.push(n); return res }
    return res
}
const call = async (fn, req) => {
    const res = mkRes()
    try {
        await fn({ body: {}, query: {}, params: {}, cookies: {}, headers: {}, ...req }, res)
    } catch (err) {
        // same mapping as the central error handler in src/app.js
        if (err.name !== "HttpError") throw err
        res.status(err.status).json(err.code ? { message: err.message, code: err.code } : { message: err.message })
    }
    return res
}

async function world() {
    reset()
    const alice = await userModel.create({ email: "a@x.com", name: "Alice", password: "secret1", pinHash: "h:123456" })
    const bob = await userModel.create({ email: "b@x.com", name: "Bob", password: "secret2", pinHash: "h:123456" })
    const sys = await userModel.create({ email: "s@x.com", name: "System", password: "secret3", systemUser: true })
    const a1 = await accountModel.create({ user: alice._id })
    const b1 = await accountModel.create({ user: bob._id })
    const s1 = await accountModel.create({ user: sys._id })
    return { alice, bob, sys, a1, b1, s1 }
}
const fund = (w, to, amount, key) => call(tx.createInitialFundsTransaction, {
    user: w.sys, body: { toAccount: to._id, amount, idempotencyKey: key }
})
const PIN = "123456"
const send = (user, body) => call(tx.createTransaction, { user, body: { pin: PIN, ...body } })

/* ---------------------------------- auth --------------------------------- */

test("login: a WRONG password is rejected (password comparison is awaited)", async () => {
    await world()
    const res = await call(auth.userLoginController, { body: { email: "a@x.com", password: "wrong-password" } })
    assert.equal(res.statusCode, 401)
})

test("login: correct password succeeds and sets an httpOnly cookie", async () => {
    await world()
    const res = await call(auth.userLoginController, { body: { email: "A@x.com ", password: "secret1" } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.user.email, "a@x.com")
    assert.equal(res.cookies.token.o.httpOnly, true)
    assert.equal(res.body.user.password, undefined)
})

test("login/register: non-string input (NoSQL operator objects) is rejected", async () => {
    await world()
    assert.equal((await call(auth.userLoginController, { body: { email: { $ne: null }, password: "x" } })).statusCode, 400)
    assert.equal((await call(auth.userRegisterController, { body: { email: { $ne: null }, password: "secret1", name: "X" } })).statusCode, 400)
})

test("register: validates input, rejects duplicates, creates user", async () => {
    await world()
    const bad = (body) => call(auth.userRegisterController, { body })
    assert.equal((await bad({ email: "nope", password: "secret1", name: "X" })).statusCode, 400)
    assert.equal((await bad({ email: "n@x.com", password: "123", name: "X" })).statusCode, 400)
    assert.equal((await bad({ email: "n@x.com", password: "secret1", name: "  " })).statusCode, 400)
    assert.equal((await bad({ email: "a@x.com", password: "secret1", name: "Dup" })).statusCode, 422)
    const ok = await bad({ email: "N@x.com", password: "secret1", name: "New" })
    assert.equal(ok.statusCode, 201)
    assert.equal(ok.body.user.email, "n@x.com")
})

test("auth middleware: valid token for a deleted user is 401, not a crash", async () => {
    await world()
    const res = mkRes()
    let nextCalled = false
    await authMiddleware({ cookies: { token: "token-doesnotexist" }, headers: {} }, res, () => { nextCalled = true })
    assert.equal(res.statusCode, 401)
    assert.equal(nextCalled, false)
})

test("logout twice does not fail", async () => {
    await world()
    const req = { cookies: { token: "token-1" } }
    assert.equal((await call(auth.userLogoutController, req)).statusCode, 200)
    assert.equal((await call(auth.userLogoutController, req)).statusCode, 200)
})

/* -------------------------------- transfers ------------------------------- */

test("transfer: rejects invalid amounts", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    for (const amount of [0, -5, NaN, Infinity, "50", 1.234, null, undefined, 1e12]) {
        const res = await send(w.alice, { fromAccount: w.a1._id, toAccount: w.b1._id, amount, idempotencyKey: "k-" + String(amount) })
        assert.equal(res.statusCode, 400, `amount ${String(amount)} should be rejected`)
    }
    assert.equal(db.ledger.length, 2) // only the funding rows exist
})

test("transfer: sender account must belong to the logged-in user", async () => {
    const w = await world()
    await fund(w, w.b1, 500, "fund-b")
    const res = await send(w.alice, { fromAccount: w.b1._id, toAccount: w.a1._id, amount: 100, idempotencyKey: "steal-1" })
    assert.equal(res.statusCode, 403)
    assert.equal(balanceOf(w.b1._id), 500)
})

test("transfer: rejects malformed ids, same account, unknown recipient, inactive accounts", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    const base = { fromAccount: w.a1._id, toAccount: w.b1._id, amount: 10 }
    assert.equal((await send(w.alice, { ...base, toAccount: "abc", idempotencyKey: "1" })).statusCode, 400)
    assert.equal((await send(w.alice, { ...base, toAccount: w.a1._id, idempotencyKey: "2" })).statusCode, 400)
    assert.equal((await send(w.alice, { ...base, toAccount: "f".repeat(24), idempotencyKey: "3" })).statusCode, 404)
    assert.equal((await send(w.alice, { ...base, idempotencyKey: "" })).statusCode, 400)
    w.b1.status = "FROZEN"
    assert.equal((await send(w.alice, { ...base, idempotencyKey: "4" })).statusCode, 400)
    w.b1.status = "ACTIVE"; w.a1.status = "CLOSED"
    assert.equal((await send(w.alice, { ...base, idempotencyKey: "5" })).statusCode, 400)
})

test("transfer: insufficient funds is refused and writes nothing", async () => {
    const w = await world()
    await fund(w, w.a1, 100, "fund-1")
    const before = [db.transactions.length, db.ledger.length]
    const res = await send(w.alice, { fromAccount: w.a1._id, toAccount: w.b1._id, amount: 100.01, idempotencyKey: "big" })
    assert.equal(res.statusCode, 400)
    assert.deepEqual([db.transactions.length, db.ledger.length], before)
})

test("transfer: success moves money with a DEBIT and a CREDIT entry", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    const res = await send(w.alice, { fromAccount: w.a1._id, toAccount: w.b1._id, amount: 250.5, idempotencyKey: "pay-1" })
    assert.equal(res.statusCode, 201)
    assert.equal(res.body.transaction.status, "COMPLETED")
    assert.equal(res.body.transaction.idempotencyKey, undefined)
    assert.equal(balanceOf(w.a1._id), 749.5)
    assert.equal(balanceOf(w.b1._id), 250.5)
    assert.equal(emailCalls.at(-1)[0], "transaction")
})

test("transfer: idempotency - replay is not processed twice; reuse for another request/user is refused", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    const body = { fromAccount: w.a1._id, toAccount: w.b1._id, amount: 100, idempotencyKey: "same-key" }
    assert.equal((await send(w.alice, body)).statusCode, 201)
    const replay = await send(w.alice, body)
    assert.equal(replay.statusCode, 200)
    assert.equal(balanceOf(w.a1._id), 900)                       // charged once
    assert.equal((await send(w.alice, { ...body, amount: 5 })).statusCode, 409)
    const other = await send(w.bob, { fromAccount: w.b1._id, toAccount: w.a1._id, amount: 1, idempotencyKey: "same-key" })
    assert.equal(other.statusCode, 409)
    assert.equal(other.body.transaction, undefined)              // nothing about alice's transaction leaks
})

test("transfer: a database without transaction support gives a clear 503", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    sessionFailure = Object.assign(new Error("Transaction numbers are only allowed on a replica set member or mongos"), { code: 20 })
    try {
        const res = await send(w.alice, { fromAccount: w.a1._id, toAccount: w.b1._id, amount: 10, idempotencyKey: "x" })
        assert.equal(res.statusCode, 503)
    } finally { sessionFailure = null }
})

test("initial funds: validates amount and target, requires system account", async () => {
    const w = await world()
    assert.equal((await fund(w, w.a1, -1, "f1")).statusCode, 400)
    assert.equal((await fund(w, { _id: "nothex" }, 10, "f2")).statusCode, 400)
    assert.equal((await fund(w, { _id: "e".repeat(24) }, 10, "f3")).statusCode, 400)
    assert.equal((await fund(w, w.a1, 10, "f4")).statusCode, 201)
    assert.equal((await fund(w, w.a1, 10, "f4")).statusCode, 200) // replay
    assert.equal(balanceOf(w.a1._id), 10)
})

/* ---------------------------- history + details --------------------------- */

test("history lists only my transactions; details are 404 for other users' records", async () => {
    const w = await world()
    const carol = await userModel.create({ email: "c@x.com", name: "Carol", password: "secret4" })
    const c1 = await accountModel.create({ user: carol._id })
    await fund(w, w.a1, 1000, "fund-a")
    await fund(w, c1, 300, "fund-c")
    const sent = await send(w.alice, { fromAccount: w.a1._id, toAccount: w.b1._id, amount: 40, idempotencyKey: "p1" })

    const mine = await call(tx.listTransactions, { user: w.alice })
    assert.equal(mine.statusCode, 200)
    assert.equal(mine.body.transactions.length, 2)               // funding + payment, NOT carol's funding
    assert.ok(mine.body.transactions.every((t) => t.fromAccount.owned || t.toAccount.owned))
    const debit = mine.body.transactions.find((t) => t.amount === 40)
    assert.equal(debit.direction, "DEBIT")
    assert.equal(debit.toAccount.name, "Bob")
    assert.equal(debit.idempotencyKey, undefined)

    const own = await call(tx.getTransaction, { user: w.alice, params: { id: sent.body.transaction._id } })
    assert.equal(own.statusCode, 200)

    const carolFunding = db.transactions.find((t) => t.idempotencyKey === "fund-c")
    const peek = await call(tx.getTransaction, { user: w.alice, params: { id: carolFunding._id } })
    assert.equal(peek.statusCode, 404)
    const missing = await call(tx.getTransaction, { user: w.alice, params: { id: "a".repeat(24) } })
    assert.equal(missing.statusCode, 404)
    assert.deepEqual(peek.body, missing.body)                    // same answer as "does not exist"
    assert.equal((await call(tx.getTransaction, { user: w.alice, params: { id: "not-an-id" } })).statusCode, 404)
})

test("history: bad filters are rejected, foreign accountId is 404", async () => {
    const w = await world()
    assert.equal((await call(tx.listTransactions, { user: w.alice, query: { status: "NOPE" } })).statusCode, 400)
    assert.equal((await call(tx.listTransactions, { user: w.alice, query: { type: "sideways" } })).statusCode, 400)
    assert.equal((await call(tx.listTransactions, { user: w.alice, query: { accountId: w.b1._id } })).statusCode, 404)
})


/* ------------------------------ transaction PIN ---------------------------- */

const pay = (w, extra = {}) => call(tx.createTransaction, {
    user: w.alice,
    body: { pin: PIN, fromAccount: w.a1._id, toAccount: w.b1._id, amount: 10, idempotencyKey: "k" + Math.random(), ...extra }
})

test("PIN: transfer without a (valid) PIN is refused and moves nothing", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    const rows = db.ledger.length
    for (const pin of [undefined, "", "12345", "1234567", "abcdef", 123456, { $ne: null }]) {
        const res = await pay(w, { pin })
        assert.equal(res.statusCode, 400, `pin ${JSON.stringify(pin)} should be rejected`)
        assert.equal(res.body.code, "PIN_REQUIRED")
    }
    assert.equal(db.ledger.length, rows)
})

test("PIN: wrong PIN is refused, shows attempts left, and does not consume the idempotency key", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    const bad = await pay(w, { pin: "000000", idempotencyKey: "retry-me" })
    assert.equal(bad.statusCode, 403)
    assert.equal(bad.body.code, "PIN_INVALID")
    assert.match(bad.body.message, /4 attempts left/)
    assert.equal(balanceOf(w.a1._id), 1000)
    assert.equal(db.transactions.filter((t) => t.idempotencyKey === "retry-me").length, 0)
    const ok = await pay(w, { pin: PIN, idempotencyKey: "retry-me" })   // same key, right PIN
    assert.equal(ok.statusCode, 201)
})

test("PIN: a correct PIN resets the failed-attempt counter", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    for (let i = 0; i < 3; i++) await pay(w, { pin: "000000" })
    assert.equal((await pay(w)).statusCode, 201)
    const after = await pay(w, { pin: "000000" })
    assert.match(after.body.message, /4 attempts left/)                 // back to a full set of attempts
})

test("PIN: 5 wrong attempts lock the PIN, even the correct PIN is refused until the lock expires", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    let last
    for (let i = 0; i < 5; i++) last = await pay(w, { pin: "000000" })
    assert.equal(last.statusCode, 423)
    assert.equal(last.body.code, "PIN_LOCKED")
    const locked = await pay(w)                                          // correct PIN while locked
    assert.equal(locked.statusCode, 423)
    assert.equal(balanceOf(w.a1._id), 1000)
    db.users.find((u) => u._id === w.alice._id).pinLockedUntil = new Date(Date.now() - 1000) // lock expires
    assert.equal((await pay(w)).statusCode, 201)
})

test("PIN: parallel guesses can not get more than 5 tries (attempt is reserved before comparing)", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => pay(w, { pin: String(i).padStart(6, "0") })))
    const compared = results.filter((r) => r.body.code === "PIN_INVALID" || (r.body.code === "PIN_LOCKED" && /for 15 minutes/.test(r.body.message)))
    assert.ok(compared.length <= 5, `only 5 guesses may be evaluated, got ${compared.length}`)
    assert.ok(results.every((r) => r.statusCode !== 201))
    assert.equal(balanceOf(w.a1._id), 1000)
})

test("PIN: a user who never set a PIN gets PIN_NOT_SET", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    db.users.find((u) => u._id === w.alice._id).pinHash = undefined
    const res = await pay(w)
    assert.equal(res.statusCode, 403)
    assert.equal(res.body.code, "PIN_NOT_SET")
})

test("PIN: set requires the login password and a 6-digit PIN, only once, and stores a hash", async () => {
    const w = await world()
    db.users.find((u) => u._id === w.alice._id).pinHash = undefined
    const set = (body) => call(auth.setPinController, { user: w.alice, body })
    assert.equal((await set({ password: "secret1", pin: "12ab56" })).statusCode, 400)
    assert.equal((await set({ password: "secret1", pin: "123" })).statusCode, 400)
    assert.equal((await set({ password: "WRONG", pin: "246810" })).statusCode, 401)
    assert.equal((await set({ password: "secret1", pin: "246810" })).statusCode, 201)
    const stored = db.users.find((u) => u._id === w.alice._id).pinHash
    assert.ok(stored && stored !== "246810", "the PIN itself must never be stored")
    assert.equal((await set({ password: "secret1", pin: "135790" })).statusCode, 409)
})

test("PIN: change needs the current PIN; the old PIN stops working", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    const change = (body) => call(auth.changePinController, { user: w.alice, body })
    const wrong = await change({ currentPin: "000000", newPin: "654321" })
    assert.equal(wrong.statusCode, 403)
    assert.equal(wrong.body.code, "PIN_INVALID")
    assert.equal((await change({ currentPin: PIN, newPin: "12" })).statusCode, 400)
    assert.equal((await change({ currentPin: PIN, newPin: "654321" })).statusCode, 200)
    assert.equal((await pay(w, { pin: PIN })).statusCode, 403)           // old PIN
    assert.equal((await pay(w, { pin: "654321" })).statusCode, 201)      // new PIN
})

test("PIN: forgot-PIN reset needs the login password and also clears a lock", async () => {
    const w = await world()
    await fund(w, w.a1, 1000, "fund-1")
    for (let i = 0; i < 5; i++) await pay(w, { pin: "000000" })          // lock it
    assert.equal((await pay(w)).statusCode, 423)
    const reset = (body) => call(auth.resetPinController, { user: w.alice, body })
    assert.equal((await reset({ password: "nope", newPin: "111222" })).statusCode, 401)
    assert.equal((await reset({ password: "secret1", newPin: "11" })).statusCode, 400)
    assert.equal((await reset({ password: "secret1", newPin: "111222" })).statusCode, 200)
    assert.equal((await pay(w, { pin: "111222" })).statusCode, 201)
})

test("PIN: login and /me tell the frontend whether a PIN is set (never the hash)", async () => {
    const w = await world()
    const login = await call(auth.userLoginController, { body: { email: "a@x.com", password: "secret1" } })
    assert.equal(login.body.user.hasPin, true)
    assert.equal(login.body.user.pinHash, undefined)
    const me = await call(auth.getCurrentUserController, { user: w.alice })
    assert.equal(me.body.user.hasPin, true)
    const sysMe = await call(auth.getCurrentUserController, { user: w.sys })
    assert.equal(sysMe.body.user.hasPin, false)
    assert.equal(JSON.stringify(me.body).includes("h:123456"), false)
})
