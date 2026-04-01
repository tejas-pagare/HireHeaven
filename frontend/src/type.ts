import React, { ReactNode } from "react";

export interface JobOptions {
  title: string;
  responsibilities: string;
  why: string;
}

export interface SkillsToLearn {
  title: string;
  why: string;
  how: string;
}

export interface SkillCategory {
  category: string;
  skills: SkillsToLearn[];
}

export interface LearningApproach {
  title: string;
  points: string[];
}

export interface CareerGuideResponse {
  summary: string;
  jobOptions: JobOptions[];
  skillsToLearn: SkillCategory[];
  learningApproach: LearningApproach;
}

export interface ScoreBreakdown {
  formatting: { score: number; feedback: string };
  keywords: { score: number; feedback: string };
  structure: { score: number; feedback: string };
  readability: { score: number; feedback: string };
}

export interface Suggestion {
  category: string;
  issue: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
}

export interface ResumeAnalysisResponse {
  atsScore: number;
  scoreBreakdown: ScoreBreakdown;
  suggestions: Suggestion[];
  strengths: string[];
  summary: string;
}

export interface User {
  user_id: number;
  name: string;
  email: string;
  phone_number: string;
  role: "jobseeker" | "recruiter";
  bio: string | null;
  resume: string | null;
  resume_public_id: string | null;
  profile_pic: string | null;
  profile_pic_public_id: string | null;
  skills: string[];
  subscription: string | null;
}

export interface AppContextType {
  user: User | null;
  loading: boolean;
  btnLoading: boolean;
  isAuth: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAuth: React.Dispatch<React.SetStateAction<boolean>>;
  logoutUser: () => Promise<void>;
  updateProfilePic: (formData: any) => Promise<void>;
  updateResume: (formData: any) => Promise<void>;
  updateUser: (name: string, phoneNumber: string, bio: string) => Promise<void>;
  addSkill: (
    skill: string,
    setSkill: React.Dispatch<React.SetStateAction<string>>
  ) => Promise<void>;
  removeSkill: (skill: string) => Promise<void>;
  applyJob: (job_id: number) => Promise<void>;
  applications: Application[];
  fetchApplications: () => Promise<void>;
}

export interface AppProviderProps {
  children: ReactNode;
}

export interface AccontProps {
  user: User;
  isYourAccount: boolean;
}

export interface Job {
  job_id: number;
  title: string;
  description: string;
  salary: number | null;
  location: string | null;
  job_type: "Full-time" | "Part-time" | "Contract" | "Internship";
  openings: number;
  role: string;
  work_location: "On-site" | "Remote" | "Hybrid";
  company_id: number;
  company_name: string;
  company_logo: string;
  posted_by_recuriter_id: number;
  created_at: string;
  is_active: boolean;
}

export interface Company {
  company_id: string;
  name: string;
  description: string;
  website: string;
  logo: string;
  logo_public_id: string;
  recruiter_id: number;
  created_at: string;
  jobs?: Job[];
}

type ApplicationStatus = "Submitted" | "Screening" | "Interview" | "Assignment" | "Final Review" | "Offer" | "Hired" | "Rejected";

export interface Application {
  application_id: number;
  job_id: number;
  applicant_id: number;
  applicant_email: string;
  status: ApplicationStatus;
  resume: string;
  applied_at: string;
  subscribed: boolean;
  job_title: string;
  job_salary: number;
  job_location: string;
  overall_score?: number;
  skill_match_score?: number;
  assignment_score?: number;
  interview_score?: number;
  meet_link?: string;
  scheduled_at?: string;
}

// ── Chat Types ──

export interface Conversation {
  conversation_id: number;
  application_id: number;
  job_id: number;
  applicant_id: number;
  recruiter_id: number;
  last_message_at: string;
  created_at: string;
  job_title: string;
  company_name: string;
  company_logo: string;
  applicant_name: string;
  applicant_pic: string | null;
  recruiter_name: string;
  recruiter_pic: string | null;
  unread_count: number;
  last_message: string | null;
}

export interface Message {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: "text" | "file" | "image";
  is_read: boolean;
  created_at: string;
  sender_name: string;
  sender_pic: string | null;
  _isOptimistic?: boolean; // true for messages added optimistically before server confirmation
}
