const mongoose = require('mongoose');

function connectToDB() {
    mongoose.connect(process.env.MONGO_URI)

    .then(async ()=> {
        console.log("Server is connected to DB")

        // Transfers use MongoDB multi-document transactions, which only work on a
        // replica set or sharded cluster (Atlas always qualifies; a plain local
        // `mongod` does not). Warn early instead of failing on the first transfer.
        try {
            const hello = await mongoose.connection.db.admin().command({ hello: 1 })
            const supportsTransactions = Boolean(hello.setName) || hello.msg === "isdbgrid"
            if (!supportsTransactions) {
                console.warn("WARNING: MongoDB is running standalone. Transfers will be rejected (HTTP 503) " +
                    "because transactions need a replica set. See README.md.")
            }
        } catch (err) {
            console.warn("Could not determine whether MongoDB supports transactions:", err.message)
        }
    })
    .catch(err=> {
        console.log("Error connecting to DB", err.message)
        process.exit(1)
    })
}

module.exports = connectToDB
