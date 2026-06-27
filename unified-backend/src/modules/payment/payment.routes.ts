import { Router } from "express";
import { isAuth } from "../../middleware/auth.js";
import { checkOut, paymentVerification } from "./payment.controller.js";

const router = Router();

router.post("/checkout", isAuth, checkOut);
router.post("/verify", isAuth, paymentVerification);

export default router;
