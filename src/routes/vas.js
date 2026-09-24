const { Router } = require("express");
const {
  listVisitors,
  createVisitor,
  deleteVisitor,
  VAS_SOURCES,
  VAS_AGGREGATORS,
} = require("../controllers/visitorController");
const { authenticate } = require("../middleware/auth");

const router = Router();

router.get("/options", authenticate, (req, res) => {
  res.json({
    sources: VAS_SOURCES,
    aggregators: VAS_AGGREGATORS,
    facilities: ["Day Pass", "Meeting Room", "Photo Shoot", "Virtual Office"],
    paymentModes: ["Cash", "UPI", "Card", "Prepaid"],
  });
});

router.get("/", authenticate, listVisitors);
router.post("/", authenticate, createVisitor);
router.delete("/:visitorId", authenticate, deleteVisitor);

module.exports = router;
