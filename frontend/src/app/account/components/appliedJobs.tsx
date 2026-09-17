"use client";
import { Card } from "@/components/ui/card";
import SectionHeader from "./section-header";
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
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { BACKEND_URL } from "@/lib/config";

const chat_service = BACKEND_URL;

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
          color: "text-success-subtle-foreground",
          bg: "bg-success-subtle",
          border: "border-success/25",
        };
      case "rejected":
        return {
          icon: XCircle,
          color: "text-destructive-subtle-foreground",
          bg: "bg-destructive-subtle",
          border: "border-destructive/25",
        };
      default:
        return {
          icon: Clock,
          color: "text-warning-subtle-foreground",
          bg: "bg-warning-subtle",
          border: "border-warning/25",
        };
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SectionHeader
        title="Your applications"
        description={`Track your applications in one place — ${applications?.length || 0} active application${applications?.length !== 1 ? "s" : ""}.`}
      />

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
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-subtle text-brand-subtle-foreground text-sm font-medium hover:bg-primary/20 transition-colors"
                      >
                        <FileText size={16} />
                        Take Quiz
                      </Link>
                    )}
                    
                    {a.status === "Interview" && a.meet_link && (
                      <Link
                        href={a.meet_link}
                        target="_blank"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-subtle text-brand-subtle-foreground text-sm font-medium hover:bg-primary/20 transition-colors"
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
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-subtle text-brand-subtle-foreground text-sm font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
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

