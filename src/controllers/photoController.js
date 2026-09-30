const { ChecklistPhoto, Completion, Task } = require("../models");
const { uploadToR2, deleteFromR2 } = require("../config/r2");
const { broadcast } = require("../ws");

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

  const items = await ChecklistPhoto.find({ userPeriod });

  const photos = {};
  for (const row of items) {
    if (!photos[row.category]) photos[row.category] = [];
    photos[row.category].push(row.photo_url);
  }
  res.json(photos);
}

async function getAllPhotos(req, res) {
  const periodKey = req.query.date || todayKey();

  const items = await ChecklistPhoto.find({ periodKey });

  const photos = {};
  for (const row of items) {
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
  const count = await ChecklistPhoto.countDocuments({ userPeriod, category });

  if (count >= limits.max) {
    return res.status(400).json({ error: `Up to ${limits.max} ${category} photos.` });
  }

  const photoUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
  const id = `p-${Date.now()}`;

  await ChecklistPhoto.create({
    id,
    userId,
    userPeriod,
    category,
    photo_url: photoUrl,
    uploaded_at: new Date().toISOString(),
    periodKey,
  });

  broadcast("photo_upload", { userId, category, photo_url: photoUrl, periodKey });

  res.status(201).json({ ok: true, id, url: photoUrl });
}

async function deletePhoto(req, res) {
  const { photoId } = req.params;
  const userId = req.user.id;

  const photo = await ChecklistPhoto.findOne({ id: photoId });

  if (!photo || photo.userId !== userId) {
    return res.status(404).json({ error: "Photo not found." });
  }

  const periodKey = todayKey();
  const completions = await Completion.find({ userId, periodKey });

  const categoryTasks = await Task.find({ category: photo.category });
  const categoryTaskIds = new Set(categoryTasks.map((t) => t.id));

  const ticked = completions.filter((c) => categoryTaskIds.has(c.taskId));

  if (ticked.length > 0) {
    return res.status(400).json({ error: "Photos cannot be removed after a task is ticked." });
  }

  await deleteFromR2(photo.photo_url);
  await ChecklistPhoto.deleteOne({ id: photoId });

  broadcast("photo_delete", { userId, category: photo.category, photo_url: photo.photo_url, periodKey });

  res.json({ ok: true });
}

async function clearPhotos(req, res) {
  const userId = req.params.userId || req.user.id;
  const periodKey = req.query.date || todayKey();

  if (userId !== req.user.id && req.user.role !== "manager") {
    return res.status(403).json({ error: "Managers only." });
  }

  const userPeriod = `${userId}#${periodKey}`;
  const items = await ChecklistPhoto.find({ userPeriod });

  for (const row of items) {
    await deleteFromR2(row.photo_url);
    await ChecklistPhoto.deleteOne({ id: row.id });
  }

  res.json({ ok: true, deleted: items.length });
}

module.exports = { getPhotos, getAllPhotos, uploadPhoto, deletePhoto, clearPhotos };
