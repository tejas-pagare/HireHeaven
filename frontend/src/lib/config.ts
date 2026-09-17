/**
 * Single source of truth for the backend origin.
 *
 * The app talks to one unified backend; the per-service URLs that used to exist
 * (auth/user/job/payment/utils) are all the same origin now. Keep the fallback
 * defined here only — duplicating it per-file meant a missing env var failed
 * differently in each caller.
 */
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

/** Re-exported aliases kept so existing imports continue to resolve. */
export const auth_service = BACKEND_URL;
export const user_service = BACKEND_URL;
export const job_service = BACKEND_URL;
export const payment_service = BACKEND_URL;
export const utils_service = BACKEND_URL;
export const chat_service = BACKEND_URL;
