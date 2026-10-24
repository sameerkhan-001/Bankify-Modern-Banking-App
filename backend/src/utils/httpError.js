/**
 * Error carrying an HTTP status so controllers can `throw` from deep inside a
 * database transaction and still answer with a clean { message } response.
 * `code` is an optional machine-readable reason (e.g. PIN_INVALID) the frontend can switch on.
 */
class HttpError extends Error {
    constructor(status, message, code) {
        super(message)
        this.name = "HttpError"
        this.status = status
        this.code = code
    }
}

module.exports = HttpError
