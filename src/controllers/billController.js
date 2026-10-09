const path = require("path");
const { Bill, User } = require("../models");
const { uploadToR2, deleteFromR2 } = require("../config/r2");
const { broadcast } = require("../ws");

/**
 * Format Bill response for both camelCase and snake_case API consumers
 */
function formatBill(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || row.employee_id,
    employeeId: row.user_id || row.employee_id,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    location: row.location,
    itemName: row.item_name,
    item_name: row.item_name,
    remark: row.remark || "",
    remarks: row.remark || "",
    amount: row.amount ?? null,
    fileUrl: row.file_url,
    file_url: row.file_url,
    uploadUrl: row.file_url,
    fileType: row.file_type || "image",
    file_type: row.file_type || "image",
    fileName: row.file_name,
    file_name: row.file_name,
    fileSize: row.file_size,
    status: row.status || "Pending",
    statusRemark: row.status_remark,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * POST /api/bills
 * Upload a bill/invoice/receipt with item name and remarks
 */
async function createBill(req, res) {
  try {
    const itemName = (req.body.item_name || req.body.itemName || req.body.item || "").trim();
    const remark = (req.body.remark || req.body.remarks || req.body.notes || "").trim();
    const rawAmount = req.body.amount;
    const amount = rawAmount !== undefined && rawAmount !== null && rawAmount !== "" ? Number(rawAmount) : null;
    const reqLocation = (req.body.location || "").trim();
    const userId = req.user.id;

    if (!itemName) {
      return res.status(400).json({ error: "Item name (item_name) is required." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Bill upload file (image or PDF) is required." });
    }

    // Lookup user details
    const emp = await User.findOne({ id: userId }).lean();
    const employeeName = emp?.name || req.user.name || "Unknown";
    const employeeCode = emp?.employee_code || null;
    const location = reqLocation || emp?.location || "All centres";

    // Determine file type (image or pdf)
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const mime = (req.file.mimetype || "").toLowerCase();
    const isPdf = ext === ".pdf" || mime.includes("pdf");
    const fileType = isPdf ? "pdf" : "image";

    // Upload to Cloudflare R2 under 'bills' folder
    const fileUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, "bills");

    const id = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const bill = await Bill.create({
      id,
      user_id: userId,
      employee_id: userId,
      employee_name: employeeName,
      employee_code: employeeCode,
      location,
      item_name: itemName,
      remark,
      amount: Number.isNaN(amount) ? null : amount,
      file_url: fileUrl,
      file_type: fileType,
      file_name: req.file.originalname || null,
      file_size: req.file.size || null,
      status: "Pending",
      created_at: now,
      updated_at: null,
    });

    const formatted = formatBill(bill);
    broadcast("bill_created", formatted);

    return res.status(201).json({
      success: true,
      message: "Bill uploaded successfully.",
      bill: formatted,
    });
  } catch (err) {
    console.error("[BILLS] Error creating bill:", err);
    return res.status(500).json({ error: err.message || "Failed to create bill." });
  }
}

/**
 * GET /api/bills
 * List bills with optional filters (location, userId, status, date range, search)
 */
async function listBills(req, res) {
  try {
    const { location, userId, employeeId, status, search, startDate, endDate, all } = req.query;
    const query = {};

    // Filter by specific user if provided
    const targetUser = userId || employeeId;
    if (targetUser) {
      query.user_id = targetUser;
    } else if (req.user.role === "employee" && all !== "true" && !location) {
      // By default, regular employees view their own bills unless location/all is explicitly requested
      query.user_id = req.user.id;
    }

    // Filter by location
    if (location && location !== "All" && location !== "All centres") {
      query.location = location;
    }

    // Filter by status (Pending, Approved, Rejected)
    if (status && status !== "All") {
      query.status = status;
    }

    // Filter by date range on created_at
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.created_at.$lte = end.toISOString();
      }
    }

    // Text search on item_name, employee_name, or remark
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { item_name: searchRegex },
        { employee_name: searchRegex },
        { remark: searchRegex },
        { location: searchRegex },
      ];
    }

    const bills = await Bill.find(query).sort({ created_at: -1 }).lean();
    return res.json(bills.map(formatBill));
  } catch (err) {
    console.error("[BILLS] Error listing bills:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch bills." });
  }
}

/**
 * GET /api/bills/:billId
 * Get bill details by ID
 */
async function getBillById(req, res) {
  try {
    const { billId } = req.params;
    const bill = await Bill.findOne({ id: billId }).lean();
    if (!bill) {
      return res.status(404).json({ error: "Bill not found." });
    }
    return res.json(formatBill(bill));
  } catch (err) {
    console.error("[BILLS] Error fetching bill:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch bill." });
  }
}

/**
 * PATCH /api/bills/:billId/status
 * Update approval status of a bill (Pending, Approved, Rejected)
 */
async function updateBillStatus(req, res) {
  try {
    const { billId } = req.params;
    const { status, status_remark, statusRemark, remark } = req.body;

    const validStatuses = ["Pending", "Approved", "Rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const bill = await Bill.findOne({ id: billId });
    if (!bill) {
      return res.status(404).json({ error: "Bill not found." });
    }

    const now = new Date().toISOString();
    bill.status = status;
    bill.status_remark = (status_remark || statusRemark || remark || "").trim() || bill.status_remark;
    bill.reviewed_by = req.user.name || req.user.id;
    bill.reviewed_at = now;
    bill.updated_at = now;

    await bill.save();

    const formatted = formatBill(bill);
    broadcast("bill_updated", formatted);

    return res.json({
      success: true,
      message: `Bill status updated to ${status}.`,
      bill: formatted,
    });
  } catch (err) {
    console.error("[BILLS] Error updating bill status:", err);
    return res.status(500).json({ error: err.message || "Failed to update bill status." });
  }
}

/**
 * DELETE /api/bills/:billId
 * Delete a bill
 */
async function deleteBill(req, res) {
  try {
    const { billId } = req.params;
    const bill = await Bill.findOne({ id: billId });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found." });
    }

    // Permission check: only bill creator or managers can delete
    if (req.user.role !== "manager" && bill.user_id !== req.user.id) {
      return res.status(403).json({ error: "You do not have permission to delete this bill." });
    }

    // Try deleting file from R2
    if (bill.file_url) {
      try {
        await deleteFromR2(bill.file_url);
      } catch (r2Err) {
        console.warn("[BILLS] Non-fatal R2 file deletion error:", r2Err.message);
      }
    }

    await Bill.deleteOne({ id: billId });
    broadcast("bill_deleted", { id: billId });

    return res.json({ success: true, message: "Bill deleted successfully." });
  } catch (err) {
    console.error("[BILLS] Error deleting bill:", err);
    return res.status(500).json({ error: err.message || "Failed to delete bill." });
  }
}

module.exports = {
  createBill,
  listBills,
  getBillById,
  updateBillStatus,
  deleteBill,
  formatBill,
};
