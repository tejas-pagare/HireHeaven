import { AuthenticatedRequest } from "../middlewares/auth.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/errorHandler.js";
import { TryCatch } from "../utils/TryCatch.js";

export const scheduleInterview = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user || user.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden: Only recruiter can schedule an interview");
    }

    const { application_id, scheduled_at, meet_link } = req.body;
    if (!application_id || !scheduled_at || !meet_link) {
        throw new ErrorHandler(400, "Application ID, scheduled time, and meet link are required");
    }

    const [application] = await sql`SELECT * FROM applications WHERE application_id = ${application_id}`;
    if (!application) throw new ErrorHandler(404, "Application not found");

    const [job] = await sql`SELECT posted_by_recuriter_id FROM jobs WHERE job_id = ${application.job_id}`;
    if (!job || job.posted_by_recuriter_id !== user.user_id) {
        throw new ErrorHandler(403, "Forbidden or Job not found");
    }

    const [interview] = await sql`
    INSERT INTO interviews (application_id, scheduled_at, meet_link, interviewer_id)
    VALUES (${application_id}, ${scheduled_at}, ${meet_link}, ${user.user_id})
    RETURNING *
  `;

    // Update application stage to 'Interview'
    await sql`UPDATE applications SET status = 'Interview' WHERE application_id = ${application_id}`;

    res.json({ message: "Interview scheduled successfully", interview });
});

export const evaluateInterview = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user || user.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden: Only recruiter can evaluate an interview");
    }

    const { application_id, tech_rating, comm_rating, problem_solving_rating, culture_rating, feedback } = req.body;

    if (!application_id || !feedback || !tech_rating || !comm_rating || !problem_solving_rating || !culture_rating) {
        throw new ErrorHandler(400, "All rating fields, feedback, and application id are required");
    }

    const [interview] = await sql`SELECT * FROM interviews WHERE application_id = ${application_id}`;
    if (!interview || interview.interviewer_id !== user.user_id) {
        throw new ErrorHandler(404, "Interview not found or not assigned to you");
    }

    const [evaluation] = await sql`
    INSERT INTO interview_evaluations (interview_id, tech_rating, comm_rating, problem_solving_rating, culture_rating, feedback)
    VALUES (${interview.interview_id}, ${tech_rating}, ${comm_rating}, ${problem_solving_rating}, ${culture_rating}, ${feedback})
    RETURNING *
  `;

    // Calculate interview score: Average of 4 ratings converted to percentage (1-5 scale)
    const averageRating = (tech_rating + comm_rating + problem_solving_rating + culture_rating) / 4;
    const interviewScore = (averageRating / 5) * 100;

    // Update application interview_score
    await sql`UPDATE applications SET interview_score = ${interviewScore} WHERE application_id = ${interview.application_id}`;

    res.json({ message: "Interview evaluated successfully", evaluation, interviewScore });
});
