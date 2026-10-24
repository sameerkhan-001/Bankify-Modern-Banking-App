const express = require("express");
const cookieParser = require('cookie-parser')


const app = express();

// CORS is only needed when the frontend is served from a different origin than
// the API (the Vite dev proxy makes requests same-origin, so it is optional).
// Set CLIENT_ORIGIN to a comma-separated list of allowed origins.
app.use((req, res, next) => {
    const allowed = (process.env.CLIENT_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean)
    const origin = req.headers.origin

    if (origin && allowed.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin)
        res.setHeader("Access-Control-Allow-Credentials", "true")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        res.setHeader("Vary", "Origin")
        if (req.method === "OPTIONS") {
            return res.sendStatus(204)
        }
    }
    next()
})

//middlewares
app.use(express.json());
app.use(cookieParser())



/**
 * - Required Routes
 */
const authRouter = require('./routes/auth.routes')
const accountRouter = require('./routes/account.routes')
const transactionRoutes = require('./routes/transaction.routes')
/**
 * - Use Routes
 */

app.get('/', (req, res)=> {
    res.send("Banking Service is up and running...")
})

app.use("/api/auth", authRouter) //"/api/auth" this is a prefix is isse start hone wale path ki req ko authRouter pe bhejdo
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRoutes)

// Unknown route -> JSON (instead of Express' default HTML page)
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" })
})

// Central error handler so every failure uses the same { message } shape.
// (Express 5 forwards rejected promises from async controllers here.)
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err)
    }

    // errors thrown on purpose by controllers/services (status + message + optional code)
    if (err.name === "HttpError") {
        return res.status(err.status).json(err.code ? { message: err.message, code: err.code } : { message: err.message })
    }

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON body" })
    }

    if (err.name === "ValidationError" && err.errors) {
        return res.status(400).json({
            message: Object.values(err.errors).map((e) => e.message).join(", ")
        })
    }

    if (err.name === "CastError") {
        return res.status(400).json({ message: "Invalid identifier" })
    }

    if (err.code === 11000) {
        return res.status(409).json({ message: "Duplicate value" })
    }

    console.error(err)
    return res.status(500).json({ message: "Internal server error" })
})

module.exports = app;
