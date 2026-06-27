import { Router } from "express";
import { isAuth } from "../../middleware/auth.js";
import {
  getConversations,
  getMessages,
  createConversation,
  markMessagesRead,
  getUnreadCount,
} from "./chat.controller.js";

const router = Router();

router.get("/conversations", isAuth, getConversations);
router.post("/conversations", isAuth, createConversation);
router.get("/conversations/:conversationId/messages", isAuth, getMessages);
router.put("/conversations/:conversationId/read", isAuth, markMessagesRead);
router.get("/unread", isAuth, getUnreadCount);

export default router;
