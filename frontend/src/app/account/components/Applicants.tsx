"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { job_service } from "@/context/AppContext";
import { Company as CompanyType, Job } from "@/type";
import Loading from "@/components/loading";
import { Card } from "@/components/ui/card";
import SectionHeader from "./section-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Building2,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Clock,
    Eye,
    FileText,
    ListChecks,
    MessageSquare,
    Users,
    Brain,
    Mic,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BACKEND_URL } from "@/lib/config";

interface ApplicationItem {
    application_id: number;
    job_id: number;
    applicant_id: number;
    applicant_email: string;
    status: string;
    resume: string;
    applied_at: string;
    subscribed: boolean;
    ai_interview_completed?: boolean;
    ai_interview_recommendation?: "Strong Yes" | "Yes" | "Borderline" | "No" | null;
    ai_interview_manual_review?: boolean;
}

const AI_RECOMMENDATION_BADGE_STYLES: Record<string, string> = {
    "Strong Yes": "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    Yes: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
    Borderline: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    No: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

interface JobWithApps {
    job: Job;
    applications: ApplicationItem[];
    loading: boolean;
    expanded: boolean;
}

interface CompanySection {
    company: CompanyType;
    jobs: JobWithApps[];
    expanded: boolean;
}

const chat_service = BACKEND_URL;

export default function Applicants() {
    const [companies, setCompanies] = useState<CompanySection[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [chatLoading, setChatLoading] = useState<number | null>(null);
    const token = Cookies.get("token");
    const router = useRouter();

    // Fetch all companies, then each company's details (which include jobs)
    async function fetchData() {
        try {
            const { data: companiesData } = await axios.get(
                `${job_service}/api/job/company`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const sections: CompanySection[] = [];

            for (const company of companiesData as CompanyType[]) {
                // Fetch company details which include jobs
                const { data: companyDetail } = await axios.get(
                    `${job_service}/api/job/company/${company.company_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const detail = companyDetail as CompanyType;
                const jobsSections: JobWithApps[] = (detail.jobs || []).map((job: Job) => ({
                    job,
                    applications: [],
                    loading: false,
                    expanded: false,
                }));

                sections.push({
                    company: detail,
                    jobs: jobsSections,
                    expanded: false,
                });
            }

            setCompanies(sections);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load companies");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    // Toggle company expansion
    const toggleCompany = (companyIdx: number) => {
        setCompanies((prev) =>
            prev.map((c, i) =>
                i === companyIdx ? { ...c, expanded: !c.expanded } : c
            )
        );
    };

    // Toggle job expansion and load applications
    const toggleJob = async (companyIdx: number, jobIdx: number) => {
        const section = companies[companyIdx];
        const jobSection = section.jobs[jobIdx];

        if (jobSection.expanded) {
            // Just collapse
            setCompanies((prev) =>
                prev.map((c, ci) =>
                    ci === companyIdx
                        ? {
                            ...c,
                            jobs: c.jobs.map((j, ji) =>
                                ji === jobIdx ? { ...j, expanded: false } : j
                            ),
                        }
                        : c
                )
            );
            return;
        }

        // Expand and load applications
        setCompanies((prev) =>
            prev.map((c, ci) =>
                ci === companyIdx
                    ? {
                        ...c,
                        jobs: c.jobs.map((j, ji) =>
                            ji === jobIdx ? { ...j, expanded: true, loading: true } : j
                        ),
                    }
                    : c
            )
        );

        try {
            const { data } = await axios.get(
                `${job_service}/api/job/${jobSection.job.job_id}/applications`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCompanies((prev) =>
                prev.map((c, ci) =>
                    ci === companyIdx
                        ? {
                            ...c,
                            jobs: c.jobs.map((j, ji) =>
                                ji === jobIdx
                                    ? {
                                        ...j,
                                        applications: data as ApplicationItem[],
                                        loading: false,
                                    }
                                    : j
                            ),
                        }
                        : c
                )
            );
        } catch (error) {
            console.error(error);
            toast.error("Failed to load applications");
            setCompanies((prev) =>
                prev.map((c, ci) =>
                    ci === companyIdx
                        ? {
                            ...c,
                            jobs: c.jobs.map((j, ji) =>
                                ji === jobIdx ? { ...j, loading: false } : j
                            ),
                        }
                        : c
                )
            );
        }
    };

    // Update application status
    const updateStatus = async (
        applicationId: number,
        status: string,
        companyIdx: number,
        jobIdx: number
    ) => {
        setUpdatingId(applicationId);
        try {
            await axios.put(
                `${job_service}/api/job/application/${applicationId}`,
                { status },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success(`Application ${status.toLowerCase()}`);

            // Refresh the applications for this job
            const jobSection = companies[companyIdx].jobs[jobIdx];
            const { data } = await axios.get(
                `${job_service}/api/job/${jobSection.job.job_id}/applications`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCompanies((prev) =>
                prev.map((c, ci) =>
                    ci === companyIdx
                        ? {
                            ...c,
                            jobs: c.jobs.map((j, ji) =>
                                ji === jobIdx
                                    ? { ...j, applications: data as ApplicationItem[] }
                                    : j
                            ),
                        }
                        : c
                )
            );
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message || "Failed to update application"
            );
        } finally {
            setUpdatingId(null);
        }
    };

    // Start chat with applicant
    const startChat = async (applicationId: number) => {
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

    const getStatusConfig = (status: string) => {
        switch (status) {
            case "Hired":
                return {
                    icon: CheckCircle2,
                    color: "text-success-subtle-foreground",
                    bg: "bg-success-subtle",
                    border: "border-success/25",
                    label: "Hired",
                };
            case "Rejected":
                return {
                    icon: XCircle,
                    color: "text-destructive-subtle-foreground",
                    bg: "bg-destructive-subtle",
                    border: "border-destructive/25",
                    label: "Rejected",
                };
            default:
                return {
                    icon: Clock,
                    color: "text-warning-subtle-foreground",
                    bg: "bg-warning-subtle",
                    border: "border-warning/25",
                    label: "Submitted",
                };
        }
    };

    const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.Submitted;

    const groupByStatus = (apps: ApplicationItem[]) => {
        const groups: Record<string, ApplicationItem[]> = {};
        Object.keys(STATUS_CONFIG).forEach((s) => { groups[s] = []; });

        apps.forEach((app) => {
            if (groups[app.status]) {
                groups[app.status].push(app);
            } else {
 groups["Submitted"].push(app);
            }
        });

        return groups;
    };

    if (loading) return <Loading />;

    return (
        <div className="mx-auto w-full max-w-6xl">
            <SectionHeader
                title="Applicants"
                description="Expand a company, then a role, to review who applied."
            />
            <div className="space-y-4">
            {companies.length === 0 ? (
                <div className="rounded-2xl border border-dashed py-14 text-center">
                    <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-muted">
                        <Building2 size={28} className="text-muted-foreground" />
                    </div>
                    <p className="mb-1.5 font-semibold">No companies registered yet</p>
                    <p className="text-sm text-muted-foreground">
                        Add a company to start receiving applicants.
                    </p>
                </div>
            ) : (
                companies.map((companySection, companyIdx) => (
                    <Card
                        key={companySection.company.company_id}
                        variant="elevated"
                        className="gap-0 overflow-hidden p-0"
                    >
                        {/* Company Header */}
                        <button
                            onClick={() => toggleCompany(companyIdx)}
                            className="w-full flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors text-left"
                        >
                            <div className="size-12 shrink-0 overflow-hidden rounded-xl border bg-card">
                                <img
                                    src={companySection.company.logo}
                                    alt={companySection.company.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-lg">
                                    {companySection.company.name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {companySection.jobs.length} job
                                    {companySection.jobs.length !== 1 ? "s" : ""} posted
                                </p>
                            </div>
                            {companySection.expanded ? (
                                <ChevronDown size={20} className="text-muted-foreground" />
                            ) : (
                                <ChevronRight size={20} className="text-muted-foreground" />
                            )}
                        </button>

                        {/* Jobs List */}
                        {companySection.expanded && (
                            <div className="border-t">
                                {companySection.jobs.length === 0 ? (
                                    <div className="p-6 text-center text-muted-foreground text-sm">
                                        No jobs posted for this company yet.
                                    </div>
                                ) : (
                                    companySection.jobs.map((jobSection, jobIdx) => (
                                        <div
                                            key={jobSection.job.job_id}
                                            className="border-b last:border-b-0"
                                        >
                                            {/* Job Header */}
                                            <button
                                                onClick={() => toggleJob(companyIdx, jobIdx)}
                                                className="w-full flex items-center gap-3 px-6 py-4 hover:bg-muted/30 transition-colors text-left"
                                            >
                                                {jobSection.expanded ? (
                                                    <ChevronDown
                                                        size={16}
                                                        className="text-muted-foreground shrink-0"
                                                    />
                                                ) : (
                                                    <ChevronRight
                                                        size={16}
                                                        className="text-muted-foreground shrink-0"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium">{jobSection.job.title}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {jobSection.job.location} ·{" "}
                                                        {jobSection.job.job_type} ·{" "}
                                                        {jobSection.job.work_location}
                                                    </p>
                                                </div>
                                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                                                    <Users size={12} />
                                                    {jobSection.applications.length > 0
                                                        ? `${jobSection.applications.length} applicant${jobSection.applications.length !== 1 ? "s" : ""}`
                                                        : "View applicants"}
                                                </span>
                                            </button>

                                            {/* Applications Table */}
                                            {jobSection.expanded && (
                                                <div className="px-6 pb-5">
                                                    {jobSection.loading ? (
                                                        <div className="py-8 text-center text-muted-foreground text-sm">
                                                            Loading applications...
                                                        </div>
                                                    ) : jobSection.applications.length === 0 ? (
                                                        <div className="py-8 text-center text-muted-foreground text-sm">
                                                            No applications received yet.
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-6">
                                                            {Object.entries(
                                                                groupByStatus(jobSection.applications)
                                                            ).map(([status, apps]) => {
                                                                if (apps.length === 0) return null;
                                                                const statusConfig = getStatusConfig(status);
                                                                const StatusIcon = statusConfig.icon;

                                                                return (
                                                                    <div key={status}>
                                                                        {/* Status Section Header */}
                                                                        <div
                                                                            className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg ${statusConfig.bg}`}
                                                                        >
                                                                            <StatusIcon
                                                                                size={16}
                                                                                className={statusConfig.color}
                                                                            />
                                                                            <span
                                                                                className={`text-sm font-semibold ${statusConfig.color}`}
                                                                            >
                                                                                {statusConfig.label} ({apps.length})
                                                                            </span>
                                                                        </div>

                                                                        {/* Table */}
                                                                        <div className="overflow-hidden rounded-xl border bg-card">
                                                                            <table className="w-full text-sm">
                                                                                <thead>
                                                                                    <tr className="bg-muted/50 border-b">
                                                                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                                                                                            #
                                                                                        </th>
                                                                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                                                                                            Email
                                                                                        </th>
                                                                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                                                                                            Applied
                                                                                        </th>
                                                                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                                                                                            Premium
                                                                                        </th>
                                                                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                                                                                            Actions
                                                                                        </th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {apps.map((app, idx) => (
                                                                                        <TableRow key={app.application_id}>
                                                                                            <TableCell className="text-muted-foreground">
                                                                                                {idx + 1}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                <Link
                                                                                                    href={`/account/${app.applicant_id}`}
                                                                                                    className="text-primary hover:underline font-medium"
                                                                                                >
                                                                                                    {app.applicant_email}
                                                                                                </Link>
                                                                                            </TableCell>
                                                                                            <TableCell className="text-muted-foreground">
                                                                                                {new Date(
                                                                                                    app.applied_at
                                                                                                ).toLocaleDateString()}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                {app.subscribed ? (
                                                                                                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-brand-subtle text-brand-subtle-foreground">
                                                                                                        ⭐ Premium
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-xs text-muted-foreground">
                                                                                                        Free
                                                                                                    </span>
                                                                                                )}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                <div className="flex items-center justify-end gap-1.5">
                                                                                                    {/* Resume */}
                                                                                                    {app.resume && (
                                                                                                        <Link
                                                                                                            href={app.resume}
                                                                                                            target="_blank"
                                                                                                        >
                                                                                                            <Button
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                className="h-8 w-8"
                                                                                                                title="View Resume"
                                                                                                            >
                                                                                                                <FileText size={14} />
                                                                                                            </Button>
                                                                                                        </Link>
                                                                                                    )}

                                                                                                    {/* AI Resume Intelligence */}
                                                                                                    <Link
                                                                                                        href={`/resume-intelligence/${app.applicant_id}`}
                                                                                                    >
                                                                                                        <Button
                                                                                                            variant="ghost"
                                                                                                            size="icon"
                                                                                                            className="h-8 w-8 text-brand-subtle-foreground hover:text-brand-subtle-foreground hover:bg-brand-subtle"
                                                                                                            title="AI Resume Intelligence"
                                                                                                        >
                                                                                                            <Brain size={14} />
                                                                                                        </Button>
                                                                                                    </Link>

                                                                                                    {/* AI Interview Result */}
                                                                                                    {app.ai_interview_completed && (
                                                                                                        <Link
                                                                                                            href={`/ai-interview/result/${app.application_id}`}
                                                                                                            className="flex items-center gap-1"
                                                                                                        >
                                                                                                            <Button
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                className="h-8 w-8 text-success hover:text-success-subtle-foreground hover:bg-success-subtle"
                                                                                                                title="AI Interview Result"
                                                                                                            >
                                                                                                                <Mic size={14} />
                                                                                                            </Button>
                                                                                                            {app.ai_interview_manual_review ? (
                                                                                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                                                                                                    Review
                                                                                                                </span>
                                                                                                            ) : app.ai_interview_recommendation ? (
                                                                                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${AI_RECOMMENDATION_BADGE_STYLES[app.ai_interview_recommendation]}`}>
                                                                                                                    {app.ai_interview_recommendation}
                                                                                                                </span>
                                                                                                            ) : null}
                                                                                                        </Link>
                                                                                                    )}

                                                                                                    {/* View Profile */}
                                                                                                    <Link
                                                                                                        href={`/account/${app.applicant_id}`}
                                                                                                    >
                                                                                                        <Button
                                                                                                            variant="ghost"
                                                                                                            size="icon"
                                                                                                            className="h-8 w-8"
                                                                                                            title="View Profile"
                                                                                                        >
                                                                                                            <Eye size={14} />
                                                                                                        </Button>
                                                                                                    </Link>

                                                                                                    {/* Chat */}
                                                                                                    {app.status !== "Rejected" && (
                                                                                                        <Button
                                                                                                            variant="ghost"
                                                                                                            size="icon"
                                                                                                            className="h-8 w-8 text-primary"
                                                                                                            title="Chat"
                                                                                                            onClick={() =>
                                                                                                                startChat(
                                                                                                                    app.application_id
                                                                                                                )
                                                                                                            }
                                                                                                            disabled={
                                                                                                                chatLoading ===
                                                                                                                app.application_id
                                                                                                            }
                                                                                                        >
                                                                                                            <MessageSquare
                                                                                                                size={14}
                                                                                                            />
                                                                                                        </Button>
                                                                                                    )}

                                                                                                    {/* Full status + round timeline */}
                                                                                                    <Link
                                                                                                        href={`/jobs/${jobSection.job.job_id}/applicants/${app.application_id}`}
                                                                                                    >
                                                                                                        <Button
                                                                                                            variant="ghost"
                                                                                                            size="icon"
                                                                                                            className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                                                                                            title="View Status"
                                                                                                        >
                                                                                                            <ListChecks size={14} />
                                                                                                        </Button>
                                                                                                    </Link>

                                                                                                    {/* Status actions */}
                                                                                                    {app.status ===
                                                                                                        "Submitted" && (
                                                                                                            <>
                                                                                                                <Button
                                                                                                                    size="sm"
                                                                                                                    className="h-7 text-xs gap-1 bg-success hover:bg-success"
                                                                                                                    onClick={() =>
                                                                                                                        updateStatus(
                                                                                                                            app.application_id,
                                                                                                                            "Hired",
                                                                                                                            companyIdx,
                                                                                                                            jobIdx
                                                                                                                        )
                                                                                                                    }
                                                                                                                    disabled={
                                                                                                                        updatingId ===
                                                                                                                        app.application_id
                                                                                                                    }
                                                                                                                >
                                                                                                                    <CheckCircle2
                                                                                                                        size={12}
                                                                                                                    />
                                                                                                                    Hire
                                                                                                                </Button>
                                                                                                                <Button
                                                                                                                    size="sm"
                                                                                                                    variant="destructive"
                                                                                                                    className="h-7 text-xs gap-1"
                                                                                                                    onClick={() =>
                                                                                                                        updateStatus(
                                                                                                                            app.application_id,
                                                                                                                            "Rejected",
                                                                                                                            companyIdx,
                                                                                                                            jobIdx
                                                                                                                        )
                                                                                                                    }
                                                                                                                    disabled={
                                                                                                                        updatingId ===
                                                                                                                        app.application_id
                                                                                                                    }
                                                                                                                >
                                                                                                                    <XCircle size={12} />
                                                                                                                    Reject
                                                                                                                </Button>
                                                                                                            </>
                                                                                                        )}
                                                                                                </div>
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </Card>
                ))
            )}
            </div>
        </div>
    );
}
