import express from "express";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// Route modules
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import jobRoutes from "./modules/job/job.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import blogRoutes from "./modules/blog/blog.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";

dotenv.config();

// ── Cloudinary Config ──────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      // and any localhost port, plus the configured FRONTEND_URL
      const allowed = [
        process.env.FRONTEND_URL || "http://localhost:3000",
        "http://localhost:3000",
        "http://localhost:3001",
      ];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // permissive in dev — tighten in prod
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ── Health Check ───────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "OK", service: "Unified Backend", timestamp: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/job", jobRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/utils", aiRoutes);

export default app;
