const mongoose = require("mongoose");

const pickupSchema = new mongoose.Schema({
    name: String,
    phone: String,
    address: String,
    wasteType: String,
    pickupDate: String,
    pickupTime: String,
    status: {
        type: String,
        default: "Pending"
    }
}, { timestamps: true });

module.exports = mongoose.model("Pickup", pickupSchema);
