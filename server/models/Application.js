const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
    },
    volunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// prevent duplicate applications from same volunteer to same opportunity
applicationSchema.index({ opportunityId: 1, volunteerId: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);
