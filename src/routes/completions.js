const { Router } = require("express");
const { getCompletions, getAllCompletions, toggleTask, clearCompletions } = require("../controllers/completionController");
const { authenticate } = require("../middleware/auth");

const router = Router();

router.get("/my", authenticate, getCompletions);
router.get("/user/:userId", authenticate, getCompletions);
router.get("/all", authenticate, getAllCompletions);
router.post("/toggle/:taskId", authenticate, toggleTask);
router.delete("/my", authenticate, clearCompletions);
router.delete("/user/:userId", authenticate, clearCompletions);

module.exports = router;
