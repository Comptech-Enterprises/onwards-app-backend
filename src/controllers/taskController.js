const { Task, UserTask, User } = require("../models");

async function listTasks(req, res) {
  const tasks = await Task.find({}).sort({ category: 1, id: 1 });
  res.json(tasks);
}

async function getTasksByUser(req, res) {
  const userId = req.params.userId || req.user.id;
  const assignments = await UserTask.find({ userId });
  const taskIds = assignments.map((a) => a.taskId);

  const tasks = await Task.find({ id: { $in: taskIds } }).sort({ category: 1, id: 1 });
  res.json(tasks);
}

async function getTasksByCategory(req, res) {
  const { category } = req.params;
  const tasks = await Task.find({ category }).sort({ id: 1 });
  res.json(tasks);
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

  await Task.create({
    id,
    category,
    name: name.trim(),
    frequency: freq,
    weekday: weekday || null,
    month_day: monthDay || null,
  });

  if (assignTo === "all") {
    const employees = await User.find({ role: "employee" });
    for (const emp of employees) {
      await UserTask.findOneAndUpdate(
        { userId: emp.id, taskId: id },
        { userId: emp.id, taskId: id },
        { upsert: true, returnDocument: 'after' }
      );
    }
  } else if (Array.isArray(assignTo)) {
    for (const userId of assignTo) {
      await UserTask.findOneAndUpdate(
        { userId, taskId: id },
        { userId, taskId: id },
        { upsert: true, returnDocument: 'after' }
      );
    }
  }

  res.status(201).json({ ok: true, id, category, name: name.trim(), frequency: freq });
}

async function updateTask(req, res) {
  const { taskId } = req.params;
  const { name, category, frequency, weekday, monthDay } = req.body;

  const existing = await Task.findOne({ id: taskId });
  if (!existing) {
    return res.status(404).json({ error: "Task not found." });
  }

  if (name?.trim()) existing.name = name.trim();
  if (category && VALID_CATEGORIES.includes(category)) existing.category = category;
  if (frequency) existing.frequency = frequency;
  if (weekday !== undefined) existing.weekday = weekday;
  if (monthDay !== undefined) existing.month_day = monthDay;

  await existing.save();

  res.json({ ok: true });
}

async function deleteTask(req, res) {
  const { taskId } = req.params;

  const existing = await Task.findOne({ id: taskId });
  if (!existing) {
    return res.status(404).json({ error: "Task not found." });
  }

  await Task.deleteOne({ id: taskId });
  await UserTask.deleteMany({ taskId });

  res.json({ ok: true });
}

async function assignTask(req, res) {
  const { taskId } = req.params;
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds array required." });
  }

  for (const userId of userIds) {
    await UserTask.findOneAndUpdate(
      { userId, taskId },
      { userId, taskId },
      { upsert: true, returnDocument: 'after' }
    );
  }
  res.json({ ok: true });
}

async function unassignTask(req, res) {
  const { taskId, userId } = req.params;
  await UserTask.deleteOne({ userId, taskId });
  res.json({ ok: true });
}

module.exports = { listTasks, getTasksByUser, getTasksByCategory, createTask, updateTask, deleteTask, assignTask, unassignTask };
