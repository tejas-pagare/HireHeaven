"use client";
import { Card } from "@/components/ui/card";
import { Application } from "@/type";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  Eye,
  FileText,
  MessageSquare,
  Mic,
  XCircle,
  ChevronRight,
  ListChecks
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";

const chat_service =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface AppliedJobsProps {
  applications: Application[];
}

const AppliedJobs: React.FC<AppliedJobsProps> = ({ applications }) => {
  const router = useRouter();
  const [chatLoading, setChatLoading] = useState<number | null>(null);
  const token = Cookies.get("token");

  const startChat = async (applicationId: number) => {
    setChatLoading(applicationId);
    try {
      const { data } = await axios.post<{ message: string; conversation: { conversation_id: number } }>(
        `${chat_service}/api/chat/conversations`,
        { application_id: applicationId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      router.push(`/chat/${data.conversation.conversation_id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to start chat");
    } finally {
      setChatLoading(null);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case "hired":
        return {
          icon: CheckCircle2,
          color: "text-emerald-700 dark:text-emerald-400",
          bg: "bg-emerald-50 dark:bg-emerald-500/10",
          border: "border-emerald-200 dark:border-emerald-800/30",
        };
      case "rejected":
        return {
          icon: XCircle,
          color: "text-red-700 dark:text-red-400",
          bg: "bg-red-50 dark:bg-red-500/10",
          border: "border-red-200 dark:border-red-800/30",
        };
      default:
        return {
          icon: Clock,
          color: "text-amber-700 dark:text-amber-400",
          bg: "bg-amber-50 dark:bg-amber-500/10",
          border: "border-amber-200 dark:border-amber-800/30",
        };
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          Your Applications
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Track and manage your job applications in one place. You have {applications?.length || 0} active application{applications?.length !== 1 ? 's' : ''}.
        </p>
      </div>

      <div className="space-y-4">
        {applications && applications.length > 0 ? (
          applications.map((a) => {
            const statusConfig = getStatusConfig(a.status);
            const StatusIcon = statusConfig.icon;

            return (
              <Card 
                key={a.application_id} 
                className="group p-0 overflow-hidden hover:shadow-md transition-all duration-300 border-border/50"
              >
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl font-semibold text-foreground truncate">
                        {a.job_title}
                      </h3>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                        <StatusIcon size={14} />
                        {a.status}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <IndianRupee size={16} className="text-muted-foreground" />
                        <span className="font-medium text-foreground">{a.job_salary}</span>
                      </div>
                      
                      {/* You can add location here if available */}
                      {a.job_location && (
                        <div className="flex items-center gap-2">
                           <span className="font-medium text-foreground">{a.job_location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-0 border-border/50">
                    {a.status === "Assignment" && (
                      <Link
                        href={`/quiz/${a.job_id}?application_id=${a.application_id}`}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 transition-colors"
                      >
                        <FileText size={16} />
                        Take Quiz
                      </Link>
                    )}
                    
                    {a.status === "Interview" && a.meet_link && (
                      <Link
                        href={a.meet_link}
                        target="_blank"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20 transition-colors"
                        title={a.scheduled_at ? `Scheduled for: ${new Date(a.scheduled_at).toLocaleString()}` : "Interview Link"}
                      >
                        <Calendar size={16} />
                        Join Meet
                      </Link>
                    )}
                    
                    {a.status !== "Rejected" && (
                      <button
                        onClick={() => startChat(a.application_id)}
                        disabled={chatLoading === a.application_id}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                      >
                        <MessageSquare size={16} />
                        {chatLoading === a.application_id ? "Opening..." : "Chat"}
                      </button>
                    )}
                    
                    {a.status !== "Rejected" && (
                      a.ai_interview_completed ? (
                        <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed border border-border/50">
                          <CheckCircle2 size={16} />
                          Interview Done
                        </div>
                      ) : (
                        <Link
                          href={`/ai-interview/${a.application_id}`}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                          <Mic size={16} />
                          AI Screen
                        </Link>
                      )
                    )}
                    
                    <Link
                      href={`/applications/${a.application_id}/status`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-50 text-teal-700 text-sm font-medium hover:bg-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:hover:bg-teal-500/20 transition-colors"
                    >
                      <ListChecks size={16} />
                      View Status
                    </Link>

                    <Link
                      href={`/jobs/${a.job_id}`}
                      className="ml-auto sm:ml-2 flex items-center justify-center p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="View Job"
                    >
                      <ChevronRight size={20} />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border/50 rounded-xl bg-muted/30">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Briefcase size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">No applications yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md text-center">
              You haven't applied to any jobs yet. When you do, they will appear here so you can track their status.
            </p>
            <Link 
              href="/jobs" 
              className="mt-6 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Find Jobs
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppliedJobs;

