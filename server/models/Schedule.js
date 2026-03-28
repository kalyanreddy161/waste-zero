const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  wasteType: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number] // [lat, lon]
    }
  },
  address: {
    city: String,
    village: String,
    street: String
  },
  pickupDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["scheduled", "accepted", "completed"],
    default: "scheduled"
  },
  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  agent: {
    name: String,
    phone: String
  },
  co2Saved: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

scheduleSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Schedule", scheduleSchema);
