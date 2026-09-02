const { ScanCommand, QueryCommand, GetCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

async function listTasks(req, res) {
  const { Items } = await docClient.send(new ScanCommand({ TableName: Tables.TASKS }));
  const sorted = (Items || []).sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  res.json(sorted);
}

async function getTasksByUser(req, res) {
  const userId = req.params.userId || req.user.id;
  const { Items: assignments } = await docClient.send(new QueryCommand({
    TableName: Tables.USER_TASKS,
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));

  const tasks = [];
  for (const a of (assignments || [])) {
    const { Item } = await docClient.send(new GetCommand({
      TableName: Tables.TASKS,
      Key: { id: a.taskId },
    }));
    if (Item) tasks.push(Item);
  }

  tasks.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  res.json(tasks);
}

async function getTasksByCategory(req, res) {
  const { category } = req.params;
  const { Items } = await docClient.send(new QueryCommand({
    TableName: Tables.TASKS,
    IndexName: "category-index",
    KeyConditionExpression: "category = :cat",
    ExpressionAttributeValues: { ":cat": category },
  }));
  res.json((Items || []).sort((a, b) => a.id.localeCompare(b.id)));
}

const VALID_CATEGORIES = ["Washroom", "Pantry", "Common Areas", "Infra & Safety", "Soft Services", "Meeting Rooms"];

async function createTask(req, res) {
  const { category, name, frequency, weekday, monthDay, assignTo } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Task name required." });
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}` });
  }

  const id = `t-${Date.now()}`;
  const freq = frequency || "daily";

  await docClient.send(new PutCommand({
    TableName: Tables.TASKS,
    Item: {
      id,
      category,
      name: name.trim(),
      frequency: freq,
      weekday: weekday || null,
      month_day: monthDay || null,
    },
  }));

  if (assignTo === "all") {
    const { Items: employees } = await docClient.send(new ScanCommand({
      TableName: Tables.USERS,
      FilterExpression: "#r = :role",
      ExpressionAttributeNames: { "#r": "role" },
      ExpressionAttributeValues: { ":role": "employee" },
    }));
    for (const emp of (employees || [])) {
      await docClient.send(new PutCommand({
        TableName: Tables.USER_TASKS,
        Item: { userId: emp.id, taskId: id },
      }));
    }
  } else if (Array.isArray(assignTo)) {
    for (const userId of assignTo) {
      await docClient.send(new PutCommand({
        TableName: Tables.USER_TASKS,
        Item: { userId, taskId: id },
      }));
    }
  }

  res.status(201).json({ ok: true, id, category, name: name.trim(), frequency: freq });
}

async function updateTask(req, res) {
  const { taskId } = req.params;
  const { name, category, frequency, weekday, monthDay } = req.body;

  const { Item: existing } = await docClient.send(new GetCommand({
    TableName: Tables.TASKS,
    Key: { id: taskId },
  }));
  if (!existing) {
    return res.status(404).json({ error: "Task not found." });
  }

  const updated = { ...existing };
  if (name?.trim()) updated.name = name.trim();
  if (category && VALID_CATEGORIES.includes(category)) updated.category = category;
  if (frequency) updated.frequency = frequency;
  if (weekday !== undefined) updated.weekday = weekday;
  if (monthDay !== undefined) updated.month_day = monthDay;

  await docClient.send(new PutCommand({
    TableName: Tables.TASKS,
    Item: updated,
  }));

  res.json({ ok: true });
}

async function deleteTask(req, res) {
  const { taskId } = req.params;

  const { Item: existing } = await docClient.send(new GetCommand({
    TableName: Tables.TASKS,
    Key: { id: taskId },
  }));
  if (!existing) {
    return res.status(404).json({ error: "Task not found." });
  }

  await docClient.send(new DeleteCommand({
    TableName: Tables.TASKS,
    Key: { id: taskId },
  }));

  const { Items: assignments } = await docClient.send(new QueryCommand({
    TableName: Tables.USER_TASKS,
    IndexName: "taskId-index",
    KeyConditionExpression: "taskId = :tid",
    ExpressionAttributeValues: { ":tid": taskId },
  }));
  for (const a of (assignments || [])) {
    await docClient.send(new DeleteCommand({
      TableName: Tables.USER_TASKS,
      Key: { userId: a.userId, taskId: a.taskId },
    }));
  }

  res.json({ ok: true });
}

async function assignTask(req, res) {
  const { taskId } = req.params;
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds array required." });
  }

  for (const userId of userIds) {
    await docClient.send(new PutCommand({
      TableName: Tables.USER_TASKS,
      Item: { userId, taskId },
    }));
  }
  res.json({ ok: true });
}

async function unassignTask(req, res) {
  const { taskId, userId } = req.params;
  await docClient.send(new DeleteCommand({
    TableName: Tables.USER_TASKS,
    Key: { userId, taskId },
  }));
  res.json({ ok: true });
}

module.exports = { listTasks, getTasksByUser, getTasksByCategory, createTask, updateTask, deleteTask, assignTask, unassignTask };
