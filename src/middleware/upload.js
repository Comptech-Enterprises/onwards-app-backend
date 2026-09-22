const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /jpeg|jpg|png|webp|gif|heic|heif/;
    const ext = path.extname(file.originalname || "").toLowerCase().replace(/^\./, "");
    const extOk = allowed.test(ext);
    const mimeOk = allowed.test((file.mimetype || "").toLowerCase());
    if (extOk || mimeOk || !file.mimetype || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

module.exports = upload;
