const transactionModel = require('../models/transaction.model')
const ledgerModel = require('../models/ledger.model');
const accountModel = require('../models/account.model')
const emailService = require('../services/email.service')
const HttpError = require('../utils/httpError')
const pinService = require('../services/pin.service')
const mongoose = require('mongoose');

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/
const STATUSES = ["PENDING", "COMPLETED", "FAILED", "REVERSED"]
const MAX_AMOUNT = 1000000000

// { message, code? } body for an HttpError (code lets the frontend react to e.g. PIN_INVALID)
const errorBody = (err) => (err.code ? { message: err.message, code: err.code } : { message: err.message })

const isObjectId = (value) => typeof value === "string" && OBJECT_ID_REGEX.test(value)
const asString = (value) => (typeof value === "string" ? value : undefined)
const idOf = (value) => String(value && value._id ? value._id : value)
const sameId = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()

/**
 * Amount must be a finite JSON number, > 0, with at most 2 decimals.
 * Returns an error message, or null when valid.
 */
function validateAmount(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
        return "Amount must be a valid number"
    }
    if (amount <= 0) {
        return "Amount must be greater than zero"
    }
    if (amount > MAX_AMOUNT) {
        return `Amount can not be more than ${MAX_AMOUNT}`
    }
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
        return "Amount can have at most 2 decimal places"
    }
    return null
}

function validateIdempotencyKey(key) {
    if (typeof key !== "string" || !key.trim() || key.length > 128) {
        return "idempotencyKey must be a non-empty string (max 128 characters)"
    }
    return null
}

// What the API returns for a transaction we just created / replayed.
function serializeTransaction(transaction) {
    return {
        _id: transaction._id,
        fromAccount: transaction.fromAccount,
        toAccount: transaction.toAccount,
        amount: transaction.amount,
        status: transaction.status,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
    }
}

// MongoDB refuses transactions on a standalone server (IllegalOperation, code 20).
function isTransactionUnsupported(err) {
    return Boolean(err) && (err.code === 20 || /replica set member or mongos/i.test(err.message || ""))
}

/**
 * Idempotency: if this key was already used, either replay the stored result or
 * refuse when it was used for a different request / by a different user (so one
 * user can never read another user's transaction through a reused key).
 */
async function findExistingTransaction({ idempotencyKey, userId, fromAccount, toAccount, amount }) {
    const existing = await transactionModel.findOne({ idempotencyKey })

    if (!existing) {
        return null
    }

    const ownsSender = await accountModel.exists({ _id: existing.fromAccount, user: userId })

    const sameRequest = ownsSender
        && sameId(existing.fromAccount, fromAccount)
        && sameId(existing.toAccount, toAccount)
        && existing.amount === amount

    if (!sameRequest) {
        throw new HttpError(409, "Idempotency key has already been used for a different request")
    }

    return existing
}

function respondWithExisting(res, existing) {
    if (existing.status === "COMPLETED") {
        return res.status(200).json({
            message: "Transaction already processed",
            transaction: serializeTransaction(existing)
        })
    }

    if (existing.status === "PENDING") {
        return res.status(202).json({
            message: "Transaction is still processing",
            transaction: serializeTransaction(existing)
        })
    }

    // FAILED / REVERSED: the key is spent, the client must retry with a new one
    return res.status(409).json({
        message: `Transaction was ${existing.status.toLowerCase()}, please retry with a new idempotencyKey`
    })
}

/**
 * Moves money atomically inside one MongoDB transaction:
 *  - the sender account document is written first (transferSeq bump) which also
 *    re-checks ownership + ACTIVE status and serialises concurrent transfers
 *    from the same account, so the balance check below can not be raced;
 *  - the balance is derived from the ledger inside the same session;
 *  - transaction + DEBIT + CREDIT entries are created and the transaction marked
 *    COMPLETED; everything commits together or rolls back together.
 * `withTransaction` retries transient conflicts and aborts on any error; the
 * session is always ended in `finally`.
 */
