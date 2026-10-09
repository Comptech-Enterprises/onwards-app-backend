const { Router } = require("express");
const {
  createBill,
  listBills,
  getManagerBillsView,
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

// 1. Manager / Leadership Tab View (with summary & hierarchy breakdown by Person, CM, and Centre)
router.get("/manager", authenticate, getManagerBillsView);

// 2. Standard Bills List (with query filters)
router.get("/", authenticate, listBills);

// 3. Create a Bill
router.post("/", authenticate, handleBillUpload, createBill);

// 4. View single bill details
router.get("/:billId", authenticate, getBillById);

// 5. Update bill status (Pending / Approved / Rejected)
router.patch("/:billId/status", authenticate, updateBillStatus);

// 6. Delete a bill
router.delete("/:billId", authenticate, deleteBill);

module.exports = router;
