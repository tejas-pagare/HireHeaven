"use client";
import Loading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { job_service, useAppData } from "@/context/AppContext";
import { Application, Job } from "@/type";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  IndianRupee,
  MapPin,
  MessageSquare,
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

const chat_service =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const JobPage = () => {
  const { id } = useParams();
  const { user, isAuth, applyJob, applications, btnLoading } = useAppData();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);

  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (applications && id) {
      applications.forEach((item: any) => {
        if (item.job_id.toString() === id) setApplied(true);
      });
    }
  }, [applications, id]);

  const applyJobHandler = (id: number) => {
    applyJob(id);
  };

  const [loading, setLoading] = useState(true);
  const [otherJobs, setOtherJobs] = useState<Job[]>([]);

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
      const token = Cookies.get("token");
      const { data } = await axios.get(`${job_service}/api/job?title=&location=`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const filtered = (data as Job[]).filter(j => j.job_id.toString() !== id).slice(0, 3);
      setOtherJobs(filtered);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    fetchSingleJob();
    fetchOtherJobs();
  }, [id]);

  const [jobApplications, setJobApplications] = useState<Application[]>([]);

  const token = Cookies.get("token");

  async function fetchJobApplications() {
    try {
      const { data } = await axios.get(
        `${job_service}/api/job/${id}/applications`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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

  const [filterStatus, setFilterStatus] = useState("All");

  const filteredApplications =
    filterStatus === "All"
      ? jobApplications
      : jobApplications.filter((app) => app.status === filterStatus);

  const [value, setValue] = useState("");
  const [chatLoading, setChatLoading] = useState<number | null>(null);
  const [isQuizManagerOpen, setIsQuizManagerOpen] = useState(false);

  const startChatWithApplicant = async (applicationId: number) => {
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

  const updateApplicationHandler = async (id: number) => {
    if (value === "") return toast.error("Please give valid value");

    try {
      const { data } = await axios.put(
        `${job_service}/api/job/application/${id}`,
        { status: value },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success((data as any).message);
      fetchJobApplications();
    } catch (error: any) {
      toast.error(error.response.data.message);
    }
  };
  return (
    <div className="min-h-screen bg-background">
      {loading ? (
        <Loading />
      ) : (
        <>
          {job && (
            <div className="max-w-5xl mx-auto px-4 py-8">
              <Button
                variant={"ghost"}
                className="mb-6 gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => router.back()}
              >
                <ArrowLeft size={18} /> Back to jobs
              </Button>

              <div className="mb-8">
                {/* Banner & Header */}
                <div className="mb-12 relative">
                  <div className="h-48 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                    
                    <div className="absolute top-6 left-6 sm:left-8 right-6 sm:right-8 flex justify-between items-start">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-semibold backdrop-blur-md ${
                        job.is_active ? "bg-emerald-500/20 text-emerald-50 border border-emerald-500/30" : "bg-red-500/20 text-red-50 border border-red-500/30"
                      }`}>
                        {job.is_active ? "Open" : "Closed"}
                      </span>
                      
                      {user && user.role === "jobseeker" && (
                          <div className="shrink-0">
                            {applied ? (
                              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/20 text-emerald-50 font-semibold backdrop-blur-md border border-emerald-500/30 shadow-sm">
                                <CheckCircle2 size={18} />
                                Already Applied
                              </div>
                            ) : (
                              job.is_active && (
                                <Button
                                  onClick={() => applyJobHandler(job.job_id)}
                                  disabled={btnLoading}
                                  className="gap-2 h-11 px-8 rounded-full bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-md transition-all"
                                >
                                  <Briefcase size={18} />
                                  {btnLoading ? "Applying..." : "Easy Apply"}
                                </Button>
                              )
                            )}
                          </div>
                      )}
                    </div>

                    <div className="absolute bottom-6 left-6 sm:left-8 right-6 sm:right-8">
                      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2 leading-tight">
                        {job.title}
                      </h1>
                      <div className="flex items-center gap-2 text-blue-100 font-medium">
                        <Building2 size={18} />
                        <span>Company Name</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Details */}
                <div className="space-y-12">
                  {/* Grid details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      <div className="flex items-center gap-4 p-5 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/60 transition-all">
                        <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                            <MapPin size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Location</p>
                            <p className="font-semibold text-foreground">{job.location}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 p-5 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/60 transition-all">
                        <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                            <IndianRupee size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Salary</p>
                            <p className="font-semibold text-foreground">{job.salary} P.A</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 p-5 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/60 transition-all">
                        <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                            <Users size={20} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Openings</p>
                            <p className="font-semibold text-foreground">{job.openings} positions</p>
                        </div>
                      </div>
                  </div>

                  {/* Job Description */}
                  <div>
                      <h2 className="text-xl font-bold flex items-center gap-2 text-foreground mb-6">
                        <Briefcase size={22} className="text-primary" />
                        Job Description
                      </h2>
                      <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                        <p className="whitespace-pre-line">{job.description}</p>
                      </div>
                  </div>

                  {/* ATS Analyzer (Jobseeker only) */}
                  {user && user.role === "jobseeker" && (
                      <div className="pt-6 border-t border-border/40">
                        <JobAtsAnalyzer jobDescription={job.description} />
                      </div>
                  )}
                  
                  {/* Explore other jobs section */}
                  {user && user.role === "jobseeker" && (
                      <div className="pt-12 mt-12 border-t border-border/40 pb-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                          <div>
                            <h2 className="text-2xl font-bold text-foreground mb-1">Looking for something else?</h2>
                            <p className="text-muted-foreground">Explore other opportunities and find the perfect role.</p>
                          </div>
                          <Button variant="outline" className="rounded-full px-6 font-semibold" onClick={() => router.push('/jobs')}>
                            View All <ArrowRight size={16} className="ml-2" />
                          </Button>
                        </div>

                        {otherJobs.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {otherJobs.map((otherJob) => (
                              <JobCard job={otherJob} key={otherJob.job_id} />
                            ))}
                          </div>
                        )}
                      </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {user && job && user.user_id === job.posted_by_recuriter_id && (
        <div className="w-[98%] max-w-[1400px] mx-auto mt-8 mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-2xl font-bold">Pipeline Dashboard</h2>
            <Button onClick={() => setIsQuizManagerOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              Manage Quiz
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