async function runTransfer({ fromAccountId, toAccountId, amount, idempotencyKey, ownerUserId, enforceBalance }) {
    const session = await mongoose.startSession()
    let transaction

    try {
        await session.withTransaction(async () => {

            const sender = await accountModel.findOneAndUpdate(
                { _id: fromAccountId, user: ownerUserId, status: "ACTIVE" },
                { $inc: { transferSeq: 1 } },
                { session, returnDocument: "after" }
            )

            if (!sender) {
                throw new HttpError(409, "Sender account is not available for transfers")
            }

            const recipient = await accountModel.findOne({ _id: toAccountId, status: "ACTIVE" }).session(session)

            if (!recipient) {
                throw new HttpError(409, "Recipient account is not available for transfers")
            }

            if (enforceBalance) {
                const balance = await sender.getBalance(session)

                if (balance < amount) {
                    throw new HttpError(400, `Insufficient balance. Current balance is ${balance}, requested amount is ${amount}`)
                }
            }

            const [created] = await transactionModel.create([{
                fromAccount: fromAccountId,
                toAccount: toAccountId,
                amount,
                idempotencyKey,
                status: "PENDING"
            }], { session })

            await ledgerModel.create([
                { account: fromAccountId, amount, transaction: created._id, type: "DEBIT" },
                { account: toAccountId, amount, transaction: created._id, type: "CREDIT" }
            ], { session, ordered: true })

            created.status = "COMPLETED"
            await created.save({ session })

            transaction = created
        })
    } finally {
        await session.endSession()
    }

    return transaction
}

// Turns errors from the transfer flow into responses. Unknown errors are
// rethrown to the central error handler (500).
async function respondWithTransferError(err, res, replayArgs) {
    if (err instanceof HttpError) {
        return res.status(err.status).json(errorBody(err))
    }

    // Two requests with the same idempotencyKey raced: the unique index let one win.
    if (err && err.code === 11000) {
        try {
            const existing = await findExistingTransaction(replayArgs)
            if (existing) {
                return respondWithExisting(res, existing)
            }
        } catch (replayErr) {
            if (replayErr instanceof HttpError) {
                return res.status(replayErr.status).json(errorBody(replayErr))
            }
            throw replayErr
        }
        return res.status(409).json({ message: "Duplicate transaction" })
    }

    if (isTransactionUnsupported(err)) {
        return res.status(503).json({
            message: "Transfers are unavailable: the database does not support transactions (MongoDB must run as a replica set)"
        })
    }

    throw err
}

/**
 * * - Create a new Transaction:-
 * THE 10-STEPS TRANSFER RULE:
    * 1. Validate request (+ verify the transaction PIN)
    * 2. validate idempotency key
    * 3. Check account ownership + status
    * 4. Derive sender balance from ledger
    * 5. Create transaction (PENDING)
    * 6. Create DEBIT ledger entry
    * 7. Create CREDIT ledger entry
    * 8. Mark transaction COMPLETED
    * 9. COMMIT MongoDB session
    * 10. Send email notification
 */

async function createTransaction(req, res) {

    /**
     * 1. Validate request
     */

    const { fromAccount, toAccount, amount, idempotencyKey } = req.body || {};

    if (!isObjectId(fromAccount) || !isObjectId(toAccount)) {
        return res.status(400).json({
            message: "fromAccount and toAccount must be valid account IDs"
        })
    }

    const keyError = validateIdempotencyKey(idempotencyKey)
    if (keyError) {
        return res.status(400).json({ message: keyError })
    }

    const amountError = validateAmount(amount)
    if (amountError) {
        return res.status(400).json({ message: amountError })
    }

    if (sameId(fromAccount, toAccount)) {
        return res.status(400).json({
            message: "fromAccount and toAccount must be different accounts"
        })
    }

    const replayArgs = { idempotencyKey, userId: req.user._id, fromAccount, toAccount, amount }

    try {
        /**
         * 1b. Verify the transaction PIN (before anything else is read or written, so a
         * stolen login session alone can neither move money nor probe idempotency keys)
         */
        await pinService.verifyPin(req.user._id, req.body.pin)

        /**
         * 2. validate idempotency key
         */
        const existing = await findExistingTransaction(replayArgs)

        if (existing) {
            return respondWithExisting(res, existing)
        }

        /**
         * 3. Check account ownership + status
         * (the sender must belong to the logged-in user)
         */
        const fromUserAccount = await accountModel.findOne({ _id: fromAccount, user: req.user._id })

        if (!fromUserAccount) {
            throw new HttpError(403, "Sender account was not found or does not belong to you")
        }

        const toUserAccount = await accountModel.findOne({ _id: toAccount })

        if (!toUserAccount) {
            throw new HttpError(404, "Recipient account not found")
        }

        if (fromUserAccount.status !== "ACTIVE") {
            throw new HttpError(400, "Sender account must be ACTIVE to send money")
        }

        if (toUserAccount.status !== "ACTIVE") {
            throw new HttpError(400, "Recipient account must be ACTIVE to receive money")
        }

        if (fromUserAccount.currency !== toUserAccount.currency) {
            throw new HttpError(400, "Transfers between different currencies are not supported")
        }

        /**
         * 4-9. balance check + ledger writes + commit (all inside one DB transaction)
         */
        const transaction = await runTransfer({
            fromAccountId: fromUserAccount._id,
            toAccountId: toUserAccount._id,
            amount,
            idempotencyKey,
            ownerUserId: req.user._id,
            enforceBalance: true
        })

        /**
         * 10. Send email notification (best effort, never blocks or fails the transfer)
         */
        emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount).catch(() => {})

        return res.status(201).json({
            message: "Transaction completed successfully",
            transaction: serializeTransaction(transaction)
        })

    } catch (err) {
        return respondWithTransferError(err, res, replayArgs)
    }
}

