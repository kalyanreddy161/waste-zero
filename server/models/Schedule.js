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
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  pickupDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    default: "scheduled"
  }
}, { timestamps: true });

module.exports = mongoose.model("Schedule", scheduleSchema);
