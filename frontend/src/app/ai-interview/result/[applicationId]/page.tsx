"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import {
  Mic,
  ArrowLeft,
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import Loading from "@/components/loading";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

type Recommendation = "Strong Yes" | "Yes" | "Borderline" | "No";

interface PerQuestion {
  question: string;
  answer_summary: string;
  score: number;
  flag: "none" | "vague" | "copy_pasted" | "off_topic";
}

interface Competency {
  name: string;
  status: "demonstrated" | "claimed_unverified" | "not_covered";
  note: string;
}

interface ResumeConsistency {
  claim: string;
  verified: boolean;
  note: string;
}

interface Evaluation {
  strengths?: string[];
  weaknesses?: string[];
  feedback: string;
  per_question?: PerQuestion[];
  competencies?: Competency[];
  resume_consistency?: ResumeConsistency[];
  _evaluationFailed?: boolean;
}

interface InterviewResult {
  interview_id: number;
  application_id: number;
  transcript: { role: string; content: string }[];
  evaluation: Evaluation;
  score: number | null;
  recommendation: Recommendation | null;
  manual_review_required: boolean;
  duration_seconds: number | null;
  created_at: string;
}

const RECOMMENDATION_STYLES: Record<Recommendation, string> = {
  "Strong Yes": "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50",
  Yes: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-900/50",
  Borderline: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50",
  No: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50",
};

const COMPETENCY_STYLES: Record<Competency["status"], { label: string; className: string }> = {
  demonstrated: {
    label: "Demonstrated",
    className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50",
  },
  claimed_unverified: {
    label: "Claimed, unverified",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50",
  },
  not_covered: {
    label: "Not covered",
    className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
};

const FLAG_LABELS: Record<PerQuestion["flag"], string> = {
  none: "",
  vague: "Vague",
  copy_pasted: "Possibly copy-pasted",
  off_topic: "Off-topic",
};

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function AiInterviewResultPage() {
  const { applicationId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<InterviewResult | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      const token = Cookies.get("token");
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const { data } = await axios.get<InterviewResult>(
          `${BACKEND_URL}/api/utils/interview/result/${applicationId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setResult(data);
      } catch (error: any) {
        if (error.response?.status === 404) {
          toast.error("AI Interview has not been completed yet.");
        } else if (error.response?.status === 403) {
          toast.error("You do not have access to this interview result.");
        } else {
          toast.error("Failed to load interview result");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [applicationId, router]);

  if (loading) return <Loading />;

  if (!result) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Link href="/account" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Account
        </Link>
        <Card className="p-12 text-center flex flex-col items-center justify-center">
          <Mic size={48} className="text-muted-foreground mb-4 opacity-20" />
          <h2 className="text-xl font-bold">No Interview Result Found</h2>
          <p className="text-muted-foreground mt-2">The candidate has not completed the AI screen, or there was an error.</p>
        </Card>
      </div>
    );
  }

  const { evaluation, transcript, score, recommendation, manual_review_required, duration_seconds } = result;
  const scoreColor =
    score === null ? "text-muted-foreground" : score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  const durationLabel = formatDuration(duration_seconds);

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <Link href="/account" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Account
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center">
          <Mic size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Interview Evaluation</h1>
          <p className="text-muted-foreground">
            Application #{applicationId} • Completed {new Date(result.created_at).toLocaleDateString()}
            {durationLabel && ` • ${durationLabel}`}
          </p>
        </div>
      </div>

      {manual_review_required && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/50 p-4">
          <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">Needs manual review</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              {score === null
                ? "The automated evaluation could not be completed for this interview. Please review the transcript directly."
                : "This interview was too short, or flagged too many suspicious responses, to score with full confidence — treat the automated score as provisional."}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evaluation Summary */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 bg-gradient-to-br from-background to-muted/50 border-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Brain size={18} className="text-primary" /> Overall Score
              </h2>
              {recommendation && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${RECOMMENDATION_STYLES[recommendation]}`}>
                  {recommendation}
                </span>
              )}
            </div>
            <div className="flex items-end gap-2 mb-2">
              {score === null ? (
                <span className="text-2xl font-semibold text-muted-foreground">Pending review</span>
              ) : (
                <>
                  <span className={`text-6xl font-bold tracking-tighter ${scoreColor}`}>{score}</span>
                  <span className="text-muted-foreground font-medium mb-1">/ 100</span>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{evaluation.feedback}</p>
          </Card>

          {evaluation.strengths && evaluation.strengths.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-green-600 flex items-center gap-2 mb-4">
                <CheckCircle size={16} /> Strengths
              </h3>
              <ul className="space-y-3">
                {evaluation.strengths.map((str, i) => (
                  <li
                    key={i}
                    className="text-sm bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-100 dark:border-green-900/50 text-green-800 dark:text-green-300"
                  >
                    {str}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-red-600 flex items-center gap-2 mb-4">
                <XCircle size={16} /> Weaknesses
              </h3>
              <ul className="space-y-3">
                {evaluation.weaknesses.map((wk, i) => (
                  <li
                    key={i}
                    className="text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/50 text-red-800 dark:text-red-300"
                  >
                    {wk}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {evaluation.competencies && evaluation.competencies.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <ShieldCheck size={16} className="text-primary" /> Competency coverage
              </h3>
              <ul className="space-y-3">
                {evaluation.competencies.map((c, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{c.note}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full border ${COMPETENCY_STYLES[c.status].className}`}>
                      {COMPETENCY_STYLES[c.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {evaluation.resume_consistency && evaluation.resume_consistency.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <ShieldQuestion size={16} className="text-primary" /> Resume consistency
              </h3>
              <ul className="space-y-3">
                {evaluation.resume_consistency.map((r, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    {r.verified ? (
                      <ShieldCheck size={14} className="text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p>{r.claim}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{r.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Per-question breakdown + Full Transcript */}
        <div className="lg:col-span-2 space-y-6">
          {evaluation.per_question && evaluation.per_question.length > 0 && (
            <Card className="p-6 border-2">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock size={18} className="text-muted-foreground" /> Per-question breakdown
              </h2>
              <div className="space-y-4">
                {evaluation.per_question.map((q, i) => (
                  <div key={i} className="border border-border/60 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{q.question}</p>
                      <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-muted">{q.score}/10</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5">{q.answer_summary}</p>
                    {q.flag !== "none" && (
                      <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50">
                        {FLAG_LABELS[q.flag]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-6 border-2 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Mic size={18} className="text-muted-foreground" /> Full Transcript
            </h2>
            <div className="flex-1 space-y-6 overflow-y-auto pr-2 pb-4">
              {transcript.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl ${
                      msg.role === "assistant" ? "bg-muted rounded-tl-sm text-foreground" : "bg-primary text-primary-foreground rounded-tr-sm"
                    }`}
                  >
                    <p className="text-sm font-semibold mb-1 opacity-70 uppercase tracking-wider text-[10px]">
                      {msg.role === "assistant" ? "AI Interviewer" : "Candidate"}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
