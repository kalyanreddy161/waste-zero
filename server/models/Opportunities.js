const mongoose = require("mongoose");

const opportunitySchema = new mongoose.Schema(
  {
    // NGO that created the opportunity (references User._id)
    ngo_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Opportunity title
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Detailed description of the opportunity
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Skills required for this opportunity
    required_skills: {
      type: [String],
      default: [],
    },

    // Time commitment or duration of the opportunity
    duration: {
      type: Number,
      required: true,
    },

    // Opportunity location as GeoJSON Point
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },

    // City name for the opportunity
    city: {
      type: String,
      trim: true,
    },

    // Optional image URL for the opportunity
    img_link: {
      type: String,
      required: false,
      trim: true,
    },

    // Current status of the opportunity
    status: {
      type: String,
      enum: ["open", "closed", "in-progress"],
      default: "open",
    },

    // NOTE: Participants array removed. Participant counts are derived from Application documents.
  },
  { timestamps: true }
);

module.exports = mongoose.model("Opportunity", opportunitySchema);

