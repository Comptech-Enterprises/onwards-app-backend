const { Router } = require("express");
const { getAlerts, createAlert, markRead, markAllRead } = require("../controllers/alertController");
const { authenticate } = require("../middleware/auth");

const router = Router();

router.get("/", authenticate, getAlerts);
router.post("/", authenticate, createAlert);
router.patch("/:alertId/read", authenticate, markRead);
router.patch("/read-all", authenticate, markAllRead);

module.exports = router;
