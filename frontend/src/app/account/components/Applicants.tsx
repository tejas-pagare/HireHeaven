"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { job_service } from "@/context/AppContext";
import { Company as CompanyType, Job } from "@/type";
import Loading from "@/components/loading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Building2,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Clock,
    Eye,
    FileText,
    MessageSquare,
    Users,
    Brain,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ApplicationItem {
    application_id: number;
    job_id: number;
    applicant_id: number;
    applicant_email: string;
    status: string;
    resume: string;
    applied_at: string;
    subscribed: boolean;
}

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

const chat_service =
    process.env.NEXT_PUBLIC_CHAT_SERVICE || "http://localhost:5007";

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
                `${job_service}/api/job/company/all`,
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
                `${job_service}/api/job/application/${jobSection.job.job_id}`,
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
                `${job_service}/api/job/application/update/${applicationId}`,
                { status },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success(`Application ${status.toLowerCase()}`);

            // Refresh the applications for this job
            const jobSection = companies[companyIdx].jobs[jobIdx];
            const { data } = await axios.get(
                `${job_service}/api/job/application/${jobSection.job.job_id}`,
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
                    color: "text-green-600",
                    bg: "bg-green-50 dark:bg-green-900/20",
                    border: "border-green-200 dark:border-green-800",
                    label: "Hired",
                };
            case "Rejected":
                return {
                    icon: XCircle,
                    color: "text-red-600",
                    bg: "bg-red-50 dark:bg-red-900/20",
                    border: "border-red-200 dark:border-red-800",
                    label: "Rejected",
                };
            default:
                return {
                    icon: Clock,
                    color: "text-yellow-600",
                    bg: "bg-yellow-50 dark:bg-yellow-900/20",
                    border: "border-yellow-200 dark:border-yellow-800",
                    label: "Submitted",
                };
        }
    };

    const groupByStatus = (apps: ApplicationItem[]) => {
        const groups: Record<string, ApplicationItem[]> = {
            Submitted: [],
            Hired: [],
            Rejected: [],
        };

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
        <div className="w-full mx-auto px-4 py-6 space-y-4">
            {companies.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                        <Building2 size={32} className="opacity-40" />
                    </div>
                    <p className="text-muted-foreground">
                        No companies registered yet. Add a company to start receiving
                        applicants.
                    </p>
                </Card>
            ) : (
                companies.map((companySection, companyIdx) => (
                    <Card
                        key={companySection.company.company_id}
                        className="overflow-hidden border-2"
                    >
                        {/* Company Header */}
                        <button
                            onClick={() => toggleCompany(companyIdx)}
                            className="w-full flex items-center gap-4 p-5 hover:bg-muted/50 transition-colors text-left"
                        >
                            <div className="h-12 w-12 rounded-full border-2 overflow-hidden shrink-0 bg-background">
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
                                                                        <div className="rounded-lg border overflow-hidden">
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
                                                                                        <tr
                                                                                            key={app.application_id}
                                                                                            className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                                                                                        >
                                                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                                                {idx + 1}
                                                                                            </td>
                                                                                            <td className="px-4 py-3">
                                                                                                <Link
                                                                                                    href={`/account/${app.applicant_id}`}
                                                                                                    className="text-blue-600 hover:underline font-medium"
                                                                                                >
                                                                                                    {app.applicant_email}
                                                                                                </Link>
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                                                {new Date(
                                                                                                    app.applied_at
                                                                                                ).toLocaleDateString()}
                                                                                            </td>
                                                                                            <td className="px-4 py-3">
                                                                                                {app.subscribed ? (
                                                                                                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                                                                                                        ⭐ Premium
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-xs text-muted-foreground">
                                                                                                        Free
                                                                                                    </span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-3">
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
                                                                                                            className="h-8 w-8 text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                                                                                            title="AI Resume Intelligence"
                                                                                                        >
                                                                                                            <Brain size={14} />
                                                                                                        </Button>
                                                                                                    </Link>

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
                                                                                                            className="h-8 w-8 text-blue-600"
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

                                                                                                    {/* Status actions */}
                                                                                                    {app.status ===
                                                                                                        "Submitted" && (
                                                                                                            <>
                                                                                                                <Button
                                                                                                                    size="sm"
                                                                                                                    className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
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
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
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
    );
}
