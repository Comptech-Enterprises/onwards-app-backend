const path = require("path");
const { Bill, User } = require("../models");
const { uploadToR2, deleteFromR2 } = require("../config/r2");
const { broadcast } = require("../ws");

/**
 * Resolves Centre Manager (CM) and Cluster Manager hierarchy for a given user
 */
async function resolveUserHierarchy(userId, overrideData = {}) {
  const users = await User.find({}).lean();
  const userMap = new Map(users.map((u) => [u.id, u]));

  const emp = userMap.get(userId) || null;
  const employeeName = overrideData.employee_name || overrideData.employeeName || emp?.name || "Unknown";
  const employeeCode = emp?.employee_code || null;
  const designation = overrideData.designation || emp?.designation || "supervisor";
  const location = overrideData.location || emp?.location || "All centres";

  let cm = null;
  let clusterManager = null;

  if (overrideData.cm_id || overrideData.cmId) {
    const explicitCm = userMap.get(overrideData.cm_id || overrideData.cmId);
    if (explicitCm) cm = explicitCm;
  }

  if (!cm && emp) {
    if (emp.designation === "cm") {
      cm = emp;
      if (emp.manager_id) clusterManager = userMap.get(emp.manager_id);
    } else if (emp.supervisor_id) {
      const sup = userMap.get(emp.supervisor_id);
      if (sup) {
        if (sup.designation === "cm") {
          cm = sup;
          if (sup.manager_id) clusterManager = userMap.get(sup.manager_id);
        } else if (sup.designation === "cluster-manager" || sup.role === "manager") {
          clusterManager = sup;
        }
      }
    }

    // Fallback: match by centre location if not directly linked by supervisor_id
    if (!cm && location && location !== "All centres") {
      const locCm = users.find((x) => x.location === location && x.designation === "cm");
      if (locCm) {
        cm = locCm;
        if (locCm.manager_id) clusterManager = userMap.get(locCm.manager_id);
      }
    }
  }

  const cmId = cm ? cm.id : (overrideData.cm_id || overrideData.cmId || null);
  const cmName = cm ? cm.name : (overrideData.cm_name || overrideData.cmName || null);
  const clusterManagerId = clusterManager ? clusterManager.id : (overrideData.cluster_manager_id || overrideData.clusterManagerId || null);
  const clusterManagerName = clusterManager ? clusterManager.name : (overrideData.cluster_manager_name || overrideData.clusterManagerName || null);

  return {
    employeeName,
    employeeCode,
    designation,
    location,
    cmId,
    cmName,
    clusterManagerId,
    clusterManagerName,
  };
}

/**
 * Format Bill response for frontend & manager dashboard consumers
 */
