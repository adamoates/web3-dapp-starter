// app.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const { Pool } = require("pg");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { client: minioClient, ensureBucket } = require("./utils/minio");

const app = express();
app.use(cors());
app.use(express.json());

// Redis
const redis = new Redis({ host: "redis", port: 6379 });

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => console.error("Mongo error:", err));

// Postgres
const pool = new Pool({ connectionString: process.env.POSTGRES_URI });
pool
  .connect()
  .then(() => {
    console.log("✅ Postgres connected");
  })
  .catch((err) => console.error("Postgres error:", err));

// Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "mailpit",
  port: parseInt(process.env.MAIL_PORT || "1025", 10),
  secure: false,
  auth: process.env.MAIL_USERNAME
    ? { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD }
    : undefined
});

// Routes
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: Date.now() })
);
app.get("/ping", (req, res) => res.send("pong"));
app.get("/mongo-status", async (req, res) => {
  const stats = await mongoose.connection.db.stats();
  res.json(stats);
});
app.get("/postgres-status", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows[0]);
});
app.get("/cache-test", async (req, res) => {
  await redis.set("message", "Web3 is fast!");
  const value = await redis.get("message");
  res.send(`✅ Redis says: ${value}`);
});
app.get("/test-email", async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"Dapp Mail" <${process.env.MAIL_FROM}>`,
      to: process.env.TEST_EMAIL_TO,
      subject: "Test Email from Dapp Backend ✔",
      text: "🚀 This is a test email sent from your Web3 backend."
    });
    res.json({ message: "✅ Email sent", info });
  } catch (error) {
    console.error("❌ Email send error:", error);
    res
      .status(500)
      .json({ error: "Failed to send email", detail: error.message });
  }
});
app.get("/minio-status", async (req, res) => {
  const bucket = process.env.MINIO_BUCKET || "dapp";
  try {
    await ensureBucket(bucket);
    const exists = await minioClient.bucketExists(bucket);
    res.json({ bucket, exists, status: "ok" });
  } catch (err) {
    console.error("❌ MinIO error:", err.message);
    res
      .status(500)
      .json({ error: "MinIO connection failed", detail: err.message });
  }
});

module.exports = app;
