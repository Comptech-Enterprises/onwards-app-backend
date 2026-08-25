const { Router } = require("express");
const { getReviewChecks, checkReviewTask } = require("../controllers/reviewController");
const { authenticate } = require("../middleware/auth");

const router = Router();

router.get("/", authenticate, getReviewChecks);
router.post("/check", authenticate, checkReviewTask);

module.exports = router;
