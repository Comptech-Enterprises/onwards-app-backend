const { Router } = require("express");
const { listErrorLogs, deleteErrorLog } = require("../controllers/errorLogController");
const { authenticate, requireManager } = require("../middleware/auth");

const router = Router();

router.get("/", authenticate, requireManager, listErrorLogs);
router.delete("/:logId", authenticate, requireManager, deleteErrorLog);

module.exports = router;
