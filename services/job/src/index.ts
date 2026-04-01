import app from "./app.js";
import dotenv from "dotenv";
import { sql } from "./utils/db.js";
import { connectKafka } from "./producer.js";

dotenv.config();

connectKafka();

async function initDB() {
  try {
    await sql`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_type') THEN 
        CREATE TYPE job_type AS ENUM ('Full-time', 'Part-time', 'Contract', 'Internship');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_location') THEN 
        CREATE TYPE work_location AS ENUM ('On-site', 'Remote', 'Hybrid');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN 
        CREATE TYPE application_status AS ENUM ('Submitted', 'Rejected', 'Hired');
        END IF;
    END$$;
    `;

    await sql`
    CREATE TABLE IF NOT EXISTS companies (
    company_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    website VARCHAR(255) NOT NULL,
    logo VARCHAR(255) NOT NULL,
    logo_public_id VARCHAR(255) NOT NULL,
    recruiter_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `;

    await sql`
    CREATE TABLE IF NOT EXISTS jobs(
    job_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    salary NUMERIC(10,2),
    location VARCHAR(255),
    job_type job_type NOT NULL,
    openings NUMERIC(3,1) NOT NULL,
    role VARCHAR(255) NOT NULL,
    work_location work_location NOT NULL,
    company_id INTEGER NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    posted_by_recuriter_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
    )
    `;

    await sql`
    CREATE TABLE IF NOT EXISTS applications(
    application_id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    applicant_id INTEGER NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,
    status application_status NOT NULL DEFAULT 'Submitted',
    resume VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subscribed BOOLEAN,
    UNIQUE (job_id, applicant_id)
    )
    `;

    // --- Smart ATS Migrations ---
    // Alter ENUM to add new stages if they don't exist
    await sql`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Screening' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'application_status')) THEN
            ALTER TYPE application_status ADD VALUE 'Screening';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Interview' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'application_status')) THEN
            ALTER TYPE application_status ADD VALUE 'Interview';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Assignment' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'application_status')) THEN
            ALTER TYPE application_status ADD VALUE 'Assignment';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Final Review' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'application_status')) THEN
            ALTER TYPE application_status ADD VALUE 'Final Review';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Offer' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'application_status')) THEN
            ALTER TYPE application_status ADD VALUE 'Offer';
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    `;

    // Alter applications table to add scores if they don't exist
    await sql`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='overall_score') THEN
            ALTER TABLE applications ADD COLUMN overall_score NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE applications ADD COLUMN skill_match_score NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE applications ADD COLUMN assignment_score NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE applications ADD COLUMN interview_score NUMERIC(5,2) DEFAULT 0;
        END IF;
    END $$;
    `;

    // Quizzes table
    await sql`
    CREATE TABLE IF NOT EXISTS quizzes (
        quiz_id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `;

    // Quiz Questions table
    await sql`
    CREATE TABLE IF NOT EXISTS quiz_questions (
        question_id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer_index INTEGER NOT NULL
    )
    `;

    // Quiz Attempts table
    await sql`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
        attempt_id SERIAL PRIMARY KEY,
        application_id INTEGER NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
        score NUMERIC(5,2) NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (application_id)
    )
    `;

    // Interviews table
    await sql`
    CREATE TABLE IF NOT EXISTS interviews (
        interview_id SERIAL PRIMARY KEY,
        application_id INTEGER NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
        scheduled_at TIMESTAMPTZ NOT NULL,
        meet_link VARCHAR(255) NOT NULL,
        interviewer_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `;

    // Interview Evaluations table
    await sql`
    CREATE TABLE IF NOT EXISTS interview_evaluations (
        evaluation_id SERIAL PRIMARY KEY,
        interview_id INTEGER NOT NULL REFERENCES interviews(interview_id) ON DELETE CASCADE,
        tech_rating INTEGER NOT NULL CHECK (tech_rating >= 1 AND tech_rating <= 5),
        comm_rating INTEGER NOT NULL CHECK (comm_rating >= 1 AND comm_rating <= 5),
        problem_solving_rating INTEGER NOT NULL CHECK (problem_solving_rating >= 1 AND problem_solving_rating <= 5),
        culture_rating INTEGER NOT NULL CHECK (culture_rating >= 1 AND culture_rating <= 5),
        feedback TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (interview_id)
    )
    `;

    console.log(
      "Job service database tables checked and created successfully."
    );
  } catch (error) {
    console.log("Error while creating tables", error);
    process.exit(1);
  }
}

initDB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(
      `Job service is running on http://localhost:${process.env.PORT}`
    );
  });
});

