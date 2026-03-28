const express = require("express");
const router = express.Router();
const checkAuth = require("../middlewares/CheckAuth");
const OpportunitiesController = require("../controllers/OpportunitiesController");

// Get all opportunities
// Get opportunities filtered by status
router.get("/opportunities/status/:status",checkAuth, OpportunitiesController.getOpportunitiesByStatus);

// Get opportunities filtered by title prefix
router.get("/opportunities/title/:prefix",checkAuth, OpportunitiesController.getOpportunitiesByTitlePrefix);

// Get single opportunity by id
router.get("/opportunities/:id", checkAuth, OpportunitiesController.getOpportunityById);

// Get all opportunities
router.get("/opportunities",checkAuth, OpportunitiesController.getAllOpportunities);

// Volunteer reports an opportunity owner to admin
router.post("/opportunities/:id/report", checkAuth, OpportunitiesController.reportOpportunityToAdmin);

// Create a new opportunity
router.post("/opportunities", checkAuth, OpportunitiesController.createOpportunity);

// Add a participant to an opportunity
// Participants are computed from applications; expose a count endpoint
router.get("/opportunities/:id/participants-count", checkAuth, OpportunitiesController.getParticipantsCount);

// Update an existing opportunity by id
router.put("/opportunities/:id", checkAuth, OpportunitiesController.updateOpportunity);

// Delete an opportunity by id
router.delete("/opportunities/:id", checkAuth, OpportunitiesController.deleteOpportunity);

module.exports = router;
