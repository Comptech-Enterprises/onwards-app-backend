const bcrypt = require("bcryptjs");
const { ScanCommand, QueryCommand, GetCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

async function listUsers(req, res) {
  const { Items } = await docClient.send(new ScanCommand({ TableName: Tables.USERS }));
  const users = (Items || []).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  res.json(users.map(formatUser));
}

async function listEmployees(req, res) {
  const { Items } = await docClient.send(new ScanCommand({
    TableName: Tables.USERS,
    FilterExpression: "#r = :role",
    ExpressionAttributeNames: { "#r": "role" },
    ExpressionAttributeValues: { ":role": "employee" },
  }));

  const employees = [];
  for (const row of (Items || []).sort((a, b) => a.name.localeCompare(b.name))) {
    const { Items: tasks } = await docClient.send(new QueryCommand({
      TableName: Tables.USER_TASKS,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": row.id },
    }));
    employees.push({
      ...formatUser(row),
      taskIds: (tasks || []).map((t) => t.taskId),
    });
  }
  res.json(employees);
}

async function createUser(req, res) {
  const { name, username, password, location, employeeCode, phone, designation, supervisorId } = req.body;
  const uname = (username || "").trim().toLowerCase();
  const code = (employeeCode || "").trim();

  if (!name?.trim() || !uname || !password || !code) {
    return res.status(400).json({ error: "Name, employee code, username and password required." });
  }

  const { Items: byUsername } = await docClient.send(new QueryCommand({
    TableName: Tables.USERS,
    IndexName: "username-index",
    KeyConditionExpression: "username = :u",
    ExpressionAttributeValues: { ":u": uname },
  }));
  if (byUsername && byUsername.length > 0) {
    return res.status(409).json({ error: "Username already exists." });
  }

  const { Items: byCode } = await docClient.send(new QueryCommand({
    TableName: Tables.USERS,
    IndexName: "employeeCode-index",
    KeyConditionExpression: "employee_code = :c",
    ExpressionAttributeValues: { ":c": code },
  }));
  if (byCode && byCode.length > 0) {
    return res.status(409).json({ error: "Employee code already exists." });
  }

  const id = `e-${Date.now()}`;
  const hash = await bcrypt.hash(password, 10);

  const item = {
    id,
    name: name.trim(),
    username: uname,
    password: hash,
    role: "employee",
    location: location || null,
    employee_code: code,
    phone: phone || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (designation) item.designation = designation;
  if (supervisorId) item.supervisor_id = supervisorId;

  await docClient.send(new PutCommand({
    TableName: Tables.USERS,
    Item: item,
  }));

  const { Items: allTasks } = await docClient.send(new ScanCommand({
    TableName: Tables.TASKS,
  }));

  for (const task of (allTasks || [])) {
    await docClient.send(new PutCommand({
      TableName: Tables.USER_TASKS,
      Item: { userId: id, taskId: task.id },
    }));
  }

  res.status(201).json({ ok: true, id });
}

async function deleteUser(req, res) {
  const { userId } = req.params;

  if (req.user.id === userId) {
    return res.status(400).json({ error: "Cannot delete signed-in account." });
  }

  const { Item: target } = await docClient.send(new GetCommand({
    TableName: Tables.USERS,
    Key: { id: userId },
  }));

  if (!target) {
    return res.status(404).json({ error: "User not found." });
  }

  if (target.role === "manager") {
    const { Items: managers } = await docClient.send(new ScanCommand({
      TableName: Tables.USERS,
      FilterExpression: "#r = :role",
      ExpressionAttributeNames: { "#r": "role" },
      ExpressionAttributeValues: { ":role": "manager" },
    }));
    if ((managers || []).length <= 1) {
      return res.status(400).json({ error: "Keep at least one manager." });
    }
  }

  await docClient.send(new DeleteCommand({
    TableName: Tables.USERS,
    Key: { id: userId },
  }));

  const { Items: userTasks } = await docClient.send(new QueryCommand({
    TableName: Tables.USER_TASKS,
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));
  for (const ut of (userTasks || [])) {
    await docClient.send(new DeleteCommand({
      TableName: Tables.USER_TASKS,
      Key: { userId: ut.userId, taskId: ut.taskId },
    }));
  }

  res.json({ ok: true });
}

function formatUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    location: row.location,
    employeeCode: row.employee_code,
    phone: row.phone,
    designation: row.designation || null,
    supervisorId: row.supervisor_id || null,
  };
}

module.exports = { listUsers, listEmployees, createUser, deleteUser };
