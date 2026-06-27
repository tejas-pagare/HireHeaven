import { Router } from "express";
import { upload } from "../../middleware/multer.js";
import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
} from "./auth.controller.js";

const router = Router();

router.post("/register", upload.single("resume"), registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

export default router;
