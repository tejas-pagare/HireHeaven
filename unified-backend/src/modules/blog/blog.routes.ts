import { Router } from "express";
import { isAuth } from "../../middleware/auth.js";
import {
  createPost,
  getAllPosts,
  getPostBySlug,
  updatePost,
  deletePost,
  getMyPosts,
} from "./post.controller.js";

const router = Router();

router.get("/", getAllPosts);
router.get("/mine", isAuth, getMyPosts);
router.get("/:slug", getPostBySlug);
router.post("/", isAuth, createPost);
router.put("/:id", isAuth, updatePost);
router.delete("/:id", isAuth, deletePost);

export default router;
