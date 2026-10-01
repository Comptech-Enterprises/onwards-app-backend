const bcrypt = require("bcryptjs");
const { User, Task, UserTask } = require("../models");

async function listUsers(req, res) {
  const users = await User.find({}).sort({ created_at: 1 });
  res.json(users.map(formatUser));
}

async function listEmployees(req, res) {
  const users = await User.find({ role: "employee" }).sort({ name: 1 });

  const employees = [];
  for (const row of users) {
    const tasks = await UserTask.find({ userId: row.id });
    employees.push({
      ...formatUser(row),
      taskIds: tasks.map((t) => t.taskId),
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

  const byUsername = await User.findOne({ username: uname });
  if (byUsername) {
    return res.status(409).json({ error: "Username already exists." });
  }

  const byCode = await User.findOne({ employee_code: code });
  if (byCode) {
    return res.status(409).json({ error: "Employee code already exists." });
  }

  const id = `e-${Date.now()}`;
  const hash = await bcrypt.hash(password, 10);

  const newUser = new User({
    id,
    name: name.trim(),
    username: uname,
    password: hash,
    role: "employee",
    location: location || null,
    employee_code: code,
    phone: phone || null,
    designation: designation || null,
    supervisor_id: supervisorId || null,
    manager_id: req.body.managerId || null,
    is_active: true,
  });

  await newUser.save();

  const allTasks = await Task.find({});
  for (const task of allTasks) {
    await UserTask.create({ userId: id, taskId: task.id });
  }

  res.status(201).json({ ok: true, id });
}

async function deleteUser(req, res) {
  const { userId } = req.params;

  if (req.user.id === userId) {
    return res.status(400).json({ error: "Cannot delete signed-in account." });
  }

  const target = await User.findOne({ id: userId });
  if (!target) {
    return res.status(404).json({ error: "User not found." });
  }

  if (target.role === "manager") {
    const managerCount = await User.countDocuments({ role: "manager" });
    if (managerCount <= 1) {
      return res.status(400).json({ error: "Keep at least one manager." });
    }
  }

  await User.deleteOne({ id: userId });
  await UserTask.deleteMany({ userId });

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
    email: row.email || null,
    designation: row.designation || null,
    supervisorId: row.supervisor_id || null,
    managerId: row.manager_id || null,
  };
}

module.exports = { listUsers, listEmployees, createUser, deleteUser };