async function createInitialFundsTransaction(req, res) {

    const { toAccount, amount, idempotencyKey } = req.body || {};

    if (!isObjectId(toAccount)) {
        return res.status(400).json({ message: "toAccount must be a valid account ID" })
    }

    const keyError = validateIdempotencyKey(idempotencyKey)
    if (keyError) {
        return res.status(400).json({ message: keyError })
    }

    const amountError = validateAmount(amount)
    if (amountError) {
        return res.status(400).json({ message: amountError })
    }

    let replayArgs = { idempotencyKey, userId: req.user._id, toAccount, amount }

    try {
        //find sender (System's) account in db
        const fromUserAccount = await accountModel.findOne({
            user : req.user._id,
            status: "ACTIVE"
        }).sort({ createdAt: 1 })

        if (!fromUserAccount) {
            throw new HttpError(400, "System user account not found")
        }

        replayArgs = { ...replayArgs, fromAccount: String(fromUserAccount._id) }

        const existing = await findExistingTransaction(replayArgs)

        if (existing) {
            return respondWithExisting(res, existing)
        }

        //find receiver acount's in db
        const toUserAccount = await accountModel.findOne({ _id: toAccount })

        if (!toUserAccount) {
            throw new HttpError(400, "Invalid toAccount")
        }

        if (toUserAccount.status !== "ACTIVE") {
            throw new HttpError(400, "toAccount must be ACTIVE to receive funds")
        }

        if (sameId(toUserAccount._id, fromUserAccount._id)) {
            throw new HttpError(400, "Can not fund the system account from itself")
        }

        // The system account is the "mint": it is allowed to go negative.
        const transaction = await runTransfer({
            fromAccountId: fromUserAccount._id,
            toAccountId: toUserAccount._id,
            amount,
            idempotencyKey,
            ownerUserId: req.user._id,
            enforceBalance: false
        })

        return res.status(201).json({
            message: "Initial funds transaction completed successfully",
            transaction: serializeTransaction(transaction)
        })

    } catch (err) {
        return respondWithTransferError(err, res, replayArgs)
    }
}

/* ------------------------------------------------------------------ */
/* Read endpoints (transaction history + details)                      */
/* ------------------------------------------------------------------ */

const populateParties = {
    path: "fromAccount toAccount",
    select: "user",
    populate: { path: "user", select: "name" }
}

/**
 * Shapes a (populated, lean) transaction for the logged-in user.
 * direction: DEBIT  = money left one of my accounts
 *            CREDIT = money arrived in one of my accounts
 *            INTERNAL = between two of my own accounts
 * Only the counterparty's display name is exposed (never email / user id).
 */
function shapeTransaction(transaction, ownedIds) {
    const fromId = idOf(transaction.fromAccount)
    const toId = idOf(transaction.toAccount)
    const fromOwned = ownedIds.has(fromId)
    const toOwned = ownedIds.has(toId)

    const party = (account, id, owned) => ({
        _id: id,
        name: account && account.user && account.user.name ? account.user.name : null,
        owned
    })

    return {
        _id: transaction._id,
        amount: transaction.amount,
        status: transaction.status,
        direction: fromOwned && toOwned ? "INTERNAL" : fromOwned ? "DEBIT" : "CREDIT",
        fromAccount: party(transaction.fromAccount, fromId, fromOwned),
        toAccount: party(transaction.toAccount, toId, toOwned),
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
    }
}

function parseIntInRange(value, fallback, min, max) {
    const parsed = parseInt(asString(value), 10)
    if (!Number.isInteger(parsed)) {
        return fallback
    }
    return Math.min(Math.max(parsed, min), max)
}

const round2 = (n) => Math.round((n || 0) * 100) / 100

