const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["volunteer", "ngo", "admin"],
      required: true
    },

    skills: {
      type: [String],
      default: []
    },

    // ✅ location is OPTIONAL and VALID only when coordinates exist
    location: {
      type: {
        type: String,
        enum: ["Point"]
      },
      coordinates: {
        type: [Number]
      }
    },

    bio: {
      type: String,
      maxlength: 500
    },

    isProfileCompleted: {
      type: Boolean,
      default: false
    },
    otp: Number,
    otpExpiresAt: Date
  },
  { timestamps: true }
);

/* ✅ Create geo index ONLY if location exists */
userSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("User", userSchema);
