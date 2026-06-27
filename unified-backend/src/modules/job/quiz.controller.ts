import { sql } from "../../db.js";
import ErrorHandler from "../../utils/ErrorHandler.js";
import { TryCatch } from "../../utils/TryCatch.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

// ── Create Quiz ───────────────────────────────────────────────────────────────
export const createQuiz = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== "recruiter") {
    throw new ErrorHandler(403, "Forbidden: Only recruiters can create quizzes");
  }

  const { job_id, questions } = req.body;
  if (!job_id || !questions || !Array.isArray(questions)) {
    throw new ErrorHandler(400, "job_id and questions array are required");
  }

  const [job] = await sql`SELECT posted_by_recuriter_id FROM jobs WHERE job_id = ${job_id}`;
  if (!job || job.posted_by_recuriter_id !== user.user_id) {
    throw new ErrorHandler(403, "Forbidden or job not found");
  }

  // Replace existing quiz
  await sql`DELETE FROM quizzes WHERE job_id = ${job_id}`;
  const [quiz] = await sql`INSERT INTO quizzes (job_id) VALUES (${job_id}) RETURNING *`;

  for (const q of questions) {
    await sql`
      INSERT INTO quiz_questions (quiz_id, question_text, options, correct_answer_index)
      VALUES (${quiz.quiz_id}, ${q.text}, ${JSON.stringify(q.options)}, ${q.correct_answer_index})
    `;
  }

  res.json({ message: "Quiz created successfully", quiz_id: quiz.quiz_id });
});

// ── Get Quiz by Job ───────────────────────────────────────────────────────────
export const getQuizByJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const { job_id } = req.params;

  const [quiz] = await sql`SELECT * FROM quizzes WHERE job_id = ${job_id}`;
  if (!quiz) throw new ErrorHandler(404, "Quiz not found for this job");

  const questions = await sql`
    SELECT question_id, question_text, options, correct_answer_index
    FROM quiz_questions WHERE quiz_id = ${quiz.quiz_id}
  `;

  // Hide correct answer for jobseekers
  if (req.user?.role === "jobseeker") {
    const safeQuestions = questions.map((q) => ({
      question_id: q.question_id,
      question_text: q.question_text,
      options: q.options,
    }));
    return res.json({ quiz, questions: safeQuestions });
  }

  res.json({ quiz, questions });
});

// ── Submit Quiz Attempt ───────────────────────────────────────────────────────
export const submitQuizAttempt = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  const { application_id, answers } = req.body;

  if (!application_id || !answers) {
    throw new ErrorHandler(400, "application_id and answers are required");
  }

  const [application] = await sql`SELECT * FROM applications WHERE application_id = ${application_id}`;
  if (!application || application.applicant_id !== user?.user_id) {
    throw new ErrorHandler(403, "Forbidden or application not found");
  }

  const [quiz] = await sql`SELECT * FROM quizzes WHERE job_id = ${application.job_id}`;
  if (!quiz) throw new ErrorHandler(404, "Quiz not found");

  const questions = await sql`
    SELECT question_id, correct_answer_index FROM quiz_questions WHERE quiz_id = ${quiz.quiz_id}
  `;

  let correct = 0;
  questions.forEach((q: any) => {
    if (answers[q.question_id] === q.correct_answer_index) correct += 1;
  });

  const score = questions.length > 0 ? Math.round((correct / questions.length) * 10000) / 100 : 0;

  await sql`DELETE FROM quiz_attempts WHERE application_id = ${application_id}`;
  const [attempt] = await sql`
    INSERT INTO quiz_attempts (application_id, score) VALUES (${application_id}, ${score}) RETURNING *
  `;

  await sql`UPDATE applications SET assignment_score = ${score} WHERE application_id = ${application_id}`;

  res.json({ message: "Quiz submitted", score, attempt });
});
