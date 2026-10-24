const mongoose = require('mongoose');
const ledgerModel = require('./ledger.model')

//design account schema's structure
const accountSchema = new mongoose.Schema({
    user : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Account must be accociated with an user"],
        index: true
    },
    
    status: {
        type: String,
        enum: {
            values: ["ACTIVE", "FROZEN", "CLOSED"],
            message: "Status can be either ACTIVE, FROZEN or CLOSED",
            
        },
        default: "ACTIVE"
    },
    currency: {
        type: String,
        required: [true, "Currency is required for creating an account"],
        default: "INR"
    },

    // Bumped inside every transfer from this account. Because two concurrent
    // transfers then write the same document, MongoDB aborts one of them (write
    // conflict) and it is retried -> a balance can not be double-spent.
    transferSeq: {
        type: Number,
        default: 0,
        select: false
    }

}, {
    timestamps: true
})

//creating compound index
accountSchema.index({user: 1, status: 1})

// Pass the MongoDB `session` when calling inside a transaction so the read sees
// the same snapshot as the writes.
accountSchema.methods.getBalance = async function(session) {

    //aggregation pipeline
    const pipeline = ledgerModel.aggregate([
        { $match: {account : this._id} },
        {
            $group: {
                _id: null,
                totalDebit: {
                    $sum: {
                        $cond: [
                            { $eq : ["$type", "DEBIT"] },
                            "$amount",
                            0
                        ]
                    }
                },
                totalCredit: {
                    $sum: {
                        $cond: [
                            { $eq : ["$type", "CREDIT"] },
                            "$amount",
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                balance: { $subtract: [ "$totalCredit", "$totalDebit"] }
            }
        }
    ])

    if(session) {
        pipeline.session(session)
    }

    const balanceData = await pipeline

    //if account is new and acount's has no ledger entry(transaction entry)
    if(balanceData.length === 0) {
        return 0
    }

    // amounts are floats: round to paise to avoid 0.1 + 0.2 style drift
    return Math.round(balanceData[0].balance * 100) / 100
}

//create account model
const accountModel = mongoose.model("account", accountSchema);

module.exports = accountModel;