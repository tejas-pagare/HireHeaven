import { Router } from "express";
import { isAuth } from "../../middleware/auth.js";
import { upload } from "../../middleware/multer.js";
import {
  myProfile,
  getUserProfile,
  updateUserProfile,
  updateProfilePic,
  updateResume,
  addSkillToUser,
  deleteSkillFromUser,
  applyForJob,
  getAllApplications,
} from "./user.controller.js";

const router = Router();

router.get("/me", isAuth, myProfile);
router.get("/applications/me", isAuth, getAllApplications);
router.get("/:userId", getUserProfile);
router.put("/update", isAuth, updateUserProfile);
router.put("/update-pic", isAuth, upload.single("profilePic"), updateProfilePic);
router.put("/update-resume", isAuth, upload.single("resume"), updateResume);
router.post("/skill", isAuth, addSkillToUser);
router.delete("/skill", isAuth, deleteSkillFromUser);
router.post("/apply", isAuth, applyForJob);

export default router;
