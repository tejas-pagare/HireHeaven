import { AuthenticatedRequest } from "../middlewares/auth.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/errorHandler.js";
import { TryCatch } from "../utils/TryCatch.js";

// Manually or AI created quiz - expects { questions: [{ text, options: [], correct_answer_index }] }
export const createQuiz = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user || user.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden: Only recruiter can create a quiz");
    }

    const { job_id, questions } = req.body;
    if (!job_id || !questions || !Array.isArray(questions)) {
        throw new ErrorHandler(400, "Job ID and questions array are required");
    }

    // Verify job belongs to recruiter
    const [job] = await sql`SELECT posted_by_recuriter_id FROM jobs WHERE job_id = ${job_id}`;
    if (!job || job.posted_by_recuriter_id !== user.user_id) {
        throw new ErrorHandler(403, "Forbidden or Job not found");
    }

    // Delete existing quiz for job if any (for simple replacement)
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

export const getQuizByJob = TryCatch(async (req: AuthenticatedRequest, res) => {
    const { job_id } = req.params;
    const [quiz] = await sql`SELECT * FROM quizzes WHERE job_id = ${job_id}`;
    if (!quiz) {
        throw new ErrorHandler(404, "Quiz not found for this job");
    }

    const questions = await sql`
    SELECT question_id, question_text, options, correct_answer_index FROM quiz_questions WHERE quiz_id = ${quiz.quiz_id}
  `;

    // If user is applicant, they shouldn't see correct_answer_index, but we'll include it for the client-side grading OR we can grade server-side.
    // Better to pass everything to simplify for now, or just hide it. Let's hide it if jobseeker? Actually let's just let the client send answers back to the server.

    if (req.user?.role === 'jobseeker') {
        const safeQuestions = questions.map(q => ({
            question_id: q.question_id,
            question_text: q.question_text,
            options: q.options
        }));
        return res.json({ quiz, questions: safeQuestions });
    }

    res.json({ quiz, questions });
});

export const submitQuizAttempt = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    const { application_id, answers } = req.body; // answers: { [question_id]: selected_option_index }

    if (!application_id || !answers) {
        throw new ErrorHandler(400, "Application ID and answers are required");
    }

    const [application] = await sql`SELECT * FROM applications WHERE application_id = ${application_id}`;
    if (!application || application.applicant_id !== user?.user_id) {
        throw new ErrorHandler(403, "Forbidden or application not found");
    }

    const [quiz] = await sql`SELECT * FROM quizzes WHERE job_id = ${application.job_id}`;
    if (!quiz) throw new ErrorHandler(404, "Quiz not found");

    const questions = await sql`SELECT question_id, correct_answer_index FROM quiz_questions WHERE quiz_id = ${quiz.quiz_id}`;

    let correct = 0;
    questions.forEach((q: any) => {
        if (answers[q.question_id] === q.correct_answer_index) {
            correct += 1;
        }
    });

    const rawScore = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    const score = Math.round(rawScore * 100) / 100;

    await sql`DELETE FROM quiz_attempts WHERE application_id = ${application_id}`;

    const [attempt] = await sql`
    INSERT INTO quiz_attempts (application_id, score) VALUES (${application_id}, ${score}) RETURNING *
  `;

    // Update application score and stage to 'Final Review'? Recruiter handles stage optionally. But update score.
    await sql`UPDATE applications SET assignment_score = ${score} WHERE application_id = ${application_id}`;

    res.json({ message: "Quiz submitted", score, attempt });
});
