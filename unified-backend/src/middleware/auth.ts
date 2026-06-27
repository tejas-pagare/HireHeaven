import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { sql } from "../db.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    name: string;
    email: string;
    phone_number: string;
    role: "jobseeker" | "recruiter";
    bio?: string;
    resume?: string;
    resume_public_id?: string;
    profile_pic?: string;
    profile_pic_public_id?: string;
    subscription?: string;
    skills?: string[];
  };
}

export const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  let decoded: JwtPayload;

  try {
    decoded = jwt.verify(token, process.env.JWT_SEC as string) as JwtPayload;
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  const users = await sql`
    SELECT u.user_id, u.name, u.email, u.phone_number, u.role,
           u.bio, u.resume, u.resume_public_id, u.profile_pic,
           u.profile_pic_public_id, u.subscription,
           ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) AS skills
    FROM users u
    LEFT JOIN user_skills us ON u.user_id = us.user_id
    LEFT JOIN skills s ON us.skill_id = s.skill_id
    WHERE u.user_id = ${decoded.id}
    GROUP BY u.user_id, u.name, u.email, u.phone_number, u.role,
             u.bio, u.resume, u.resume_public_id, u.profile_pic,
             u.profile_pic_public_id, u.subscription
  `;

  if (users.length === 0) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  const user = users[0];
  user.skills = user.skills || [];
  req.user = user as AuthenticatedRequest["user"];
  next();
};
