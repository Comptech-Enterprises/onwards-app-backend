const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
  fileFilter(req, file, cb) {
    const allowed = /jpeg|jpg|png|webp|gif|heic|heif|pdf/;
    const ext = path.extname(file.originalname || "").toLowerCase().replace(/^\./, "");
    const extOk = allowed.test(ext);
    const mimeOk = allowed.test((file.mimetype || "").toLowerCase()) || (file.mimetype || "").toLowerCase().includes("pdf") || (file.mimetype || "").toLowerCase().startsWith("image/");
    if (extOk || mimeOk || !file.mimetype || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPG, PNG, WEBP, etc.) and PDF documents are allowed."), false);
    }
  },
});

module.exports = upload;
