const express = require("express");
const router = express.Router();
const checkAuth = require("../middlewares/CheckAuth");
const ApplicationController = require("../controllers/ApplicationController");

router.post("/applications/apply", checkAuth, ApplicationController.applyOpportunity);
// Ensure specific literal routes come before parameter routes
router.get("/applications/my", checkAuth, ApplicationController.getApplicationsByVolunteer);
router.get("/applications/:id", checkAuth, ApplicationController.getApplicationById);
router.post("/applications/:id/respond", checkAuth, ApplicationController.respondApplication);
router.get("/applications/opportunity/:id", checkAuth, ApplicationController.getApplicantsByOpportunity);
router.delete("/applications/:id", checkAuth, ApplicationController.deleteApplication);

module.exports = router;
