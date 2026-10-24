const accountModel = require('../models/account.model')

//it used to create a new account
async function createAccountController(req, res) {
    const user = req.user;

    const account = await accountModel.create({
        user: user._id
    })

    res.status(201).json({
        account
    })
}

//fetch all accounts of curr user
async function getUserAccountsController(req, res) {
    const accounts = await accountModel.find({
        user : req.user._id
    })

    return res.status(200).json({
        accounts
    })
}

//Fetch All balance from the user's account
async function getAccountBalanceController(req, res) {
    const {accountId} = req.params;

    const account = await accountModel.findOne({
        _id : accountId,
        user : req.user._id
    })

    if(!account) {
        return res.status(404).json({
            message: "Account not found"
        })
    }

        //get balance function written in account's model file
    const balance = await account.getBalance();

    res.status(200).json({
        accountId: account._id,
        balance: balance
    })
}

module.exports = { createAccountController, getUserAccountsController, getAccountBalanceController }