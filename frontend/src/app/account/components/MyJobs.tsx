"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { job_service } from "@/context/AppContext";
import { Company as CompanyType, Job } from "@/type";
import Loading from "@/components/loading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Briefcase,
    Eye,
    Users,
    MapPin,
    Clock,
    Laptop,
    CheckCircle,
    XCircle,
    Plus,
    Building2,
    DollarSign,
} from "lucide-react";
import Link from "next/link";

interface JobWithCompany extends Job {
    company: CompanyType;
}

export default function MyJobs({ onViewApplicants }: { onViewApplicants?: () => void }) {
    const [jobs, setJobs] = useState<JobWithCompany[]>([]);
    const [loading, setLoading] = useState(true);
    const token = Cookies.get("token");

    async function fetchAllJobs() {
        try {
            setLoading(true);
            // Fetch all companies for this recruiter
            const { data: companiesData } = await axios.get(
                `${job_service}/api/job/company`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const allJobs: JobWithCompany[] = [];

            for (const company of companiesData as CompanyType[]) {
                const { data: companyDetail } = await axios.get(
                    `${job_service}/api/job/company/${company.company_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const detail = companyDetail as CompanyType;
                if (detail.jobs && detail.jobs.length > 0) {
                    for (const job of detail.jobs) {
                        allJobs.push({ ...job, company: detail });
                    }
                }
            }

            // Sort by newest first
            allJobs.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setJobs(allJobs);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load jobs");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAllJobs();
    }, []);

    const deleteJob = async (jobId: number) => {
        if (!confirm("Are you sure you want to delete this job?")) return;
        try {
            await axios.delete(`${job_service}/api/job/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success("Job deleted successfully");
            fetchAllJobs();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to delete job");
        }
    };

    return (
        <Card className="shadow-lg border-2">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-2xl">My Jobs</CardTitle>
                    <CardDescription>
                        All jobs posted across your companies
                    </CardDescription>
                </div>
                {/* Link to first company page where they can create a job,
                    or show a tooltip if no companies exist */}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loading />
                    </div>
                ) : jobs.length > 0 ? (
                    <div className="space-y-4">
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Job Title</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Openings</TableHead>
                                        <TableHead>Salary</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Posted</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobs.map((job) => (
                                        <TableRow key={job.job_id}>
                                            {/* Company */}
                                            <TableCell>
                                                <Link
                                                    href={`/company/${job.company.company_id}`}
                                                    className="flex items-center gap-2 hover:underline"
                                                >
                                                    <img
                                                        src={job.company.logo}
                                                        alt={job.company.name}
                                                        className="w-7 h-7 rounded-full object-cover border"
                                                    />
                                                    <span className="text-sm font-medium truncate max-w-[120px]">
                                                        {job.company.name}
                                                    </span>
                                                </Link>
                                            </TableCell>

                                            {/* Title */}
                                            <TableCell className="font-semibold">
                                                {job.title}
                                            </TableCell>

                                            {/* Location */}
                                            <TableCell>
                                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    <MapPin size={13} />
                                                    {job.location || "—"}
                                                </span>
                                            </TableCell>

                                            {/* Job Type + Work Location */}
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={13} />
                                                        {job.job_type}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Laptop size={13} />
                                                        {job.work_location}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Openings */}
                                            <TableCell>
                                                <span className="flex items-center gap-1 text-sm">
                                                    <Users size={13} />
                                                    {job.openings}
                                                </span>
                                            </TableCell>

                                            {/* Salary */}
                                            <TableCell>
                                                <span className="text-sm">
                                                    {job.salary
                                                        ? `₹${job.salary.toLocaleString()}`
                                                        : "Not Disclosed"}
                                                </span>
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell>
                                                {job.is_active ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600 dark:bg-green-900/30">
                                                        <CheckCircle size={12} />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                                                        <XCircle size={12} />
                                                        Inactive
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Posted Date */}
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(job.created_at).toLocaleDateString()}
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Preview */}
                                                    <Link href={`/jobs/${job.job_id}`}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 gap-1 text-blue-600"
                                                            title="Preview Job"
                                                        >
                                                            <Eye size={14} />
                                                            Preview
                                                        </Button>
                                                    </Link>

                                                    {/* View Applicants */}
                                                    {onViewApplicants ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 gap-1 text-purple-600"
                                                            title="View Applicants"
                                                            onClick={onViewApplicants}
                                                        >
                                                            <Users size={14} />
                                                            Applicants
                                                        </Button>
                                                    ) : (
                                                        <Link href={`/company/${job.company.company_id}`}>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 gap-1 text-purple-600"
                                                                title="View on Company Page"
                                                            >
                                                                <Users size={14} />
                                                                Applicants
                                                            </Button>
                                                        </Link>
                                                    )}

                                                    {/* Delete */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500"
                                                        title="Delete Job"
                                                        onClick={() => deleteJob(job.job_id)}
                                                    >
                                                        <XCircle size={14} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="text-sm text-muted-foreground px-2">
                            {jobs.length} job{jobs.length !== 1 ? "s" : ""} total
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                            <Briefcase size={32} className="opacity-40" />
                        </div>
                        <p className="text-muted-foreground mb-4">
                            You haven't posted any jobs yet. Add a company first, then post jobs from the company page.
                        </p>
                        <Link href="/account">
                            <Button variant="outline" className="gap-2">
                                <Building2 size={16} />
                                Go to Companies
                            </Button>
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
