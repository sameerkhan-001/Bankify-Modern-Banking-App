# 🏦 Bankify — Full-Stack Banking Application

Bankify is a full-stack banking application built with the MERN stack that enables users to manage multiple bank accounts, transfer money securely, and track transactions through a ledger-based accounting system.

## ✨ Features

- **Authentication:** JWT authentication, HTTP-only cookies, password hashing, and secure logout.
- **Account Management:** Create multiple accounts and view individual balances.
- **Secure Transfers:** PIN-protected transfers with balance validation and duplicate-request protection.
- **Transaction Management:** Paginated transaction history, filters, and transaction summaries.
- **Ledger-Based Accounting:** Double-entry debit and credit records with balances calculated from ledger entries.
- **Transaction Safety:** MongoDB transactions for atomic transfers and data consistency.
- **PIN Security:** Six-digit transaction PIN with automatic lockout after five incorrect attempts.
- **Email Notifications:** Transfer confirmation emails using Nodemailer.

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite 6, JavaScript, CSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB, Mongoose
- **Authentication:** JWT, HTTP-only Cookies, bcryptjs
- **Other Tools:** Nodemailer, Node.js Test Runner, Git, GitHub

## 🧠 Technical Highlights

- Implemented atomic money transfers using MongoDB multi-document transactions.
- Used idempotency keys and a unique database index to prevent duplicate transfer processing.
- Designed a double-entry ledger for traceable debit and credit records.
- Calculated account balances from ledger entries instead of storing a mutable balance.
- Implemented server-side account ownership checks and transaction PIN verification.
- Added 26 automated backend tests covering validation, authorization, idempotency, and error handling.

## 📱 Application Pages

Landing Page · Login · Register · Dashboard · Accounts · Money Transfer · Transaction History · Profile

## 📂 Project Structure

```text
bankify/
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── utils/
│   ├── scripts/
│   │   ├── seed.js
│   │   └── fund.js
│   ├── test/
│   │   └── controllers.test.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── router.jsx
│   │   └── main.jsx
│   └── package.json
│
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

- Node.js 20+
- npm
- MongoDB replica set (required for multi-document transactions)

### 1. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file using `.env.example` and configure the required environment variables, including `MONGO_URI` and `JWT_SECRET`.

Initialize demo data and start the server:

```bash
npm run seed
npm start
```

Backend: `http://localhost:3000`

### 2. Setup Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite.

### 3. Run Tests

From the backend directory:

```bash
npm test
```

---

### ✨ Turning Ideas into Impact.

*Built with passion, driven by curiosity, and inspired by the art of engineering.*
