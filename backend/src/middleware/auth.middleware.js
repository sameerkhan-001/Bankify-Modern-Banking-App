const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const tokenBlackListModel = require('../models/blackList.model')

async function authMiddleware(req, res, next) {
    //get token either from cookies or headers
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[ 1 ]

    //if token does not exist means user may not login or register
    if(!token) {
        return res.status(401).json({
            message: "Unauthorized access token is missing"
        })
    }

    //find blacklisted token in blackListed db
    const isBlacklisted = await tokenBlackListModel.findOne({
        token
    })

    //if we get a blacklisted token
    if(isBlacklisted) {
        return res.status(401).json({
            message: "Unauthorized access, Token is invalid"
        })
    }

    try{

        //verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModel.findById(decoded.userId);  //find user in db

        // token is valid but the user no longer exists
        if(!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found"
            })
        }

        req.user = user;    //store user in req.user

        return next()   //move ahead

    }catch(err) {
        return res.status(401).json({
            message: "Unauthorized access token is missing"
        })
    }
}

async function authSystemUserMiddleware(req, res, next) {

    //store token from cookies or headers
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]

    //if token is not exists means Unauthorized access
    if(!token) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }

    //find blacklisted token in blackListed db
    const isBlacklisted = await tokenBlackListModel.findOne({
        token
    })

    //if we get a blacklisted token
    if(isBlacklisted) {
        return res.status(401).json({
            message: "Unauthorized access, Token is invalid"
        })
    }

    try {

        //if token exits, verify with jwt
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const user = await userModel.findById(decoded.userId).select("+systemUser")

        if(!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found"
            })
        }

        //if user is not a system user return Forbidden
        if(!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden access, not a system user"
            })
        }

        req.user = user

        return next();

    }catch(err) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }
}

module.exports = { authMiddleware, authSystemUserMiddleware }
