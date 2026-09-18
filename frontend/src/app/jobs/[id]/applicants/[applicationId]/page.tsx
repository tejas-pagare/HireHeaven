"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import Link from "next/link";
import toast from "react-hot-toast";
import { job_service, useAppData } from "@/context/AppContext";
import { Application } from "@/type";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Brain, FileText, MessageSquare, Mic, User as UserIcon } from "lucide-react";
import Loading from "@/components/loading";
import RoundTimeline, { RoundTimelineEntry } from "@/components/round-timeline";
import RoundModal from "@/components/round-modal";

const STATUS_OPTIONS = ["Submitted", "Screening", "Interview", "Assignment", "Final Review", "Offer", "Hired", "Rejected"];

interface TimelineResponse {
  applicationStatus: string;
  jobTitle: string;
  isTerminal: boolean;
  rounds: RoundTimelineEntry[];
}

export default function ApplicantDetailPage() {
  const { id: jobId, applicationId } = useParams();
  const router = useRouter();
  const { loading: authLoading } = useAppData();

  const [application, setApplication] = useState<Application | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const [modalState, setModalState] = useState<{ round: RoundTimelineEntry; tab: "schedule" | "evaluate" } | null>(null);

  const token = Cookies.get("token");

  const fetchAll = useCallback(async () => {
    try {
      const [appsRes, timelineRes] = await Promise.all([
        axios.get(`${job_service}/api/job/${jobId}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get<TimelineResponse>(`${job_service}/api/job/application/${applicationId}/timeline`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const found = (appsRes.data as Application[]).find((a) => a.application_id === Number(applicationId));
      setApplication(found || null);
      setTimeline(timelineRes.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load applicant");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, applicationId]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    fetchAll();
  }, [authLoading, token, router, fetchAll]);

  const handleStatusChange = async (status: string) => {
    if (!application) return;
    setStatusLoading(true);
    try {
      await axios.put(
        `${job_service}/api/job/application/${application.application_id}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Status updated to ${status}`);
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleChat = async () => {
    if (!application) return;
    setChatLoading(true);
    try {
      const { data } = await axios.post<{ conversation: { conversation_id: number } }>(
        `${job_service}/api/chat/conversations`,
        { application_id: application.application_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      router.push(`/chat/${data.conversation.conversation_id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to start chat");
    } finally {
      setChatLoading(false);
    }
  };

  const handleCancelRound = async (round: RoundTimelineEntry) => {
    if (!round.interview_id) return;
    try {
      await axios.delete(`${job_service}/api/job/interview/${round.interview_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Round cancelled");
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to cancel round");
    }
  };

  if (authLoading || loading) return <Loading />;

  if (!application || !timeline) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-4xl">
        <Link href={`/jobs/${jobId}/applicants`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={16} /> Back to candidates
        </Link>
        <Card className="p-12 text-center text-muted-foreground">Applicant not found, or you don't have access.</Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <Link href={`/jobs/${jobId}/applicants`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={16} /> Back to candidates
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center">
            <UserIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{application.applicant_email}</h1>
            <p className="text-muted-foreground text-sm">{timeline.jobTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={application.status} onValueChange={handleStatusChange} disabled={statusLoading}>
            <SelectTrigger className="h-10 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleChat} disabled={chatLoading}>
            <MessageSquare size={14} /> {chatLoading ? "Opening..." : "Chat"}
          </Button>
          <Link href={`/jobs/${jobId}/applicants/${applicationId}/resume`}>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText size={14} /> Resume
            </Button>
          </Link>
          {application.ai_interview_completed && (
            <Link href={`/ai-interview/result/${application.application_id}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Brain size={14} /> AI Interview
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="p-6 border-2">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Mic size={18} className="text-muted-foreground" /> Interview Rounds
        </h2>
        {timeline.rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This job has no defined interview rounds yet. Add rounds from the job's edit form to track this candidate's progress here.
          </p>
        ) : (
          <RoundTimeline
            mode="recruiter"
            rounds={timeline.rounds}
            applicationStatus={timeline.applicationStatus}
            isTerminal={timeline.isTerminal}
            onSchedule={(round) => setModalState({ round, tab: "schedule" })}
            onEvaluate={(round) => setModalState({ round, tab: "evaluate" })}
            onCancel={handleCancelRound}
          />
        )}
      </Card>

      <RoundModal
        applicationId={application.application_id}
        round={modalState?.round || null}
        initialTab={modalState?.tab || "schedule"}
        isOpen={modalState !== null}
        onClose={() => setModalState(null)}
        onUpdate={fetchAll}
      />
    </div>
  );
}
