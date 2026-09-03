const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  const { Items } = await docClient.send(new QueryCommand({
    TableName: Tables.USERS,
    IndexName: "username-index",
    KeyConditionExpression: "username = :u",
    ExpressionAttributeValues: { ":u": username.trim().toLowerCase() },
  }));

  if (!Items || Items.length === 0) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const user = Items[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name, location: user.location },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
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
  const { Item } = await docClient.send(new GetCommand({
    TableName: Tables.USERS,
    Key: { id: req.user.id },
  }));

  if (!Item) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({
    id: Item.id,
    name: Item.name,
    username: Item.username,
    role: Item.role,
    location: Item.location,
    employeeCode: Item.employee_code,
    phone: Item.phone,
    designation: Item.designation || null,
    supervisorId: Item.supervisor_id || null,
    managerId: Item.manager_id || null,
  });
}

module.exports = { login, me };
