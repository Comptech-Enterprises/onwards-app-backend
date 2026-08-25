const { ScanCommand, GetCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

const VISITOR_DELETE_WINDOW_MS = 3 * 60 * 60 * 1000;

async function listVisitors(req, res) {
  const { Items } = await docClient.send(new ScanCommand({ TableName: Tables.VISITORS }));
  const sorted = (Items || []).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  res.json(sorted.map(formatVisitor));
}

async function createVisitor(req, res) {
  const { date, facilityType, aggregator, arrivalTime, punchOutTime, guestName, location, seats, payment } = req.body;
  const userId = req.user.id;

  const { Item: emp } = await docClient.send(new GetCommand({
    TableName: Tables.USERS,
    Key: { id: userId },
  }));
  const employeeName = emp?.name || "Unknown";
  const empLocation = location || emp?.location || "Unknown";

  const id = `v-${Date.now()}`;
  const item = {
    id,
    user_id: userId,
    employee_name: employeeName,
    location: empLocation,
    visit_date: date || new Date().toISOString().slice(0, 10),
    facility_type: facilityType || null,
    aggregator: aggregator || null,
    arrival_time: arrivalTime || null,
    punch_out_time: punchOutTime || null,
    guest_name: guestName || null,
    seats: seats || null,
    payment: payment || null,
    created_at: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: Tables.VISITORS,
    Item: item,
  }));

  res.status(201).json(formatVisitor(item));
}

async function deleteVisitor(req, res) {
  const { visitorId } = req.params;

  const { Item } = await docClient.send(new GetCommand({
    TableName: Tables.VISITORS,
    Key: { id: visitorId },
  }));

  if (!Item) {
    return res.status(404).json({ error: "Entry not found." });
  }

  const created = new Date(Item.created_at).getTime();
  if (Date.now() - created >= VISITOR_DELETE_WINDOW_MS) {
    return res.status(400).json({ error: "Entries can only be deleted within 3 hours of logging." });
  }

  await docClient.send(new DeleteCommand({
    TableName: Tables.VISITORS,
    Key: { id: visitorId },
  }));

  res.json({ ok: true });
}

function formatVisitor(row) {
  return {
    id: row.id,
    employeeId: row.user_id,
    employeeName: row.employee_name,
    location: row.location,
    date: row.visit_date,
    facilityType: row.facility_type,
    aggregator: row.aggregator,
    arrivalTime: row.arrival_time,
    punchOutTime: row.punch_out_time,
    guestName: row.guest_name,
    seats: row.seats,
    payment: row.payment,
    createdAt: row.created_at,
  };
}

module.exports = { listVisitors, createVisitor, deleteVisitor };
