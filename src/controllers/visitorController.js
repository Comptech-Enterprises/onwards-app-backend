const { ScanCommand, GetCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

const VISITOR_DELETE_WINDOW_MS = 3 * 60 * 60 * 1000;

const VAS_SOURCES = ["Direct", "Aggregator", "Aligned by sales team"];
const VAS_AGGREGATORS = [
  "Myhq",
  "Cofynd",
  "Qdesq",
  "SimplyWork",
  "SpaceN",
  "StyleWork",
  "EasyDesq",
  "Instant Office",
  "Lease Circle",
  "NA",
];

async function listVisitors(req, res) {
  const { Items } = await docClient.send(new ScanCommand({ TableName: Tables.VISITORS }));
  const sorted = (Items || []).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  res.json(sorted.map(formatVisitor));
}

async function createVisitor(req, res) {
  const {
    date,
    facilityType,
    source,
    aggregator,
    aggregatorName,
    arrivalTime,
    punchOutTime,
    guestName,
    location,
    seats,
    payment,
    paymentAmount,
    amountReceived,
    invoiceTechMonk,
  } = req.body;
  const userId = req.user.id;

  const { Item: emp } = await docClient.send(new GetCommand({
    TableName: Tables.USERS,
    Key: { id: userId },
  }));
  const employeeName = emp?.name || "Unknown";
  const empLocation = location || emp?.location || "Unknown";

  const resolvedAggregator = aggregator || aggregatorName || (source === "Direct" ? "NA" : null);
  const parsedAmount = amountReceived != null
    ? parseFloat(amountReceived)
    : (paymentAmount != null ? parseFloat(paymentAmount) : 0);

  const id = `v-${Date.now()}`;
  const item = {
    id,
    user_id: userId,
    employee_name: employeeName,
    location: empLocation,
    visit_date: date || new Date().toISOString().slice(0, 10),
    facility_type: facilityType || null,
    source: source || "Direct",
    aggregator: resolvedAggregator,
    arrival_time: arrivalTime || null,
    punch_out_time: punchOutTime || null,
    guest_name: guestName || null,
    seats: seats ? parseInt(seats, 10) : 1,
    payment: payment || null,
    amount_received: isNaN(parsedAmount) ? 0 : parsedAmount,
    invoice_tech_monk: invoiceTechMonk === true || invoiceTechMonk === "Yes" ? "Yes" : "No",
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
  const amount = row.amount_received != null ? Number(row.amount_received) : (row.paymentAmount != null ? Number(row.paymentAmount) : 0);
  return {
    id: row.id,
    employeeId: row.user_id,
    employeeName: row.employee_name,
    location: row.location,
    date: row.visit_date,
    facilityType: row.facility_type,
    source: row.source || "Direct",
    aggregator: row.aggregator || "NA",
    aggregatorName: row.aggregator || "NA",
    arrivalTime: row.arrival_time,
    punchOutTime: row.punch_out_time,
    guestName: row.guest_name,
    seats: row.seats != null ? Number(row.seats) : 1,
    payment: row.payment,
    paymentAmount: amount,
    amountReceived: amount,
    invoiceTechMonk: row.invoice_tech_monk || "No",
    createdAt: row.created_at,
  };
}

module.exports = {
  listVisitors,
  createVisitor,
  deleteVisitor,
  VAS_SOURCES,
  VAS_AGGREGATORS,
};
