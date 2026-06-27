import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

export const sql = neon(process.env.DB_URL as string);

// ────────────────────────────────────────────────────────────────
// AUTH & USER TABLES
// ────────────────────────────────────────────────────────────────
async function initAuthTables() {
  await sql`
    DO $$
    BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('jobseeker', 'recruiter');
       END IF;
    END$$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      role user_role NOT NULL,
      bio TEXT,
      resume VARCHAR(255),
      resume_public_id VARCHAR(255),
      profile_pic VARCHAR(255),
      profile_pic_public_id VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      subscription TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS skills (
      skill_id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      skill_id INTEGER NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, skill_id)
    )
  `;

  console.log("✅ Auth/User tables ready");
}

// ────────────────────────────────────────────────────────────────
// JOB TABLES
// ────────────────────────────────────────────────────────────────
async function initJobTables() {
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
    CREATE TABLE IF NOT EXISTS jobs (
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
    CREATE TABLE IF NOT EXISTS applications (
      application_id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
      applicant_id INTEGER NOT NULL,
      applicant_email VARCHAR(255) NOT NULL,
      status application_status NOT NULL DEFAULT 'Submitted',
      resume VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      subscribed BOOLEAN,
      overall_score NUMERIC(5,2) DEFAULT 0,
      skill_match_score NUMERIC(5,2) DEFAULT 0,
      assignment_score NUMERIC(5,2) DEFAULT 0,
      interview_score NUMERIC(5,2) DEFAULT 0,
      UNIQUE (job_id, applicant_id)
    )
  `;

  // Add ATS application stages if not already present
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

  await sql`
    CREATE TABLE IF NOT EXISTS quizzes (
      quiz_id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      question_id SERIAL PRIMARY KEY,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_answer_index INTEGER NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      attempt_id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
      score NUMERIC(5,2) NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (application_id)
    )
  `;

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

  console.log("✅ Job tables ready");
}

// ────────────────────────────────────────────────────────────────
// CHAT TABLES
// ────────────────────────────────────────────────────────────────
async function initChatTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL UNIQUE,
      applicant_id INTEGER NOT NULL,
      recruiter_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type_enum') THEN
        CREATE TYPE message_type_enum AS ENUM ('text', 'file', 'image');
      END IF;
    END$$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      message_id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      message_type message_type_enum NOT NULL DEFAULT 'text',
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, sender_id, is_read) WHERE is_read = false`;

  console.log("✅ Chat tables ready");
}

// ────────────────────────────────────────────────────────────────
// BLOG TABLES
// ────────────────────────────────────────────────────────────────
async function initBlogTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      author_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      tags TEXT[] DEFAULT '{}',
      cover_image VARCHAR(500),
      sections JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  console.log("✅ Blog tables ready");
}

// ────────────────────────────────────────────────────────────────
// RAG (pgvector) TABLES
// ────────────────────────────────────────────────────────────────
async function initRAGTables() {
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;

    await sql`
      CREATE TABLE IF NOT EXISTS resume_chunks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        section_type VARCHAR(50) DEFAULT 'other',
        embedding vector(384),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS resume_structured (
        user_id INTEGER PRIMARY KEY,
        skills TEXT[] DEFAULT '{}',
        experience_summary TEXT DEFAULT '',
        projects TEXT[] DEFAULT '{}',
        education TEXT DEFAULT '',
        full_text TEXT DEFAULT '',
        processed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_resume_chunks_embedding
      ON resume_chunks
      USING hnsw (embedding vector_cosine_ops)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_resume_chunks_user_id
      ON resume_chunks (user_id)
    `;

    console.log("✅ RAG tables ready (pgvector)");
  } catch (error) {
    console.error("⚠️  RAG tables init failed (pgvector may not be available):", error);
  }
}

// ────────────────────────────────────────────────────────────────
// MAIN INIT
// ────────────────────────────────────────────────────────────────
export async function initDB(): Promise<void> {
  try {
    await initAuthTables();
    await initJobTables();
    await initChatTables();
    await initBlogTables();
    await initRAGTables();
    console.log("✅ All database tables initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    process.exit(1);
  }
}
