const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

//create User schema contains email, name, password
const userSchema = new mongoose.Schema({

    email: {
        type: String,
        required: [true, "Email is required for creating an user"],
        trim: true,
        lowercase: true,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid Email Address"],
        unique: [true, "Email already exists"]
    },
    name: {
        type: String,
        required: [true, "Name is required for creating an account"],
    },
    password: {
        type: String,
        required: [true, "Password is required for creating an account"],
        minlength: [6, "Password length must be more then 6 characters"],
        select: false
    },

    // Transaction PIN (6 digits). Only the bcrypt HASH is stored, never the PIN itself.
    // All three fields are select:false so they never leak into normal queries/responses.
    pinHash: {
        type: String,
        select: false
    },

    // wrong attempts since the last success / lock
    pinFailedAttempts: {
        type: Number,
        default: 0,
        select: false
    },

    // while this date is in the future the PIN can not be used
    pinLockedUntil: {
        type: Date,
        select: false
    },

    systemUser: {
        type: Boolean,
        default: false,
        immutable: true,
        select: false
    }
}, {
    timestamps: true
})

//pre is a middleware check password modified or not
userSchema.pre("save", async function () {
    if(!this.isModified("password")) {
        return;
    }

    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash

    return;
    
})

//compare existing password with user filled password
userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password)
}

const userModel = mongoose.model("user", userSchema);

module.exports = userModel