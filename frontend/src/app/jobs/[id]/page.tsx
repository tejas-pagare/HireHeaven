"use client";
import Loading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { job_service, useAppData } from "@/context/AppContext";
import { Application, Job } from "@/type";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  IndianRupee,
  Laptop,
  MapPin,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import Link from "next/link";
import JobAtsAnalyzer from "@/components/job-ats-analyzer";
import RecruiterPipeline from "@/components/recruiter-pipeline";
import QuizBuilder from "@/components/quiz-builder";
import JobCard from "@/components/job-card";
import { BACKEND_URL } from "@/lib/config";

const chat_service = BACKEND_URL;

/** A single labelled fact in the job's detail strip. */
const FactTile = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center gap-3.5 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30">
    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand-subtle-foreground">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  </div>
);

const JobPage = () => {
  const { id } = useParams();
  const { user, applyJob, applications, btnLoading } = useAppData();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherJobs, setOtherJobs] = useState<Job[]>([]);
  const [jobApplications, setJobApplications] = useState<Application[]>([]);
  const [chatLoading, setChatLoading] = useState<number | null>(null);
  const [isQuizManagerOpen, setIsQuizManagerOpen] = useState(false);

  const token = Cookies.get("token");

  useEffect(() => {
    if (applications && id) {
      setApplied(
        applications.some((item: any) => item.job_id.toString() === id)
      );
    }
  }, [applications, id]);

  async function fetchSingleJob() {
    try {
      const { data } = await axios.get(`${job_service}/api/job/${id}`);
      setJob(data as any);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOtherJobs() {
    try {
      const { data } = await axios.get(
        `${job_service}/api/job?title=&location=`,
        { headers: { Authorization: `Bearer ${Cookies.get("token")}` } }
      );
      setOtherJobs(
        (data as Job[]).filter((j) => j.job_id.toString() !== id).slice(0, 3)
      );
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    fetchSingleJob();
    fetchOtherJobs();
  }, [id]);

  async function fetchJobApplications() {
    try {
      const { data } = await axios.get(
        `${job_service}/api/job/${id}/applications`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJobApplications(data as Application[]);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    if (user && job && user.user_id === job.posted_by_recuriter_id) {
      fetchJobApplications();
    }
  }, [user, job]);

  const startChatWithApplicant = async (applicationId: number) => {
    setChatLoading(applicationId);
    try {
      const { data } = await axios.post<{
        message: string;
        conversation: { conversation_id: number };
      }>(
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

  const isOwner = Boolean(
    user && job && user.user_id === job.posted_by_recuriter_id
  );

  // The API sends `openings` as a decimal string (e.g. "10.0"); show a whole count.
  const openings = Math.round(Number(job?.openings ?? 0));

  if (loading) return <Loading />;

  return (
    <div className="hh-page">
      {job && (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <Button
            variant="ghost"
            className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ArrowLeft size={18} /> Back to jobs
          </Button>

          {/* Header card */}
          <Card variant="elevated" className="mb-8 gap-0 overflow-hidden p-0">
            <div className="h-24 bg-gradient-to-r from-primary via-primary to-[var(--chart-4)]/70" />

            <div className="px-6 pb-6 sm:px-8">
              <div className="-mt-10 mb-5 flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-soft-md">
                    {job.company_logo ? (
                      <img
                        src={job.company_logo}
                        alt={job.company_name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Building2 size={28} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                <Badge
                  variant={job.is_active ? "success" : "destructive"}
                  shape="pill"
                  size="lg"
                  className="mb-1"
                >
                  {job.is_active ? "Open" : "Closed"}
                </Badge>
              </div>

              <h1 className="mb-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {job.title}
              </h1>

              <Link
                href={`/company/${job.company_id}`}
                className="inline-flex items-center gap-2 font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <Building2 size={17} />
                {job.company_name || "View company"}
              </Link>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {job.job_type && (
                  <Badge variant="brand" shape="pill">
                    {job.job_type}
                  </Badge>
                )}
                {job.work_location && (
                  <Badge variant="secondary" shape="pill" className="gap-1.5">
                    <Laptop size={12} />
                    {job.work_location}
                  </Badge>
                )}
                {job.role && (
                  <Badge variant="muted" shape="pill">
                    {job.role}
                  </Badge>
                )}
                {job.created_at && (
                  <Badge variant="muted" shape="pill" className="gap-1.5">
                    <CalendarDays size={12} />
                    {new Date(job.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Badge>
                )}
              </div>

              {user?.role === "jobseeker" && (
                <div className="mt-6 border-t pt-6">
                  {applied ? (
                    <div className="inline-flex items-center gap-2 rounded-lg bg-success-subtle px-5 py-3 font-semibold text-success-subtle-foreground">
                      <CheckCircle2 size={18} />
                      You&apos;ve already applied
                    </div>
                  ) : job.is_active ? (
                    <Button
                      size="lg"
                      onClick={() => applyJob(job.job_id)}
                      disabled={btnLoading}
                      className="gap-2"
                    >
                      <Briefcase size={18} />
                      {btnLoading ? "Applying…" : "Easy Apply"}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This role is no longer accepting applications.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Key facts */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FactTile
              icon={<MapPin size={19} />}
              label="Location"
              value={job.location || "Not specified"}
            />
            <FactTile
              icon={<IndianRupee size={19} />}
              label="Salary"
              value={job.salary ? `${job.salary} P.A` : "Not disclosed"}
            />
            <FactTile
              icon={<Users size={19} />}
              label="Openings"
              value={`${openings} ${openings === 1 ? "position" : "positions"}`}
            />
          </div>

          {/* Description */}
          <section className="mb-10">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
              <Briefcase size={21} className="text-primary" />
              Job description
            </h2>
            <div className="prose prose-sm max-w-none leading-relaxed text-muted-foreground sm:prose-base dark:prose-invert">
              <p className="whitespace-pre-line">{job.description}</p>
            </div>
          </section>

          {user?.role === "jobseeker" && (
            <>
              <section className="border-t pt-10">
                <JobAtsAnalyzer jobDescription={job.description} />
              </section>

              <section className="mt-12 border-t pt-12 pb-4">
                <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="mb-1 text-2xl font-bold tracking-tight">
                      Looking for something else?
                    </h2>
                    <p className="text-muted-foreground">
                      Explore other opportunities and find the perfect role.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => router.push("/jobs")}
                  >
                    View all <ArrowRight size={16} />
                  </Button>
                </div>

                {otherJobs.length > 0 && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {otherJobs.map((otherJob) => (
                      <JobCard job={otherJob} key={otherJob.job_id} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {isOwner && job && (
        <div className="mx-auto mb-12 w-[98%] max-w-[1400px]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Pipeline dashboard
              </h2>
              <p className="text-sm text-muted-foreground">
                {jobApplications.length}{" "}
                {jobApplications.length === 1 ? "applicant" : "applicants"}
              </p>
            </div>
            <Button onClick={() => setIsQuizManagerOpen(true)}>
              Manage quiz
            </Button>
          </div>

          <RecruiterPipeline
            applications={jobApplications}
            onApplicationUpdate={fetchJobApplications}
            onOpenChat={startChatWithApplicant}
            chatOpenLoadingId={chatLoading}
          />

          <QuizBuilder
            jobId={job.job_id}
            jobDescription={job.description}
            isOpen={isQuizManagerOpen}
            onClose={() => setIsQuizManagerOpen(false)}
          />
        </div>
      )}
    </div>
  );
};

export default JobPage;
