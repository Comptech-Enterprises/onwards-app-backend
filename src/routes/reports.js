const { Router } = require("express");
const {
  sendDaily,
  sendWeekly,
  sendMonthly,
  sendQuarterly,
  triggerImageCleanup,
  triggerQuarterlyDataCleanup,
} = require("../controllers/reportController");
const { authenticate, requireManager } = require("../middleware/auth");

const router = Router();

router.post("/daily/send", authenticate, requireManager, sendDaily);
router.post("/weekly/send", authenticate, requireManager, sendWeekly);
router.post("/monthly/send", authenticate, requireManager, sendMonthly);
router.post("/quarterly/send", authenticate, requireManager, sendQuarterly);
router.post("/cleanup/images", authenticate, requireManager, triggerImageCleanup);
router.post("/cleanup/data", authenticate, requireManager, triggerQuarterlyDataCleanup);

module.exports = router;
