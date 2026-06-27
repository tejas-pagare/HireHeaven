import cloudinary from "cloudinary";
import { sql } from "../../db.js";
import getBuffer from "../../utils/buffer.js";
import ErrorHandler from "../../utils/ErrorHandler.js";
import { TryCatch } from "../../utils/TryCatch.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { processResume } from "../ai/resume-rag.js";

// ── My Profile ────────────────────────────────────────────────────────────────
export const myProfile = TryCatch(async (req: AuthenticatedRequest, res) => {
  res.json(req.user);
});

// ── Get User Profile (public) ─────────────────────────────────────────────────
export const getUserProfile = TryCatch(async (req, res) => {
  const { userId } = req.params;

  const users = await sql`
    SELECT u.user_id, u.name, u.email, u.phone_number, u.role, u.bio,
           u.resume, u.resume_public_id, u.profile_pic, u.profile_pic_public_id, u.subscription,
           ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) AS skills
    FROM users u
    LEFT JOIN user_skills us ON u.user_id = us.user_id
    LEFT JOIN skills s ON us.skill_id = s.skill_id
    WHERE u.user_id = ${userId}
    GROUP BY u.user_id
  `;

  if (users.length === 0) throw new ErrorHandler(404, "User not found");

  const user = users[0];
  user.skills = user.skills || [];
  res.json(user);
});

// ── Update User Profile ───────────────────────────────────────────────────────
export const updateUserProfile = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const { name, phoneNumber, bio } = req.body;

  const [updatedUser] = await sql`
    UPDATE users SET
      name = ${name || user.name},
      phone_number = ${phoneNumber || user.phone_number},
      bio = ${bio || user.bio}
    WHERE user_id = ${user.user_id}
    RETURNING user_id, name, email, phone_number, bio
  `;

  res.json({ message: "Profile updated successfully", updatedUser });
});

// ── Update Profile Picture ────────────────────────────────────────────────────
export const updateProfilePic = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const file = req.file;
  if (!file) throw new ErrorHandler(400, "No image file provided");

  const fileBuffer = getBuffer(file);
  if (!fileBuffer?.content) throw new ErrorHandler(500, "Failed to generate buffer");

  const uploadResult = await cloudinary.v2.uploader.upload(fileBuffer.content as string, {
    public_id: user.profile_pic_public_id || undefined,
    invalidate: !!user.profile_pic_public_id,
  });

  const [updatedUser] = await sql`
    UPDATE users SET profile_pic = ${uploadResult.secure_url}, profile_pic_public_id = ${uploadResult.public_id} WHERE user_id = ${user.user_id} RETURNING user_id, name, profile_pic;
    `;

  res.json({ message: "Profile picture updated", updatedUser });
});

// ── Update Resume ─────────────────────────────────────────────────────────────
export const updateResume = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const file = req.file;
  if (!file) throw new ErrorHandler(400, "No PDF file provided");

  const fileBuffer = getBuffer(file);
  if (!fileBuffer?.content) throw new ErrorHandler(500, "Failed to generate buffer");

  const uploadResult = await cloudinary.v2.uploader.upload(fileBuffer.content as string, {
    public_id: user.resume_public_id || undefined,
    invalidate: !!user.resume_public_id,
    resource_type: "raw",
  });

  const [updatedUser] = await sql`
    UPDATE users SET resume = ${uploadResult.secure_url}, resume_public_id = ${uploadResult.public_id} WHERE user_id = ${user.user_id} RETURNING user_id, name, resume;
    `;

  // Auto-index resume for RAG (fire-and-forget — calls processResume directly in-process)
  processResume(user.user_id, file.buffer)
    .then(() => console.log(`✅ Resume auto-indexed for user ${user.user_id}`))
    .catch((err: any) =>
      console.warn(`⚠️  Resume auto-index failed for user ${user.user_id}:`, err?.message)
    );

  res.json({ message: "Resume updated", updatedUser });
});

// ── Add Skill ─────────────────────────────────────────────────────────────────
export const addSkillToUser = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.user_id;
  const { skillName } = req.body;

  if (!skillName || skillName.trim() === "") {
    throw new ErrorHandler(400, "Please provide a skill name");
  }

  const users = await sql`SELECT user_id FROM users WHERE user_id = ${userId}`;
  if (users.length === 0) throw new ErrorHandler(404, "User not found");

  const [skill] = await sql`
    INSERT INTO skills (name) VALUES (${skillName.trim()})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING skill_id
  `;

  const insertionResult = await sql`
    INSERT INTO user_skills (user_id, skill_id)
    VALUES (${userId}, ${skill.skill_id})
    ON CONFLICT (user_id, skill_id) DO NOTHING
    RETURNING user_id
  `;

  if (insertionResult.length === 0) {
    return res.status(200).json({ message: "User already possesses this skill" });
  }

  res.json({ message: `Skill ${skillName.trim()} added successfully` });
});

// ── Delete Skill ──────────────────────────────────────────────────────────────
export const deleteSkillFromUser = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const { skillName } = req.body;
  if (!skillName || skillName.trim() === "") {
    throw new ErrorHandler(400, "Please provide a skill name");
  }

  const result = await sql`
    DELETE FROM user_skills
    WHERE user_id = ${user.user_id}
      AND skill_id = (SELECT skill_id FROM skills WHERE name = ${skillName.trim()})
    RETURNING user_id
  `;

  if (result.length === 0) {
    throw new ErrorHandler(404, `Skill ${skillName.trim()} was not found`);
  }

  res.json({ message: `Skill ${skillName.trim()} deleted successfully` });
});

// ── Apply for Job ─────────────────────────────────────────────────────────────
export const applyForJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");
  if (user.role !== "jobseeker") throw new ErrorHandler(403, "Forbidden: Only jobseekers can apply");

  if (!user.resume) {
    throw new ErrorHandler(400, "Add a resume to your profile before applying");
  }

  const { job_id } = req.body;
  if (!job_id) throw new ErrorHandler(400, "job_id is required");

  const [job] = await sql`SELECT is_active FROM jobs WHERE job_id = ${job_id}`;
  if (!job) throw new ErrorHandler(404, "No job with this id");
  if (!job.is_active) throw new ErrorHandler(400, "Job is not active");

  const now = Date.now();
  const subTime = user.subscription ? new Date(user.subscription).getTime() : 0;
  const isSubscribed = subTime > now;

  let newApplication;
  try {
    [newApplication] = await sql`
      INSERT INTO applications (job_id, applicant_id, applicant_email, resume, subscribed)
      VALUES (${job_id}, ${user.user_id}, ${user.email}, ${user.resume}, ${isSubscribed})
      RETURNING *
    `;
  } catch (error: any) {
    if (error.code === "23505") throw new ErrorHandler(409, "You have already applied to this job");
    throw error;
  }

  res.json({ message: "Applied for job successfully", application: newApplication });
});

// ── Get All My Applications ───────────────────────────────────────────────────
export const getAllApplications = TryCatch(async (req: AuthenticatedRequest, res) => {
  const applications = await sql`
    SELECT a.*, j.title AS job_title, j.salary AS job_salary, j.location AS job_location,
           i.meet_link, i.scheduled_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.job_id
    LEFT JOIN interviews i ON a.application_id = i.application_id
    WHERE a.applicant_id = ${req.user?.user_id}
  `;

  res.json(applications);
});
