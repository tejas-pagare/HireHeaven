"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import Link from "next/link";
import toast from "react-hot-toast";
import { job_service, utils_service, useAppData } from "@/context/AppContext";
import { Application, ResumeIndexStatus } from "@/type";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, GraduationCap, Layers, Sparkles } from "lucide-react";
import Loading from "@/components/loading";

export default function CandidateResumePage() {
  const { id: jobId, applicationId } = useParams();
  const router = useRouter();
  const { loading: authLoading } = useAppData();

  const [application, setApplication] = useState<Application | null>(null);
  const [structured, setStructured] = useState<ResumeIndexStatus | null>(null);
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
        const { data: apps } = await axios.get<Application[]>(`${job_service}/api/job/${jobId}/applications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const found = apps.find((a) => a.application_id === Number(applicationId));
        setApplication(found || null);

        if (found) {
          const { data: status } = await axios.get<ResumeIndexStatus>(
            `${utils_service}/api/utils/resume/status/${found.applicant_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setStructured(status);
        }
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to load resume");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, jobId, applicationId, router]);

  if (authLoading || loading) return <Loading />;

  if (!application) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-4xl">
        <Card className="p-12 text-center text-muted-foreground">Resume not found, or you don't have access.</Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <Link
        href={`/jobs/${jobId}/applicants/${applicationId}`}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} /> Back to applicant
      </Link>

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Resume</h1>
            <p className="text-muted-foreground text-sm">{application.applicant_email}</p>
          </div>
        </div>
        <a href={application.resume} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-2">
            <Download size={14} /> Open original PDF
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-2 overflow-hidden h-[80vh]">
            <iframe src={application.resume} title="Resume" className="w-full h-full" />
          </Card>
        </div>

        <div className="space-y-6">
          {structured?.structured ? (
            <>
              {structured.structured.skills?.length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                    <Sparkles size={16} className="text-primary" /> Skills
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {structured.structured.skills.map((s, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-muted">
                        {s}
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {structured.structured.experience_summary && (
                <Card className="p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                    <Layers size={16} className="text-primary" /> Experience
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{structured.structured.experience_summary}</p>
                </Card>
              )}

              {structured.structured.education && (
                <Card className="p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                    <GraduationCap size={16} className="text-primary" /> Education
                  </h3>
                  <p className="text-sm text-muted-foreground">{structured.structured.education}</p>
                </Card>
              )}

              {structured.structured.projects?.length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">Projects</h3>
                  <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                    {structured.structured.projects.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-5 text-sm text-muted-foreground">
              This resume hasn't been AI-indexed yet, so no structured summary is available — the embedded PDF on the left is still the
              full document.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