/**
 * GET /api/transactions
 * Only transactions that involve an account owned by the logged-in user.
 * Query: page, limit (max 50), status, type=credit|debit, accountId, from, to,
 *        summary=true (adds completed credit/debit totals across ALL my history)
 */
async function listTransactions(req, res) {
    const ownedAccounts = await accountModel.find({ user: req.user._id }).select("_id").lean()
    const ownedIds = ownedAccounts.map((account) => account._id)
    const ownedSet = new Set(ownedIds.map(String))

    const page = parseIntInRange(req.query.page, 1, 1, 100000)
    const limit = parseIntInRange(req.query.limit, 10, 1, 50)

    const status = asString(req.query.status)
    const type = asString(req.query.type)
    const accountId = asString(req.query.accountId)
    const from = asString(req.query.from)
    const to = asString(req.query.to)

    if (status && !STATUSES.includes(status.toUpperCase())) {
        return res.status(400).json({ message: `status must be one of ${STATUSES.join(", ")}` })
    }

    if (type && !["credit", "debit"].includes(type.toLowerCase())) {
        return res.status(400).json({ message: "type must be credit or debit" })
    }

    let scopeIds = ownedIds

    if (accountId) {
        if (!isObjectId(accountId) || !ownedSet.has(accountId)) {
            return res.status(404).json({ message: "Account not found" })
        }
        scopeIds = [new mongoose.Types.ObjectId(accountId)]
    }

    const query = {}
    const typeFilter = type && type.toLowerCase()

    if (typeFilter === "credit") {
        query.toAccount = { $in: scopeIds }
    } else if (typeFilter === "debit") {
        query.fromAccount = { $in: scopeIds }
    } else {
        query.$or = [{ fromAccount: { $in: scopeIds } }, { toAccount: { $in: scopeIds } }]
    }

    if (status) {
        query.status = status.toUpperCase()
    }

    if (from || to) {
        query.createdAt = {}
        for (const [key, raw] of [["$gte", from], ["$lte", to]]) {
            if (!raw) continue
            const date = new Date(raw)
            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({ message: "from / to must be valid dates" })
            }
            query.createdAt[key] = date
        }
    }

    const [total, transactions] = await Promise.all([
        transactionModel.countDocuments(query),
        transactionModel.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate(populateParties)
            .lean()
    ])

    const response = {
        transactions: transactions.map((transaction) => shapeTransaction(transaction, ownedSet)),
        pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit))
        }
    }

    if (asString(req.query.summary) === "true") {
        // Completed money in / out across everything I own. Transfers between my
        // own accounts are excluded from both (they are not money in or out).
        const [totals] = ownedIds.length === 0 ? [] : await transactionModel.aggregate([
            { $match: { status: "COMPLETED", $or: [{ fromAccount: { $in: ownedIds } }, { toAccount: { $in: ownedIds } }] } },
            { $group: {
                _id: null,
                totalCredits: { $sum: { $cond: [{ $and: [{ $in: ["$toAccount", ownedIds] }, { $not: [{ $in: ["$fromAccount", ownedIds] }] }] }, "$amount", 0] } },
                totalDebits: { $sum: { $cond: [{ $and: [{ $in: ["$fromAccount", ownedIds] }, { $not: [{ $in: ["$toAccount", ownedIds] }] }] }, "$amount", 0] } }
            } }
        ])

        response.summary = {
            totalCredits: round2(totals && totals.totalCredits),
            totalDebits: round2(totals && totals.totalDebits)
        }
    }

    return res.status(200).json(response)
}

/**
 * GET /api/transactions/:id
 * 404 both for "does not exist" and "exists but is not yours", so another
 * user's records can not even be probed.
 */
async function getTransaction(req, res) {
    const notFound = () => res.status(404).json({ message: "Transaction not found" })

    if (!isObjectId(req.params.id)) {
        return notFound()
    }

    const transaction = await transactionModel.findById(req.params.id).populate(populateParties).lean()

    if (!transaction) {
        return notFound()
    }

    const mine = await accountModel.find({
        _id: { $in: [idOf(transaction.fromAccount), idOf(transaction.toAccount)] },
        user: req.user._id
    }).select("_id").lean()

    if (mine.length === 0) {
        return notFound()
    }

    return res.status(200).json({
        transaction: shapeTransaction(transaction, new Set(mine.map((account) => String(account._id))))
    })
}

module.exports = {
    createTransaction,
    createInitialFundsTransaction,
    listTransactions,
    getTransaction
}
