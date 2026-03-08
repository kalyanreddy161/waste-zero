const Schedule = require("../models/Schedule");

exports.createPickup = async (req, res) => {
  try {
    const { wasteType, address, city, pickupDate } = req.body;

    const pickup = new Schedule({
      userId: req.session.user._id,
      wasteType,
      address,
      city,
      pickupDate
    });

    await pickup.save();

    res.status(201).json({
      success: true,
      message: "Pickup scheduled successfully",
      pickup
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMyPickups = async (req, res) => {
  try {
    const pickups = await Schedule.find({ userId: req.session.user._id });
    res.json(pickups);
  } catch (error) {
    res.status(500).json({ message: "Error fetching pickups" });
  }
};
