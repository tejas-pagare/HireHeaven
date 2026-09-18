"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import Link from "next/link";
import { job_service, useAppData } from "@/context/AppContext";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ListChecks } from "lucide-react";
import Loading from "@/components/loading";
import RoundTimeline, { RoundTimelineEntry } from "@/components/round-timeline";

interface TimelineResponse {
  applicationStatus: string;
  jobTitle: string;
  isTerminal: boolean;
  rounds: RoundTimelineEntry[];
}

export default function ApplicationStatusPage() {
  const { applicationId } = useParams();
  const router = useRouter();
  const { loading: authLoading } = useAppData();
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const token = Cookies.get("token");
    if (!token) {
      router.push("/login");
      return;
    }

    axios
      .get<TimelineResponse>(`${job_service}/api/job/application/${applicationId}/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => setTimeline(data))
      .catch((error: any) => toast.error(error.response?.data?.message || "Failed to load application status"))
      .finally(() => setLoading(false));
  }, [authLoading, applicationId, router]);

  if (authLoading || loading) return <Loading />;

  return (
    <div className="container mx-auto py-10 px-4 max-w-3xl">
      <Link href="/account" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={16} /> Back to account
      </Link>

      {!timeline ? (
        <Card className="p-12 text-center text-muted-foreground">Application not found, or you don't have access.</Card>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center">
              <ListChecks size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{timeline.jobTitle}</h1>
              <p className="text-muted-foreground text-sm">Current status: {timeline.applicationStatus}</p>
            </div>
          </div>

          <Card className="p-6 border-2">
            {timeline.rounds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This employer hasn't scheduled any interview rounds for your application yet — check back soon.
              </p>
            ) : (
              <RoundTimeline
                mode="candidate"
                rounds={timeline.rounds}
                applicationStatus={timeline.applicationStatus}
                isTerminal={timeline.isTerminal}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
