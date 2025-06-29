// utils/minio.js
const { Client } = require("minio");

const client = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "minio",
  port: parseInt(process.env.MINIO_PORT || "9000", 10),
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD
});

async function ensureBucket(bucket = MINIO_BUCKET) {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
    console.log(`✅ Created MinIO bucket: ${bucket}`);
  }
}

module.exports = { client, ensureBucket };
