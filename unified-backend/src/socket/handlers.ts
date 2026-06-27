import { Server, Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import { sql } from "../db.js";
import redisClient from "../redis.js";
import { sendMail } from "../mailer.js";
import { chatNotificationTemplate } from "../utils/templates.js";

interface ChatSocket extends Socket {
  data: {
    userId: number;
    userName: string;
    userEmail: string;
    role: string;
  };
}

export function setupSocket(io: Server): void {
  // ── Auth Middleware ──────────────────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(token, process.env.JWT_SEC as string) as JwtPayload;
      if (!decoded?.id) return next(new Error("Invalid token"));

      const users = await sql`
        SELECT user_id, name, email, role FROM users WHERE user_id = ${decoded.id}
      `;
      if (users.length === 0) return next(new Error("User not found"));

      const user = users[0];
      socket.data.userId = user.user_id;
      socket.data.userName = user.name;
      socket.data.userEmail = user.email;
      socket.data.role = user.role;

      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  // ── Connection ───────────────────────────────────────────────────────────────
  io.on("connection", async (socket: ChatSocket) => {
    const userId = socket.data.userId;
    console.log(`🟢 User ${socket.data.userName} (${userId}) connected`);

    socket.join(`user:${userId}`);

    // Mark online (TTL: 5 min)
    try {
      await redisClient.set(`online:${userId}`, "true", { ex: 300 });
    } catch (err) {
      console.warn("⚠️  Redis: Could not set online status:", (err as Error).message);
    }

    socket.broadcast.emit("user-online", { userId });

    // ── Join Conversation Room ─────────────────────────────────────────────────
    socket.on("join-conversation", async (data: { conversationId: number }) => {
      try {
        const [conversation] = await sql`
          SELECT conversation_id FROM conversations
          WHERE conversation_id = ${data.conversationId}
            AND (applicant_id = ${userId} OR recruiter_id = ${userId})
        `;
        if (!conversation) {
          socket.emit("error", { message: "Not authorized for this conversation" });
          return;
        }
        socket.join(`conversation:${data.conversationId}`);
      } catch (err) {
        console.error("Error joining conversation:", err);
        socket.emit("error", { message: "Failed to join conversation" });
      }
    });

    // ── Leave Conversation Room ────────────────────────────────────────────────
    socket.on("leave-conversation", (data: { conversationId: number }) => {
      socket.leave(`conversation:${data.conversationId}`);
    });

    // ── Send Message ───────────────────────────────────────────────────────────
    socket.on(
      "send-message",
      async (data: { conversationId: number; content: string; type?: string }) => {
        try {
          const { conversationId, content, type = "text" } = data;
          if (!content?.trim()) {
            socket.emit("error", { message: "Message content is required" });
            return;
          }

          const [conversation] = await sql`
            SELECT conversation_id, applicant_id, recruiter_id, job_id
            FROM conversations
            WHERE conversation_id = ${conversationId}
              AND (applicant_id = ${userId} OR recruiter_id = ${userId})
          `;
          if (!conversation) {
            socket.emit("error", { message: "Not authorized" });
            return;
          }

          const [message] = await sql`
            INSERT INTO messages (conversation_id, sender_id, content, message_type)
            VALUES (${conversationId}, ${userId}, ${content.trim()}, ${type})
            RETURNING message_id, conversation_id, sender_id, content, message_type, is_read, created_at
          `;

          await sql`UPDATE conversations SET last_message_at = NOW() WHERE conversation_id = ${conversationId}`;

          const messageWithSender = { ...message, sender_name: socket.data.userName, sender_pic: null };

          // Broadcast to conversation room
          io.to(`conversation:${conversationId}`).emit("new-message", messageWithSender);

          // Notify recipient's personal room
          const recipientId =
            userId === conversation.applicant_id ? conversation.recruiter_id : conversation.applicant_id;
          io.to(`user:${recipientId}`).emit("new-message-notification", { conversationId, message: messageWithSender });

          // Send email if recipient is offline
          let isOnline = false;
          try {
            isOnline = !!(await redisClient.get(`online:${recipientId}`));
          } catch {
            // non-critical
          }

          if (!isOnline) {
            const [recipient] = await sql`SELECT email, name FROM users WHERE user_id = ${recipientId}`;
            const [job] = await sql`SELECT title FROM jobs WHERE job_id = ${conversation.job_id}`;

            if (recipient) {
              sendMail({
                to: recipient.email,
                subject: `New message from ${socket.data.userName} - HireHeaven`,
                html: chatNotificationTemplate(
                  socket.data.userName,
                  job?.title || "a job",
                  content,
                  conversationId
                ),
              }).catch((err) => console.warn("Chat email notification failed:", err));
            }
          }
        } catch (err) {
          console.error("Error sending message:", err);
          socket.emit("error", { message: "Failed to send message" });
        }
      }
    );

    // ── Typing Indicators ──────────────────────────────────────────────────────
    socket.on("typing", (data: { conversationId: number }) => {
      socket.to(`conversation:${data.conversationId}`).emit("user-typing", {
        conversationId: data.conversationId,
        userId,
        userName: socket.data.userName,
      });
    });

    socket.on("stop-typing", (data: { conversationId: number }) => {
      socket.to(`conversation:${data.conversationId}`).emit("user-stop-typing", {
        conversationId: data.conversationId,
        userId,
      });
    });

    // ── Mark Messages Read ─────────────────────────────────────────────────────
    socket.on("mark-read", async (data: { conversationId: number }) => {
      try {
        await sql`
          UPDATE messages SET is_read = true
          WHERE conversation_id = ${data.conversationId}
            AND sender_id != ${userId}
            AND is_read = false
        `;
        socket.to(`conversation:${data.conversationId}`).emit("messages-read", {
          conversationId: data.conversationId,
          readBy: userId,
        });
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    });

    // ── Heartbeat (refresh online TTL) ─────────────────────────────────────────
    socket.on("heartbeat", async () => {
      try {
        await redisClient.set(`online:${userId}`, "true", { ex: 300 });
      } catch {
        // non-critical
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`🔴 User ${socket.data.userName} (${userId}) disconnected`);
      try {
        await redisClient.del(`online:${userId}`);
      } catch {
        // non-critical
      }
      socket.broadcast.emit("user-offline", { userId });
    });
  });
}
