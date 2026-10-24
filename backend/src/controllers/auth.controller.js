const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const emailService = require('../services/email.service')
const tokenBlackListModel = require('../models/blackList.model')
const pinService = require('../services/pin.service')
const HttpError = require('../utils/httpError')

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const TOKEN_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000 // same as the JWT's 3d expiry

// httpOnly keeps the token away from frontend JS. For a frontend on a different
// site set COOKIE_SAMESITE=none (this also needs HTTPS / COOKIE_SECURE=true).
function cookieOptions() {
    const secure = process.env.COOKIE_SECURE
        ? process.env.COOKIE_SECURE === "true"
        : process.env.NODE_ENV === "production"

    return {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAMESITE || "lax",
        secure
    }
}

function signToken(user) {
    // Generate a JWT token with user ID and 3-day expiry.
    return jwt.sign({
        userId : user._id
    }, process.env.JWT_SECRET , { expiresIn : "3d"})
}

// hasPin tells the frontend whether a transaction PIN has been set (the hash itself never leaves the server)
function publicUser(user) {
    return {
        _id : user._id,
        email : user.email,
        name : user.name,
        createdAt : user.createdAt,
        hasPin : Boolean(user.pinHash)
    }
}

/**
 * User register Controller
 * POST API -> /api/auth/register
 */
async function userRegisterController(req, res) {
    const { email, password, name } = req.body || {}

    // Only accept plain strings (an object like {"$ne": null} must never reach a query)
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
        return res.status(400).json({ message: "Name is required (max 100 characters)" })
    }

    if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ message: "A valid email address is required" })
    }

    if (typeof password !== "string" || password.length < 6 || password.length > 128) {
        return res.status(400).json({ message: "Password must be between 6 and 128 characters" })
    }

    const normalizedEmail = email.trim().toLowerCase()

    //find email in database
    const isExists = await userModel.findOne({
        email : normalizedEmail,
    })

    //if email already exists instantly return from here
    if(isExists) {
        return res.status(422).json({
            message: "User already exists"
        })
    }

    //if email does not exist in db
    //Create new user account
    let user
    try {
        user = await userModel.create({
            email: normalizedEmail, password, name: name.trim()
        })
    } catch (err) {
        // two simultaneous registrations with the same email
        if (err.code === 11000) {
            return res.status(422).json({ message: "User already exists" })
        }
        throw err
    }

    const token = signToken(user)

    res.cookie("token", token, { ...cookieOptions(), maxAge: TOKEN_MAX_AGE_MS })

    res.status(201).json({
        user: publicUser(user),
        token
    })

    // fire-and-forget: a slow/failed mail server must not affect registration
    emailService.sendingRegistrationEmail(user.email, user.name).catch(() => {})
}

/**
 *
 * User Login Controller
 * POST API -> /api/auth/login
 */
async function userLoginController(req, res) {
    const {email, password} = req.body || {};

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
        return res.status(400).json({ message: "Email and password are required" })
    }

    //find email in db
    const user = await userModel.findOne({ email: email.trim().toLowerCase() }).select("+password +pinHash");

    if(!user) {
        return res.status(401).json({
            message: "Email or Password is INVALID"
        })
    }

    // comparePassword is async: without `await` this was always a truthy Promise,
    // which let ANY password log in.
    const isValidPassword = await user.comparePassword(password);

    if(!isValidPassword) {
        return res.status(401).json({
            message: "Email or Password is INVALID"
        })
    }

    const token = signToken(user)

    res.cookie("token", token, { ...cookieOptions(), maxAge: TOKEN_MAX_AGE_MS })

    res.status(200).json({
        user: publicUser(user),
        token
    })


}

/**
 * Current user (session restore)
 * GET API -> /api/auth/me
 */
async function getCurrentUserController(req, res) {
    // req.user was loaded without the select:false fields, so ask for the PIN hash to compute hasPin
    const user = await userModel.findById(req.user._id).select("+pinHash")

    return res.status(200).json({
        user: publicUser(user || req.user)
    })
}

/**
 * Transaction PIN endpoints (all protected by authMiddleware)
 *   POST /api/auth/pin        { password, pin }                 set the PIN for the first time
 *   PUT  /api/auth/pin        { currentPin, newPin }            change it (needs the old PIN)
 *   POST /api/auth/pin/reset  { password, newPin }              forgot PIN: prove identity with the login password
 */
const PIN_FORMAT_MESSAGE = "PIN must be exactly 6 digits"

async function userWithSecrets(userId) {
    return userModel.findById(userId).select("+password +pinHash")
}

async function setPinController(req, res) {
    const { password, pin } = req.body || {}

    if (!pinService.isValidPin(pin)) {
        throw new HttpError(400, PIN_FORMAT_MESSAGE)
    }
    if (typeof password !== "string" || !password) {
        throw new HttpError(400, "Password is required")
    }

    const user = await userWithSecrets(req.user._id)

    if (user.pinHash) {
        throw new HttpError(409, "A PIN is already set. Use change PIN or forgot PIN instead")
    }
    if (!(await user.comparePassword(password))) {
        throw new HttpError(401, "Password is incorrect")
    }

    await pinService.savePin(user._id, pin)
    return res.status(201).json({ message: "Transaction PIN set successfully" })
}

async function changePinController(req, res) {
    const { currentPin, newPin } = req.body || {}

    if (!pinService.isValidPin(newPin)) {
        throw new HttpError(400, PIN_FORMAT_MESSAGE)
    }

    // counts as an attempt, so the current PIN can not be brute-forced through this route either
    await pinService.verifyPin(req.user._id, currentPin)

    await pinService.savePin(req.user._id, newPin)
    return res.status(200).json({ message: "Transaction PIN changed successfully" })
}

async function resetPinController(req, res) {
    const { password, newPin } = req.body || {}

    if (!pinService.isValidPin(newPin)) {
        throw new HttpError(400, PIN_FORMAT_MESSAGE)
    }
    if (typeof password !== "string" || !password) {
        throw new HttpError(400, "Password is required")
    }

    const user = await userWithSecrets(req.user._id)

    if (!(await user.comparePassword(password))) {
        throw new HttpError(401, "Password is incorrect")
    }

    await pinService.savePin(user._id, newPin)
    return res.status(200).json({ message: "Transaction PIN reset successfully" })
}

/**
 * User Logout controller
 * POST API -> /api/auth/logout
 */

async function userLogoutController(req, res) {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]

    //if token is not exist it means(user is already logout)
    if(!token) {
        return res.status(200).json({
            message: "User is already logout"
        })
    }

    res.clearCookie("token", cookieOptions());    //clear cookie delete(token)

    //blacklist curr token (ignore "already blacklisted" so double-logout is harmless)
    try {
        await tokenBlackListModel.create({
            token : token
        })
    } catch (err) {
        if (err.code !== 11000) {
            throw err
        }
    }

    return res.status(200).json({
        message: "User logout successfully"
    })
}

module.exports = {
    userRegisterController, userLoginController, userLogoutController, getCurrentUserController,
    setPinController, changePinController, resetPinController
}
