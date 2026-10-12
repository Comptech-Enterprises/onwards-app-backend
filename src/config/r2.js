const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const path = require("path");

const endpoint =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || "onward-app";
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

async function uploadToR2(fileBuffer, originalName, mimeType, folder = "photos") {
  const ext = path.extname(originalName || "") || ".bin";
  const key = `${folder}/${crypto.randomUUID()}${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  }));

  return `${PUBLIC_URL}/${key}`;
}

async function deleteFromR2(photoUrl) {
  const key = photoUrl.replace(`${PUBLIC_URL}/`, "");
  await r2.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

module.exports = { uploadToR2, deleteFromR2 };
