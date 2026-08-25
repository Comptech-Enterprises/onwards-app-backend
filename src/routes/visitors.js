const { Router } = require("express");
const { listVisitors, createVisitor, deleteVisitor } = require("../controllers/visitorController");
const { authenticate } = require("../middleware/auth");

const router = Router();

router.get("/", authenticate, listVisitors);
router.post("/", authenticate, createVisitor);
router.delete("/:visitorId", authenticate, deleteVisitor);

module.exports = router;
