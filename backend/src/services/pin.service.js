const bcrypt = require("bcryptjs")
const userModel = require("../models/user.model")
const HttpError = require("../utils/httpError")

/**
 * Transaction PIN logic (6 digits, bcrypt-hashed, brute-force protected).
 *
 * Why the attempt counter is bumped BEFORE the PIN is compared:
 * if we compared first and counted afterwards, an attacker could fire many
 * requests in parallel, they would all pass the "not locked yet" check and every
 * one of them would get a free guess. Here each request must first RESERVE an
 * attempt with one atomic findOneAndUpdate (only succeeds while attempts < MAX
 * and the account is not locked), so at most MAX guesses can ever be in flight.
 */

const PIN_REGEX = /^\d{6}$/
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

const isValidPin = (pin) => typeof pin === "string" && PIN_REGEX.test(pin)

function hashPin(pin) {
    return bcrypt.hash(pin, 10)
}

function minutesLeft(lockedUntil) {
    return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000))
}

/**
 * Checks `pin` for `userId`. Resolves when it is correct, otherwise throws an
 * HttpError whose `code` tells the frontend what happened:
 *   PIN_NOT_SET (403) | PIN_INVALID (403) | PIN_LOCKED (423)
 */
async function verifyPin(userId, pin) {
    if (!isValidPin(pin)) {
        throw new HttpError(400, "Enter your 6-digit transaction PIN", "PIN_REQUIRED")
    }

    const now = new Date()

    // Reserve one attempt atomically. Returns null when locked / out of attempts.
    const user = await userModel.findOneAndUpdate(
        {
            _id: userId,
            pinFailedAttempts: { $lt: MAX_ATTEMPTS },
            $or: [{ pinLockedUntil: null }, { pinLockedUntil: { $lte: now } }]
        },
        { $inc: { pinFailedAttempts: 1 } },
        { returnDocument: "after" }
    ).select("+pinHash +pinFailedAttempts +pinLockedUntil")

    if (!user) {
        // either the user does not exist, or the PIN is locked / attempts used up
        const current = await userModel.findById(userId).select("+pinLockedUntil")
        const until = current && current.pinLockedUntil

        if (until && until > now) {
            throw new HttpError(423, `Too many wrong attempts. PIN is locked, try again in ${minutesLeft(until)} minute(s)`, "PIN_LOCKED")
        }
        throw new HttpError(423, "Too many wrong attempts. Please wait a moment and try again", "PIN_LOCKED")
    }

    if (!user.pinHash) {
        // nothing to guess: give the attempt back and tell the user to set a PIN
        await userModel.updateOne({ _id: userId }, { $set: { pinFailedAttempts: 0 } })
        throw new HttpError(403, "Set a transaction PIN before sending money", "PIN_NOT_SET")
    }

    const correct = await bcrypt.compare(pin, user.pinHash)

    if (correct) {
        await userModel.updateOne({ _id: userId }, { $set: { pinFailedAttempts: 0 }, $unset: { pinLockedUntil: 1 } })
        return
    }

    if (user.pinFailedAttempts >= MAX_ATTEMPTS) {
        // that was the last allowed attempt: lock and reset the counter
        const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000)
        await userModel.updateOne({ _id: userId }, { $set: { pinLockedUntil: lockedUntil, pinFailedAttempts: 0 } })
        throw new HttpError(423, `Too many wrong attempts. PIN is locked for ${LOCK_MINUTES} minutes`, "PIN_LOCKED")
    }

    const left = MAX_ATTEMPTS - user.pinFailedAttempts
    throw new HttpError(403, `Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} left`, "PIN_INVALID")
}

/** Stores a new PIN and clears any lock / failed attempts. */
async function savePin(userId, pin) {
    const pinHash = await hashPin(pin)
    await userModel.updateOne(
        { _id: userId },
        { $set: { pinHash, pinFailedAttempts: 0 }, $unset: { pinLockedUntil: 1 } }
    )
}

module.exports = { verifyPin, savePin, isValidPin, MAX_ATTEMPTS, LOCK_MINUTES }
