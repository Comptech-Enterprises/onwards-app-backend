const { Router } = require("express");
const {
  createBill,
  listBills,
  getBillById,
  updateBillStatus,
  deleteBill,
} = require("../controllers/billController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = Router();

/**
 * Flexible multipart file handler accepting any field name (upload, file, bill, image, etc.)
 */
function handleBillUpload(req, res, next) {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
}

router.get("/", authenticate, listBills);
router.post("/", authenticate, handleBillUpload, createBill);
router.get("/:billId", authenticate, getBillById);
router.patch("/:billId/status", authenticate, updateBillStatus);
router.delete("/:billId", authenticate, deleteBill);

module.exports = router;
