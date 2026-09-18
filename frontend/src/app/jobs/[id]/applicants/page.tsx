"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import Link from "next/link";
import { job_service, useAppData } from "@/context/AppContext";
import { Application, Job } from "@/type";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Brain, Mic, ShieldAlert, Users } from "lucide-react";
import Loading from "@/components/loading";

const STATUS_STYLES: Record<string, string> = {
  Submitted: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  Screening: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Interview: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Assignment: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Final Review": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Offer: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  Hired: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const RECOMMENDATION_STYLES: Record<string, string> = {
  "Strong Yes": "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  Yes: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
  Borderline: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  No: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

export default function JobApplicantsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAppData();
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const token = Cookies.get("token");
    if (!token) {
      router.push("/login");
      return;
    }

    (async () => {
      try {
        const [jobRes, appsRes] = await Promise.all([
          axios.get(`${job_service}/api/job/${id}`),
          axios.get(`${job_service}/api/job/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setJob(jobRes.data);
        setApplications(appsRes.data);
      } catch {
        // Ownership/403 handled by showing an empty state below.
      } finally {
        setLoading(false);
      }
    })();
  }, [id, authLoading, router]);

  if (authLoading || loading) return <Loading />;

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <Link href={`/jobs/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to job
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center">
          <Users size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{job?.title || "Candidates"}</h1>
          <p className="text-muted-foreground">
            {applications.length} candidate{applications.length !== 1 ? "s" : ""} applied
          </p>
        </div>
      </div>

      <Card className="border-2 overflow-hidden">
        {applications.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">No applicants yet, or you don't have access to this job.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>AI Screen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.application_id}>
                    <TableCell className="font-medium">{app.applicant_email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(app.applied_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[app.status] || STATUS_STYLES.Submitted}`}>
                        {app.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {app.ai_interview_completed ? (
                        (app as any).ai_interview_manual_review ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 inline-flex items-center gap-1">
                            <ShieldAlert size={12} /> Review
                          </span>
                        ) : (app as any).ai_interview_recommendation ? (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              RECOMMENDATION_STYLES[(app as any).ai_interview_recommendation] || ""
                            }`}
                          >
                            {(app as any).ai_interview_recommendation}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Done</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/jobs/${id}/applicants/${app.application_id}`}>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Brain size={14} /> View Status
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
