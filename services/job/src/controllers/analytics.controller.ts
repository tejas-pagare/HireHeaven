import { TryCatch } from "../utils/TryCatch.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/errorHandler.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { Redis } from "ioredis";

// Assuming REDIS_URL from env or defaulting to localhost
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export const getJobSeekerAnalytics = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    if (user.role !== "jobseeker") {
      throw new ErrorHandler(403, "Forbidden: Only job seekers can view analytics");
    }

    const { user_id } = user;

    // 1. Check Redis Cache First
    const cacheKey = `analytics:jobseeker:${user_id}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Compute Scalable Analytics from DB
    
    // Status Overview (Group by)
    const statusData = await sql`
      SELECT status as name, count(*)::int as value
      FROM applications
      WHERE applicant_id = ${user_id}
      GROUP BY status
    `;

    // Applications over time (Group by month for the last 6 months)
    const timeData = await sql`
      SELECT 
        to_char(date_trunc('month', applied_at), 'Mon') as month,
        count(*)::int as count
      FROM applications
      WHERE applicant_id = ${user_id} 
        AND applied_at >= NOW() - INTERVAL '6 months'
      GROUP BY date_trunc('month', applied_at)
      ORDER BY date_trunc('month', applied_at) ASC
    `;

    const analyticsResponse = {
      statusOverview: statusData,
      applicationsOverTime: timeData
    };

    // 3. Store result in Redis cache (TTL: 2 hours)
    await redis.setex(cacheKey, 7200, JSON.stringify(analyticsResponse));

    res.json(analyticsResponse);
  }
);
