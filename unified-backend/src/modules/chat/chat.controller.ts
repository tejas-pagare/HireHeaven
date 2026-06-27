import { sql } from "../../db.js";
import ErrorHandler from "../../utils/ErrorHandler.js";
import { TryCatch } from "../../utils/TryCatch.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

// ── Get Conversations ─────────────────────────────────────────────────────────
export const getConversations = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const conversations = await sql`
    SELECT
      c.conversation_id, c.application_id, c.job_id, c.applicant_id, c.recruiter_id,
      c.last_message_at, c.created_at,
      j.title AS job_title,
      comp.name AS company_name, comp.logo AS company_logo,
      applicant_user.name AS applicant_name, applicant_user.profile_pic AS applicant_pic,
      recruiter_user.name AS recruiter_name, recruiter_user.profile_pic AS recruiter_pic,
      (
        SELECT COUNT(*)::int FROM messages m
        WHERE m.conversation_id = c.conversation_id
          AND m.sender_id != ${user.user_id}
          AND m.is_read = false
      ) AS unread_count,
      (
        SELECT content FROM messages m
        WHERE m.conversation_id = c.conversation_id
        ORDER BY m.created_at DESC LIMIT 1
      ) AS last_message
    FROM conversations c
    JOIN jobs j ON c.job_id = j.job_id
    JOIN companies comp ON j.company_id = comp.company_id
    JOIN users applicant_user ON c.applicant_id = applicant_user.user_id
    JOIN users recruiter_user ON c.recruiter_id = recruiter_user.user_id
    WHERE c.applicant_id = ${user.user_id} OR c.recruiter_id = ${user.user_id}
    ORDER BY c.last_message_at DESC NULLS LAST
  `;

  res.json(conversations);
});

// ── Get Messages (paginated) ──────────────────────────────────────────────────
export const getMessages = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const { conversationId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const [conversation] = await sql`
    SELECT conversation_id FROM conversations
    WHERE conversation_id = ${conversationId}
      AND (applicant_id = ${user.user_id} OR recruiter_id = ${user.user_id})
  `;
  if (!conversation) throw new ErrorHandler(403, "Not authorized to view this conversation");

  const messages = await sql`
    SELECT m.message_id, m.conversation_id, m.sender_id, m.content,
           m.message_type, m.is_read, m.created_at,
           u.name AS sender_name, u.profile_pic AS sender_pic
    FROM messages m
    JOIN users u ON m.sender_id = u.user_id
    WHERE m.conversation_id = ${conversationId}
    ORDER BY m.created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [{ total }] = await sql`
    SELECT COUNT(*)::int AS total FROM messages WHERE conversation_id = ${conversationId}
  `;

  res.json({ messages, page, limit, total, hasMore: offset + limit < total });
});

// ── Create Conversation ───────────────────────────────────────────────────────
export const createConversation = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const { application_id } = req.body;
  if (!application_id) throw new ErrorHandler(400, "application_id is required");

  const [application] = await sql`
    SELECT a.application_id, a.job_id, a.applicant_id, j.posted_by_recuriter_id AS recruiter_id
    FROM applications a
    JOIN jobs j ON a.job_id = j.job_id
    WHERE a.application_id = ${application_id}
  `;
  if (!application) throw new ErrorHandler(404, "Application not found");

  if (user.user_id !== application.applicant_id && user.user_id !== application.recruiter_id) {
    throw new ErrorHandler(403, "Not authorized to create this conversation");
  }

  const existing = await sql`SELECT * FROM conversations WHERE application_id = ${application_id}`;
  if (existing.length > 0) {
    res.json({ message: "Conversation already exists", conversation: existing[0] });
    return;
  }

  const [newConversation] = await sql`
    INSERT INTO conversations (application_id, applicant_id, recruiter_id, job_id)
    VALUES (${application.application_id}, ${application.applicant_id}, ${application.recruiter_id}, ${application.job_id})
    RETURNING *
  `;

  res.status(201).json({ message: "Conversation created", conversation: newConversation });
});

// ── Mark Messages Read ────────────────────────────────────────────────────────
export const markMessagesRead = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const { conversationId } = req.params;

  const [conversation] = await sql`
    SELECT conversation_id FROM conversations
    WHERE conversation_id = ${conversationId}
      AND (applicant_id = ${user.user_id} OR recruiter_id = ${user.user_id})
  `;
  if (!conversation) throw new ErrorHandler(403, "Not authorized");

  await sql`
    UPDATE messages SET is_read = true
    WHERE conversation_id = ${conversationId}
      AND sender_id != ${user.user_id}
      AND is_read = false
  `;

  res.json({ message: "Messages marked as read" });
});

// ── Get Unread Count ──────────────────────────────────────────────────────────
export const getUnreadCount = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) throw new ErrorHandler(401, "Authentication required");

  const [result] = await sql`
    SELECT COUNT(*)::int AS unread_count
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.conversation_id
    WHERE (c.applicant_id = ${user.user_id} OR c.recruiter_id = ${user.user_id})
      AND m.sender_id != ${user.user_id}
      AND m.is_read = false
  `;

  res.json({ unread_count: result.unread_count });
});
