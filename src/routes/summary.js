const { Router } = require("express");
const { getDailySummary, sendSummaryEmail } = require("../controllers/summaryController");
const { authenticate, requireManager } = require("../middleware/auth");

const router = Router();

router.get("/", authenticate, getDailySummary);
router.post("/email", authenticate, requireManager, sendSummaryEmail);

module.exports = router;
