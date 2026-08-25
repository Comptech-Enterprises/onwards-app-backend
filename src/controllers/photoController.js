const { ScanCommand, QueryCommand, GetCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

const PHOTO_LIMITS = {
  Pantry: { min: 1, max: 4 },
  Washroom: { min: 3, max: 8 },
  "Common Areas": { min: 2, max: 4 },
  "Soft Services": { min: 1, max: 1 },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getPhotos(req, res) {
  const userId = req.params.userId || req.user.id;
  const periodKey = req.query.date || todayKey();
  const userPeriod = `${userId}#${periodKey}`;

  const { Items } = await docClient.send(new QueryCommand({
    TableName: Tables.CHECKLIST_PHOTOS,
    IndexName: "userPeriod-index",
    KeyConditionExpression: "userPeriod = :up",
    ExpressionAttributeValues: { ":up": userPeriod },
  }));

  const photos = {};
  for (const row of (Items || [])) {
    if (!photos[row.category]) photos[row.category] = [];
    photos[row.category].push(row.photo_url);
  }
  res.json(photos);
}

async function getAllPhotos(req, res) {
  const periodKey = req.query.date || todayKey();

  const { Items } = await docClient.send(new QueryCommand({
    TableName: Tables.CHECKLIST_PHOTOS,
    IndexName: "periodKey-index",
    KeyConditionExpression: "periodKey = :pk",
    ExpressionAttributeValues: { ":pk": periodKey },
  }));

  const photos = {};
  for (const row of (Items || [])) {
    if (!photos[row.userId]) photos[row.userId] = {};
    if (!photos[row.userId][row.category]) photos[row.userId][row.category] = [];
    photos[row.userId][row.category].push(row.photo_url);
  }
  res.json(photos);
}

async function uploadPhoto(req, res) {
  const { category } = req.body;
  const userId = req.user.id;
  const periodKey = todayKey();

  if (!req.file) {
    return res.status(400).json({ error: "No photo uploaded." });
  }

  const limits = PHOTO_LIMITS[category];
  if (!limits) {
    return res.status(400).json({ error: "Invalid category." });
  }

  const userPeriod = `${userId}#${periodKey}`;
  const { Items: existing } = await docClient.send(new QueryCommand({
    TableName: Tables.CHECKLIST_PHOTOS,
    IndexName: "userPeriod-index",
    KeyConditionExpression: "userPeriod = :up AND category = :cat",
    ExpressionAttributeValues: { ":up": userPeriod, ":cat": category },
  }));

  if ((existing || []).length >= limits.max) {
    return res.status(400).json({ error: `Up to ${limits.max} ${category} photos.` });
  }

  const photoUrl = `/uploads/${req.file.filename}`;
  const id = `p-${Date.now()}`;

  await docClient.send(new PutCommand({
    TableName: Tables.CHECKLIST_PHOTOS,
    Item: {
      id,
      userId,
      userPeriod,
      category,
      photo_url: photoUrl,
      uploaded_at: new Date().toISOString(),
      periodKey,
    },
  }));

  res.status(201).json({ ok: true, id, url: photoUrl });
}

async function deletePhoto(req, res) {
  const { photoId } = req.params;
  const userId = req.user.id;

  const { Item: photo } = await docClient.send(new GetCommand({
    TableName: Tables.CHECKLIST_PHOTOS,
    Key: { id: photoId },
  }));

  if (!photo || photo.userId !== userId) {
    return res.status(404).json({ error: "Photo not found." });
  }

  const periodKey = todayKey();
  const { Items: completions } = await docClient.send(new QueryCommand({
    TableName: Tables.COMPLETIONS,
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
    FilterExpression: "periodKey = :pk",
  }));

  const { Items: categoryTasks } = await docClient.send(new QueryCommand({
    TableName: Tables.TASKS,
    IndexName: "category-index",
    KeyConditionExpression: "category = :cat",
    ExpressionAttributeValues: { ":cat": photo.category },
  }));
  const categoryTaskIds = new Set((categoryTasks || []).map((t) => t.id));

  const ticked = (completions || []).filter(
    (c) => c.periodKey === periodKey && categoryTaskIds.has(c.taskId)
  );

  if (ticked.length > 0) {
    return res.status(400).json({ error: "Photos cannot be removed after a task is ticked." });
  }

  await docClient.send(new DeleteCommand({
    TableName: Tables.CHECKLIST_PHOTOS,
    Key: { id: photoId },
  }));

  res.json({ ok: true });
}

module.exports = { getPhotos, getAllPhotos, uploadPhoto, deletePhoto };
