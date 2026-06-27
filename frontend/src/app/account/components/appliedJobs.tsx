"use client";
import { Card } from "@/components/ui/card";
import { Application } from "@/type";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileText,
  MessageSquare,
  XCircle,
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
          color: "text-green-600 dark:bg-green-900/30",
          bg: "bg-green-100 dark:bg-green-900/30",
          border: "border-green-200 dark:border-green-800",
        };
      case "rejected":
        return {
          icon: XCircle,
          color: "text-red-600 dark:bg-red-900/30",
          bg: "bg-red-100 dark:bg-red-900/30",
          border: "border-red-200 dark:border-red-800",
        };
      default:
        return {
          icon: Clock,
          color: "text-yellow-600 dark:bg-yellow-900/30",
          bg: "bg-yellow-100 dark:bg-yellow-900/30",
          border: "border-yellow-200 dark:border-yellow-800",
        };
    }
  };
  return (
    <div className="w-full mx-auto px-4 py-6">
      <Card className="shadow-lg border-2 overflow-hidden">
        <div className="bg-blue-600 text-white p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Briefcase size={20} className="text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Your Applied Jobs</h1>
          <p className="text-sm font-bold">
            {applications.length} applications submitted
          </p>
        </div>

        <div className="p-6">
          {applications && applications.length > 0 ? (
            <div className="space-y-4">
              {applications.map((a) => {
                const statusConfig = getStatusConfig(a.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={a.application_id}
                    className="p-5 rounded-lg border-2 hover:border-blue-500 transition-all bg-background"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-semibold mb-3">
                          {a.job_title}
                        </h3>

                        <div className="flex flex-wrap gap-4 items-center">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
                              <DollarSign size={14} />
                              <span className="font-medium">
                                ₹ {a.job_salary}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${statusConfig.bg} ${statusConfig.border}`}
                          >
                            <StatusIcon
                              size={14}
                              className={statusConfig.color}
                            />
                            <span
                              className={`font-medium text-sm ${statusConfig.color}`}
                            >
                              {a.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        {a.status === "Assignment" && (
                          <Link
                            href={`/quiz/${a.job_id}?application_id=${a.application_id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all"
                          >
                            <FileText size={14} />
                            Take Quiz
                          </Link>
                        )}
                        {a.status === "Interview" && a.meet_link && (
                          <Link
                            href={a.meet_link}
                            target="_blank"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-all"
                            title={a.scheduled_at ? `Scheduled for: ${new Date(a.scheduled_at).toLocaleString()}` : "Interview Link"}
                          >
                            <Calendar size={14} />
                            Join Meet
                          </Link>
                        )}
                        {a.status !== "Rejected" && (
                          <button
                            onClick={() => startChat(a.application_id)}
                            disabled={chatLoading === a.application_id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-all"
                          >
                            <MessageSquare size={14} />
                            {chatLoading === a.application_id
                              ? "Opening..."
                              : "Chat"}
                          </button>
                        )}
                        <Link
                          href={`/jobs/${a.job_id}`}
                          className="flex items-center justify-center gap-1.5"
                        >
                          <Eye size={16} />
                          View Job
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <p>No Applications Yet</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AppliedJobs;
