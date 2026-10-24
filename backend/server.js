require("dotenv").config()
const app = require("./src/app");
const connectToDb = require("./src/config/db");

// Fail fast with a clear message instead of crashing later inside a request.
const missing = ["MONGO_URI", "JWT_SECRET"].filter((key) => !process.env[key]);
if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")} (see .env.example)`);
    process.exit(1);
}

const PORT = process.env.PORT || 3000;

connectToDb();

app.listen(PORT, ()=> {
    console.log(`Server is running on port number ${PORT}`)
})
