import crypto from "crypto";
import Razorpay from "razorpay";
import { sql } from "../../db.js";
import ErrorHandler from "../../utils/ErrorHandler.js";
import { TryCatch } from "../../utils/TryCatch.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import dotenv from "dotenv";

dotenv.config();

export const razorpay = new Razorpay({
  key_id: process.env.Razorpay_Key!,
  key_secret: process.env.Razorpay_Secret!,
});

// ── Checkout ──────────────────────────────────────────────────────────────────
export const checkOut = TryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ErrorHandler(401, "Authentication required");

  const [user] = await sql`SELECT * FROM users WHERE user_id = ${req.user.user_id}`;

  const isSubscribed = user?.subscription
    ? new Date(user.subscription).getTime() > Date.now()
    : false;

  if (isSubscribed) throw new ErrorHandler(400, "You already have an active subscription");

  const order = await razorpay.orders.create({
    amount: 119 * 100, // ₹119 in paise
    currency: "INR",
    notes: { user_id: req.user.user_id.toString() },
  });

  res.status(201).json({ order });
});

// ── Payment Verification ──────────────────────────────────────────────────────
export const paymentVerification = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.Razorpay_Secret as string)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment failed: invalid signature" });
    }

    const order = await razorpay.orders.fetch(razorpay_order_id);

    if ((order.notes as any)?.user_id !== user?.user_id.toString()) {
      return res.status(403).json({ message: "Forbidden: payment order does not belong to you" });
    }

    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [updatedUser] = await sql`
      UPDATE users SET subscription = ${expiryDate}
      WHERE user_id = ${user?.user_id}
      RETURNING *
    `;

    res.json({ message: "Subscription purchased successfully", updatedUser });
  }
);
