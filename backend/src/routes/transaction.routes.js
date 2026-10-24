const { Router } = require('express');
const transactionController = require('../controllers/transaction.controller')
const authMiddleware = require('../middleware/auth.middleware')

const transactionRoutes = Router();

/**
 * - Post /api/transactions/
 * - Create a new transaction
 */

transactionRoutes.post('/', authMiddleware.authMiddleware, transactionController.createTransaction)

/**
 * - GET /api/transactions/
 * - List transactions involving the logged-in user's accounts (paginated, filterable)
 * - Query: page, limit, status, type=credit|debit, accountId, from, to, summary=true
 */

transactionRoutes.get('/', authMiddleware.authMiddleware, transactionController.listTransactions)

/**
 * - POST /api/transactions/system/initial-funds
 * - Create initial funds transaction from system user
 */

transactionRoutes.post('/system/initial-funds', authMiddleware.authSystemUserMiddleware, transactionController.createInitialFundsTransaction)

/**
 * - GET /api/transactions/:id
 * - One transaction, only if it involves an account owned by the logged-in user
 */

transactionRoutes.get('/:id', authMiddleware.authMiddleware, transactionController.getTransaction)

module.exports = transactionRoutes
