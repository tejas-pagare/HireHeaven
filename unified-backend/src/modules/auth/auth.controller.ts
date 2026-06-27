import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cloudinary from "cloudinary";
import { sql } from "../../db.js";
import { sendMail } from "../../mailer.js";
import redisClient from "../../redis.js";
import getBuffer from "../../utils/buffer.js";
import ErrorHandler from "../../utils/ErrorHandler.js";
import { TryCatch } from "../../utils/TryCatch.js";
import { forgotPasswordTemplate } from "../../utils/templates.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

// ── Register ──────────────────────────────────────────────────────────────────
export const registerUser = TryCatch(async (req, res) => {
  const { name, email, password, phoneNumber, role, bio } = req.body;

  if (!name || !email || !password || !phoneNumber || !role) {
    throw new ErrorHandler(400, "Please fill all details");
  }

  const existingUsers = await sql`SELECT user_id FROM users WHERE email = ${email}`;
  if (existingUsers.length > 0) {
    throw new ErrorHandler(409, "User with this email already exists");
  }

  const hashPassword = await bcrypt.hash(password, 10);
  let registeredUser;

  if (role === "recruiter") {
    const [user] = await sql`
      INSERT INTO users (name, email, password, phone_number, role)
      VALUES (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role})
      RETURNING user_id, name, email, phone_number, role, created_at
    `;
    registeredUser = user;
  } else if (role === "jobseeker") {
    const file = req.file;
    if (!file) throw new ErrorHandler(400, "Resume file is required for jobseekers");

    const fileBuffer = getBuffer(file);
    if (!fileBuffer?.content) throw new ErrorHandler(500, "Failed to generate buffer");

    const uploadResult = await cloudinary.v2.uploader.upload(fileBuffer.content as string);

    const [user] = await sql`
      INSERT INTO users (name, email, password, phone_number, role, bio, resume, resume_public_id)
      VALUES (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}, ${bio}, ${uploadResult.secure_url}, ${uploadResult.public_id})
      RETURNING user_id, name, email, phone_number, role, bio, resume, created_at
    `;
    registeredUser = user;
  }

  const token = jwt.sign(
    { id: registeredUser?.user_id },
    process.env.JWT_SEC as string,
    { expiresIn: "15d" }
  );

  res.json({ message: "User registered", registeredUser, token });
});

// ── Login ─────────────────────────────────────────────────────────────────────
export const loginUser = TryCatch(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ErrorHandler(400, "Please fill all details");

  const users = await sql`
    SELECT u.user_id, u.name, u.email, u.password, u.phone_number, u.role,
           u.bio, u.resume, u.profile_pic, u.subscription,
           ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) AS skills
    FROM users u
    LEFT JOIN user_skills us ON u.user_id = us.user_id
    LEFT JOIN skills s ON us.skill_id = s.skill_id
    WHERE u.email = ${email}
    GROUP BY u.user_id, u.name, u.email, u.password, u.phone_number,
             u.role, u.bio, u.resume, u.profile_pic, u.subscription
  `;

  if (users.length === 0) throw new ErrorHandler(400, "Invalid credentials");

  const userObject = users[0];
  const matchPassword = await bcrypt.compare(password, userObject.password);
  if (!matchPassword) throw new ErrorHandler(400, "Invalid credentials");

  userObject.skills = userObject.skills || [];
  delete userObject.password;

  const token = jwt.sign(
    { id: userObject.user_id },
    process.env.JWT_SEC as string,
    { expiresIn: "15d" }
  );

  res.json({ message: "User logged in", userObject, token });
});

// ── Forgot Password ───────────────────────────────────────────────────────────
export const forgotPassword = TryCatch(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ErrorHandler(400, "Email is required");

  const users = await sql`SELECT user_id, email FROM users WHERE email = ${email}`;

  if (users.length === 0) {
    return res.json({ message: "If that email exists, we have sent a reset link" });
  }

  const user = users[0];
  const resetToken = jwt.sign(
    { email: user.email, type: "reset" },
    process.env.JWT_SEC as string,
    { expiresIn: "15m" }
  );

  const resetLink = `${process.env.Frontend_Url}/reset/${resetToken}`;

  // Cache token in Redis (TTL: 15 minutes)
  await redisClient.set(`forgot:${email}`, resetToken, { ex: 900 });

  // Send email directly — no Kafka
  sendMail({
    to: email,
    subject: "RESET Your Password - HireHeaven",
    html: forgotPasswordTemplate(resetLink),
  }).catch((err) => console.error("Failed to send reset email:", err));

  res.json({ message: "If that email exists, we have sent a reset link" });
});

// ── Reset Password ────────────────────────────────────────────────────────────
export const resetPassword = TryCatch(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SEC as string);
  } catch {
    throw new ErrorHandler(400, "Expired token");
  }

  if (decoded.type !== "reset") throw new ErrorHandler(400, "Invalid token type");

  const email = decoded.email;
  const storedToken = await redisClient.get(`forgot:${email}`);

  if (!storedToken || storedToken !== token) {
    throw new ErrorHandler(400, "Token has been expired");
  }

  const users = await sql`SELECT user_id FROM users WHERE email = ${email}`;
  if (users.length === 0) throw new ErrorHandler(404, "User not found");

  const hashPassword = await bcrypt.hash(password, 10);
  await sql`UPDATE users SET password = ${hashPassword} WHERE user_id = ${users[0].user_id}`;
  await redisClient.del(`forgot:${email}`);

  res.json({ message: "Password changed successfully" });
});
