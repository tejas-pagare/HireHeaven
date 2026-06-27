import { sql } from "../../db.js";
import redisClient from "../../redis.js";
import ErrorHandler from "../../utils/ErrorHandler.js";
import { TryCatch } from "../../utils/TryCatch.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

/**
 * GET /api/job/analytics/jobseeker
 * Returns application status overview + applications over time for the current jobseeker.
 * Results are cached in Redis for 2 hours.
 */
export const getJobSeekerAnalytics = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) throw new ErrorHandler(401, "Authentication required");
    if (user.role !== "jobseeker") {
      throw new ErrorHandler(403, "Forbidden: Only job seekers can view analytics");
    }

    const cacheKey = `analytics:jobseeker:${user.user_id}`;

    // Check Redis cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const data = typeof cached === "string" ? JSON.parse(cached) : cached;
      return res.json(data);
    }

    // Status overview
    const statusData = await sql`
      SELECT status AS name, count(*)::int AS value
      FROM applications
      WHERE applicant_id = ${user.user_id}
      GROUP BY status
    `;

    // Applications over time (last 6 months)
    const timeData = await sql`
      SELECT
        to_char(date_trunc('month', applied_at), 'Mon') AS month,
        count(*)::int AS count
      FROM applications
      WHERE applicant_id = ${user.user_id}
        AND applied_at >= NOW() - INTERVAL '6 months'
      GROUP BY date_trunc('month', applied_at)
      ORDER BY date_trunc('month', applied_at) ASC
    `;

    const analyticsResponse = {
      statusOverview: statusData,
      applicationsOverTime: timeData,
    };

    // Cache for 2 hours
    await redisClient.set(cacheKey, JSON.stringify(analyticsResponse), { ex: 7200 });

    res.json(analyticsResponse);
  }
);
