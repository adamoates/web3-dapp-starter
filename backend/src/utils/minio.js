// utils/minio.js
const { Client } = require("minio");

let client = null;

function getClient() {
  if (!client) {
    client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "minio",
      port: parseInt(process.env.MINIO_PORT || "9000", 10),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin"
    });
  }
  return client;
}

async function ensureBucket(bucket = process.env.MINIO_BUCKET) {
  const minioClient = getClient();
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
    console.log(`✅ Created MinIO bucket: ${bucket}`);
  }
}

module.exports = { getClient, ensureBucket };