function formatBill(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || row.employee_id,
    employeeId: row.user_id || row.employee_id,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    designation: row.designation || "supervisor",
    location: row.location,

    // Centre Manager & Cluster Details
    cmId: row.cm_id,
    cm_id: row.cm_id,
    cmName: row.cm_name,
    cm_name: row.cm_name,
    clusterManagerId: row.cluster_manager_id,
    cluster_manager_id: row.cluster_manager_id,
    clusterManagerName: row.cluster_manager_name,
    cluster_manager_name: row.cluster_manager_name,

    // Item & Expense
    itemName: row.item_name,
    item_name: row.item_name,
    remark: row.remark || "",
    remarks: row.remark || "",
    amount: row.amount ?? null,

    // Uploaded Document / Image
    fileUrl: row.file_url,
    file_url: row.file_url,
    uploadUrl: row.file_url,
    fileType: row.file_type || "image",
    file_type: row.file_type || "image",
    fileName: row.file_name,
    file_name: row.file_name,
    fileSize: row.file_size,

    // Status
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
 * Upload a bill with item name, remark, and connected CM/location/person information
 */
async function createBill(req, res) {
  try {
    const itemName = (req.body.item_name || req.body.itemName || req.body.item || "").trim();
    const remark = (req.body.remark || req.body.remarks || req.body.notes || "").trim();
    const rawAmount = req.body.amount;
    const amount = rawAmount !== undefined && rawAmount !== null && rawAmount !== "" ? Number(rawAmount) : null;
    const userId = req.user.id;

    if (!itemName) {
      return res.status(400).json({ error: "Item name (item_name) is required." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Bill upload file (image or PDF) is required." });
    }

    // Auto-resolve or connect user hierarchy (person, designation, location, CM, Cluster Manager)
    const hierarchy = await resolveUserHierarchy(userId, req.body);

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
      employee_name: hierarchy.employeeName,
      employee_code: hierarchy.employeeCode,
      designation: hierarchy.designation,
      location: hierarchy.location,
      cm_id: hierarchy.cmId,
      cm_name: hierarchy.cmName,
      cluster_manager_id: hierarchy.clusterManagerId,
      cluster_manager_name: hierarchy.clusterManagerName,
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
 * Build MongoDB filter query from request query params
 */
function buildBillFilter(query, user) {
  const filter = {};
  const {
    location,
    userId,
    employeeId,
    cmId,
    cm_id,
    cmName,
    clusterManagerId,
    status,
    search,
    startDate,
    endDate,
    designation,
    all,
  } = query;

  // Filter by user / employee
  const targetUser = userId || employeeId;
  if (targetUser) {
    filter.user_id = targetUser;
  } else if (user.role === "employee" && all !== "true" && !location && !cmId && !cm_id) {
    // If regular supervisor views without filters, default to own bills
    filter.user_id = user.id;
  }

  // Filter by CM
  const targetCm = cmId || cm_id;
  if (targetCm && targetCm !== "All") {
    filter.cm_id = targetCm;
  }
  if (cmName && cmName !== "All") {
    filter.cm_name = new RegExp(cmName.trim(), "i");
  }

  // Filter by Cluster Manager
  if (clusterManagerId && clusterManagerId !== "All") {
    filter.cluster_manager_id = clusterManagerId;
  }

  // Filter by location
  if (location && location !== "All" && location !== "All centres") {
    filter.location = location;
  }

  // Filter by designation
  if (designation && designation !== "All") {
    filter.designation = designation;
  }

  // Filter by status (Pending, Approved, Rejected)
  if (status && status !== "All") {
    filter.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    filter.created_at = {};
    if (startDate) filter.created_at.$gte = new Date(startDate).toISOString();
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.created_at.$lte = end.toISOString();
    }
  }

  // Text search on item_name, employee_name, cm_name, remark, or location
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    filter.$or = [
      { item_name: searchRegex },
      { employee_name: searchRegex },
      { cm_name: searchRegex },
      { remark: searchRegex },
      { location: searchRegex },
    ];
  }

  return filter;
}

/**
 * GET /api/bills
 * List bills with filter criteria
 */
async function listBills(req, res) {
  try {
    const filter = buildBillFilter(req.query, req.user);
    const bills = await Bill.find(filter).sort({ created_at: -1 }).lean();
    return res.json(bills.map(formatBill));
  } catch (err) {
    console.error("[BILLS] Error listing bills:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch bills." });
  }
}

/**
 * GET /api/bills/manager
 * Manager & Leadership Dashboard View:
 * Full list of bills with hierarchical breakdown (by person, by CM, by centre location, and overall totals)
 */
async function getManagerBillsView(req, res) {
  try {
    // For manager view, allow viewing all by default unless specific filters applied
    const query = { all: "true", ...req.query };
    const filter = buildBillFilter(query, req.user);

    const bills = await Bill.find(filter).sort({ created_at: -1 }).lean();
    const formattedBills = bills.map(formatBill);

    // Compute aggregated summary
    let totalAmount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    const byLocation = {};
    const byCM = {};
    const byPerson = {};

    formattedBills.forEach((b) => {
      const amt = Number(b.amount) || 0;
      totalAmount += amt;

      if (b.status === "Approved") approvedCount++;
      else if (b.status === "Rejected") rejectedCount++;
      else pendingCount++;

      // Group by Centre Location
      const loc = b.location || "Unknown Centre";
      if (!byLocation[loc]) {
        byLocation[loc] = { location: loc, count: 0, totalAmount: 0, pending: 0, approved: 0, rejected: 0 };
      }
      byLocation[loc].count++;
      byLocation[loc].totalAmount += amt;
      if (b.status === "Approved") byLocation[loc].approved++;
      else if (b.status === "Rejected") byLocation[loc].rejected++;
      else byLocation[loc].pending++;

      // Group by CM
      const cmKey = b.cmName || "Unassigned CM";
      if (!byCM[cmKey]) {
        byCM[cmKey] = { cmId: b.cmId, cmName: cmKey, count: 0, totalAmount: 0, pending: 0, approved: 0, rejected: 0 };
      }
      byCM[cmKey].count++;
      byCM[cmKey].totalAmount += amt;
      if (b.status === "Approved") byCM[cmKey].approved++;
      else if (b.status === "Rejected") byCM[cmKey].rejected++;
      else byCM[cmKey].pending++;

      // Group by Person (Employee / Submitter)
      const personKey = b.employeeName || b.userId || "Unknown";
      if (!byPerson[personKey]) {
        byPerson[personKey] = {
          userId: b.userId,
          employeeName: b.employeeName,
          employeeCode: b.employeeCode,
          designation: b.designation,
          location: b.location,
          cmName: b.cmName,
          count: 0,
          totalAmount: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        };
      }
      byPerson[personKey].count++;
      byPerson[personKey].totalAmount += amt;
      if (b.status === "Approved") byPerson[personKey].approved++;
      else if (b.status === "Rejected") byPerson[personKey].rejected++;
      else byPerson[personKey].pending++;
    });

    return res.json({
      success: true,
      totalBills: formattedBills.length,
      summary: {
        totalBills: formattedBills.length,
        totalAmount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        byLocation: Object.values(byLocation),
        byCM: Object.values(byCM),
        byPerson: Object.values(byPerson),
      },
      bills: formattedBills,
    });
  } catch (err) {
    console.error("[BILLS] Error in manager bills view:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch manager bills view." });
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

    // Permission check: only creator or managers can delete
    if (req.user.role !== "manager" && bill.user_id !== req.user.id) {
      return res.status(403).json({ error: "You do not have permission to delete this bill." });
    }

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
  getManagerBillsView,
  getBillById,
  updateBillStatus,
  deleteBill,
  formatBill,
};
