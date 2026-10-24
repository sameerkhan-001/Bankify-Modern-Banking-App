const express = require('express');
const authController = require("../controllers/auth.controller")
const authMiddleware = require("../middleware/auth.middleware")

const router = express.Router();

//POST API :-> PATH LOOK LIKE api/auth/register
router.post("/register", authController.userRegisterController);    //register api pe ane wali req pe authController call hota hai
router.post("/login", authController.userLoginController)

//POST /api/auth/logout

router.post("/logout", authController.userLogoutController)

/**
 * - GET /api/auth/me
 * - Returns the logged-in user (lets the frontend restore the session on page refresh)
 * - Protected Route
 */
router.get("/me", authMiddleware.authMiddleware, authController.getCurrentUserController)

/**
 * Transaction PIN (protected)
 * - POST /api/auth/pin        set it the first time
 * - PUT  /api/auth/pin        change it (needs the current PIN)
 * - POST /api/auth/pin/reset  forgot PIN (needs the login password)
 */
router.post("/pin", authMiddleware.authMiddleware, authController.setPinController)
router.put("/pin", authMiddleware.authMiddleware, authController.changePinController)
router.post("/pin/reset", authMiddleware.authMiddleware, authController.resetPinController)

module.exports = router
