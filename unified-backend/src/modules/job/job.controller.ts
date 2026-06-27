import cloudinary from "cloudinary";
import { sql } from "../../db.js";
import { sendMail } from "../../mailer.js";
import getBuffer from "../../utils/buffer.js";
import ErrorHandler from "../../utils/ErrorHandler.js";
import { TryCatch } from "../../utils/TryCatch.js";
import { applicationStatusUpdateTemplate } from "../../utils/templates.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

// ── Create Company ────────────────────────────────────────────────────────────
export const createCompany = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");
  if (user.role !== "recruiter") throw new ErrorHandler(403, "Forbidden: Only recruiters can create a company");

  const { name, description, website } = req.body;
  if (!name || !description || !website) throw new ErrorHandler(400, "All fields required");

  const existing = await sql`SELECT company_id FROM companies WHERE name = ${name}`;
  if (existing.length > 0) throw new ErrorHandler(409, `A company named '${name}' already exists`);

  const file = req.file;
  if (!file) throw new ErrorHandler(400, "Company logo is required");

  const fileBuffer = getBuffer(file);
  if (!fileBuffer?.content) throw new ErrorHandler(500, "Failed to create file buffer");

  const uploadResult = await cloudinary.v2.uploader.upload(fileBuffer.content as string);

  const [newCompany] = await sql`
    INSERT INTO companies (name, description, website, logo, logo_public_id, recruiter_id)
    VALUES (${name}, ${description}, ${website}, ${uploadResult.secure_url}, ${uploadResult.public_id}, ${user.user_id})
    RETURNING *
  `;

  res.json({ message: "Company created successfully", company: newCompany });
});

// ── Delete Company ────────────────────────────────────────────────────────────
export const deleteCompany = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  const { companyId } = req.params;

  const [company] = await sql`
    SELECT logo_public_id FROM companies
    WHERE company_id = ${companyId} AND recruiter_id = ${user?.user_id}
  `;
  if (!company) throw new ErrorHandler(404, "Company not found or not authorized");

  await sql`DELETE FROM companies WHERE company_id = ${companyId} AND recruiter_id = ${user?.user_id}`;
  res.json({ message: "Company and all associated jobs deleted" });
});

// ── Get All Companies (for recruiter) ─────────────────────────────────────────
export const getAllCompany = TryCatch(async (req: AuthenticatedRequest, res) => {
  const companies = await sql`
    SELECT * FROM companies WHERE recruiter_id = ${req.user?.user_id}
  `;
  res.json(companies);
});

// ── Get Company Details ───────────────────────────────────────────────────────
export const getCompanyDetails = TryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ErrorHandler(400, "Company id is required");

  const [companyData] = await sql`
    SELECT c.*, COALESCE((
      SELECT json_agg(j.*) FROM jobs j WHERE j.company_id = c.company_id
    ), '[]'::json) AS jobs
    FROM companies c WHERE c.company_id = ${id}
    GROUP BY c.company_id
  `;

  if (!companyData) throw new ErrorHandler(404, "Company not found");
  res.json(companyData);
});

// ── Create Job ────────────────────────────────────────────────────────────────
export const createJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");
  if (user.role !== "recruiter") throw new ErrorHandler(403, "Forbidden: Only recruiters can post jobs");

  const { title, description, salary, location, role, job_type, work_location, company_id, openings } = req.body;
  if (!title || !description || !salary || !location || !role || !openings) {
    throw new ErrorHandler(400, "All fields required");
  }

  const [company] = await sql`
    SELECT company_id FROM companies
    WHERE company_id = ${company_id} AND recruiter_id = ${user.user_id}
  `;
  if (!company) throw new ErrorHandler(404, "Company not found");

  const [newJob] = await sql`
    INSERT INTO jobs (title, description, salary, location, role, job_type, work_location, company_id, posted_by_recuriter_id, openings)
    VALUES (${title}, ${description}, ${salary}, ${location}, ${role}, ${job_type}, ${work_location}, ${company_id}, ${user.user_id}, ${openings})
    RETURNING *
  `;

  res.json({ message: "Job posted successfully", job: newJob });
});

// ── Update Job ────────────────────────────────────────────────────────────────
export const updateJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");
  if (user.role !== "recruiter") throw new ErrorHandler(403, "Forbidden");

  const { title, description, salary, location, role, job_type, work_location, openings, is_active } = req.body;

  const [existingJob] = await sql`SELECT posted_by_recuriter_id FROM jobs WHERE job_id = ${req.params.jobId}`;
  if (!existingJob) throw new ErrorHandler(404, "Job not found");
  if (existingJob.posted_by_recuriter_id !== user.user_id) throw new ErrorHandler(403, "Forbidden");

  const [updatedJob] = await sql`
    UPDATE jobs SET
      title = ${title},
      description = ${description},
      salary = ${salary},
      location = ${location},
      role = ${role},
      job_type = ${job_type},
      work_location = ${work_location},
      openings = ${openings},
      is_active = ${is_active}
    WHERE job_id = ${req.params.jobId}
    RETURNING *
  `;

  res.json({ message: "Job updated successfully", job: updatedJob });
});

