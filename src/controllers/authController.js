const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  const user = await User.findOne({
    username: username.trim().toLowerCase(),
    is_active: true,
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name, location: user.location },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "365d" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      location: user.location,
      employeeCode: user.employee_code,
      phone: user.phone,
      designation: user.designation || null,
      supervisorId: user.supervisor_id || null,
      managerId: user.manager_id || null,
    },
  });
}

async function me(req, res) {
  const user = await User.findOne({ id: req.user.id });

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    location: user.location,
    employeeCode: user.employee_code,
    phone: user.phone,
    designation: user.designation || null,
    supervisorId: user.supervisor_id || null,
    managerId: user.manager_id || null,
  });
}

module.exports = { login, me };
