import { sql } from "../../db.js";
import ErrorHandler from "../../utils/ErrorHandler.js";
import { TryCatch } from "../../utils/TryCatch.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

/** Statuses a round-scheduling action is allowed to bump the application
 *  past — prevents scheduling round 3 for a candidate already at Offer from
 *  wrongly regressing them back to "Interview". */
const STATUSES_ADVANCEABLE_TO_INTERVIEW = ["Submitted", "Screening"];

// ── Schedule Interview ────────────────────────────────────────────────────────
export const scheduleInterview = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== "recruiter") {
    throw new ErrorHandler(403, "Forbidden: Only recruiters can schedule interviews");
  }

  const { application_id, round_id, scheduled_at, meet_link } = req.body;
  if (!application_id || !scheduled_at || !meet_link) {
    throw new ErrorHandler(400, "Application ID, scheduled time, and meet link are required");
  }

  const [application] = await sql`SELECT * FROM applications WHERE application_id = ${application_id}`;
  if (!application) throw new ErrorHandler(404, "Application not found");

  const [job] = await sql`SELECT posted_by_recuriter_id FROM jobs WHERE job_id = ${application.job_id}`;
  if (!job || job.posted_by_recuriter_id !== user.user_id) {
    throw new ErrorHandler(403, "Forbidden or job not found");
  }

  if (round_id) {
    const [round] = await sql`SELECT round_id FROM job_rounds WHERE round_id = ${round_id} AND job_id = ${application.job_id}`;
    if (!round) throw new ErrorHandler(400, "That round does not belong to this job");
  }

  const [interview] = await sql`
    INSERT INTO interviews (application_id, round_id, scheduled_at, meet_link, interviewer_id)
    VALUES (${application_id}, ${round_id || null}, ${scheduled_at}, ${meet_link}, ${user.user_id})
    RETURNING *
  `;

  if (STATUSES_ADVANCEABLE_TO_INTERVIEW.includes(application.status)) {
    await sql`UPDATE applications SET status = 'Interview' WHERE application_id = ${application_id}`;
  }

  res.json({ message: "Interview scheduled successfully", interview });
});

// ── Cancel Interview ──────────────────────────────────────────────────────────
// Only for a scheduled-but-not-yet-evaluated round — once evaluated, the
// interview row is part of the permanent record.
export const cancelInterview = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== "recruiter") {
    throw new ErrorHandler(403, "Forbidden: Only recruiters can cancel interviews");
  }

  const { interviewId } = req.params;
  const [interview] = await sql`SELECT * FROM interviews WHERE interview_id = ${interviewId}`;
  if (!interview || interview.interviewer_id !== user.user_id) {
    throw new ErrorHandler(404, "Interview not found or not assigned to you");
  }

  const [evaluation] = await sql`SELECT evaluation_id FROM interview_evaluations WHERE interview_id = ${interviewId}`;
  if (evaluation) throw new ErrorHandler(409, "This round has already been evaluated and cannot be cancelled");

  await sql`DELETE FROM interviews WHERE interview_id = ${interviewId}`;
  res.json({ message: "Interview cancelled" });
});

// ── Evaluate Interview ────────────────────────────────────────────────────────
export const evaluateInterview = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== "recruiter") {
    throw new ErrorHandler(403, "Forbidden: Only recruiters can evaluate interviews");
  }

  const {
    interview_id,
    application_id,
    tech_rating,
    comm_rating,
    problem_solving_rating,
    culture_rating,
    feedback,
    decision,
  } = req.body;

  if ((!interview_id && !application_id) || !feedback || !tech_rating || !comm_rating || !problem_solving_rating || !culture_rating) {
    throw new ErrorHandler(400, "All rating fields, feedback, and interview_id (or application_id) are required");
  }
  if (decision && decision !== "passed" && decision !== "failed") {
    throw new ErrorHandler(400, "decision must be 'passed' or 'failed'");
  }

  // Prefer interview_id — an application can have multiple interview rows
  // once it has multiple rounds, so resolving it from application_id alone
  // would be ambiguous about which round is being evaluated. application_id
  // stays supported for the legacy single-interview flow (interview-modal.tsx,
  // used by jobs with no defined rounds), resolved to its LATEST attempt
  // rather than an arbitrary unordered row like the old behavior did.
  const [interview] = interview_id
    ? await sql`SELECT * FROM interviews WHERE interview_id = ${interview_id}`
    : await sql`SELECT * FROM interviews WHERE application_id = ${application_id} ORDER BY scheduled_at DESC, interview_id DESC LIMIT 1`;
  if (!interview || interview.interviewer_id !== user.user_id) {
    throw new ErrorHandler(404, "Interview not found or not assigned to you");
  }

  const [evaluation] = await sql`
    INSERT INTO interview_evaluations
      (interview_id, tech_rating, comm_rating, problem_solving_rating, culture_rating, feedback, decision)
    VALUES
      (${interview.interview_id}, ${tech_rating}, ${comm_rating}, ${problem_solving_rating}, ${culture_rating}, ${feedback}, ${decision || null})
    RETURNING *
  `;

  const averageRating = (tech_rating + comm_rating + problem_solving_rating + culture_rating) / 4;
  const interviewScore = (averageRating / 5) * 100;

  // Note: interview_score is a single column on applications, so evaluating
  // a later round overwrites the score from an earlier one rather than
  // aggregating them — acceptable for now, each round's own score/decision
  // is still preserved permanently on its own interview_evaluations row.
  await sql`UPDATE applications SET interview_score = ${interviewScore} WHERE application_id = ${interview.application_id}`;

  res.json({ message: "Interview evaluated successfully", evaluation, interviewScore });
});