// ── Get All Active Jobs ───────────────────────────────────────────────────────
export const getAllActiveJobs = TryCatch(async (req, res) => {
  const { title, location } = req.query as { title?: string; location?: string };

  let jobs;
  if (title && location) {
    jobs = await sql`
      SELECT j.job_id, j.title, j.description, j.salary, j.location, j.job_type, j.role,
             j.work_location, j.created_at, c.name AS company_name, c.logo AS company_logo, c.company_id
      FROM jobs j JOIN companies c ON j.company_id = c.company_id
      WHERE j.is_active = true
        AND j.title ILIKE ${'%' + title + '%'}
        AND j.location ILIKE ${'%' + location + '%'}
      ORDER BY j.created_at DESC
    `;
  } else if (title) {
    jobs = await sql`
      SELECT j.job_id, j.title, j.description, j.salary, j.location, j.job_type, j.role,
             j.work_location, j.created_at, c.name AS company_name, c.logo AS company_logo, c.company_id
      FROM jobs j JOIN companies c ON j.company_id = c.company_id
      WHERE j.is_active = true AND j.title ILIKE ${'%' + title + '%'}
      ORDER BY j.created_at DESC
    `;
  } else if (location) {
    jobs = await sql`
      SELECT j.job_id, j.title, j.description, j.salary, j.location, j.job_type, j.role,
             j.work_location, j.created_at, c.name AS company_name, c.logo AS company_logo, c.company_id
      FROM jobs j JOIN companies c ON j.company_id = c.company_id
      WHERE j.is_active = true AND j.location ILIKE ${'%' + location + '%'}
      ORDER BY j.created_at DESC
    `;
  } else {
    jobs = await sql`
      SELECT j.job_id, j.title, j.description, j.salary, j.location, j.job_type, j.role,
             j.work_location, j.created_at, c.name AS company_name, c.logo AS company_logo, c.company_id
      FROM jobs j JOIN companies c ON j.company_id = c.company_id
      WHERE j.is_active = true
      ORDER BY j.created_at DESC
    `;
  }

  res.json(jobs);
});

// ── Get Single Job ────────────────────────────────────────────────────────────
export const getSingleJob = TryCatch(async (req, res) => {
  const [job] = await sql`SELECT * FROM jobs WHERE job_id = ${req.params.jobId}`;
  if (!job) throw new ErrorHandler(404, "Job not found");
  res.json(job);
});

// ── Get All Applications for a Job ────────────────────────────────────────────
export const getAllApplicationsForJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");
  if (user.role !== "recruiter") throw new ErrorHandler(403, "Forbidden: Only recruiters can access this");

  const { jobId } = req.params;

  const [job] = await sql`SELECT posted_by_recuriter_id FROM jobs WHERE job_id = ${jobId}`;
  if (!job) throw new ErrorHandler(404, "Job not found");
  if (job.posted_by_recuriter_id !== user.user_id) throw new ErrorHandler(403, "Forbidden");

  const applications = await sql`
    SELECT * FROM applications WHERE job_id = ${jobId}
    ORDER BY subscribed DESC, applied_at ASC
  `;

  res.json(applications);
});

// ── Update Application Status ─────────────────────────────────────────────────
export const updateApplication = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");
  if (user.role !== "recruiter") throw new ErrorHandler(403, "Forbidden");

  const { id } = req.params;
  const [application] = await sql`SELECT * FROM applications WHERE application_id = ${id}`;
  if (!application) throw new ErrorHandler(404, "Application not found");

  const [job] = await sql`
    SELECT posted_by_recuriter_id, title FROM jobs WHERE job_id = ${application.job_id}
  `;
  if (!job) throw new ErrorHandler(404, "Job not found");
  if (job.posted_by_recuriter_id !== user.user_id) throw new ErrorHandler(403, "Forbidden");

  const [updatedApplication] = await sql`
    UPDATE applications SET status = ${req.body.status}
    WHERE application_id = ${id}
    RETURNING *
  `;

  // Send email directly — no Kafka
  sendMail({
    to: application.applicant_email,
    subject: "Application Update - HireHeaven",
    html: applicationStatusUpdateTemplate(job.title),
  }).catch((err) => console.error("Failed to send application update email:", err));

  res.json({ message: "Application updated", job, updatedApplication });
});
