"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import { User } from "@/type";
import { user_service, useAppData } from "@/context/AppContext";
import ResumeIntelligence from "@/components/resume-intelligence";
import Loading from "@/components/loading";
import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ResumeIntelligencePage() {
    const params = useParams();
    const router = useRouter();
    const { user: currentUser, isAuth, loading: authLoading } = useAppData();
    const [candidateUser, setCandidateUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const token = Cookies.get("token");

    const userId = params?.userId as string;

    useEffect(() => {
        if (authLoading) return;

        // Auth guard — redirect if not logged in
        if (!isAuth) {
            router.push("/login");
            return;
        }

        // Role guard — recruiter only
        if (currentUser?.role !== "recruiter") {
            setError("Only recruiters can access Resume Intelligence");
            setLoading(false);
            return;
        }

        fetchCandidate();
    }, [userId, isAuth, authLoading, currentUser]);

    async function fetchCandidate() {
        try {
            const { data } = await axios.get<User>(
                `${user_service}/api/user/${userId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setCandidateUser(data);
        } catch (err: any) {
            setError(
                err.response?.data?.message || "Failed to load candidate profile"
            );
        } finally {
            setLoading(false);
        }
    }

    if (authLoading || loading) return <Loading />;

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
                <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <Shield className="h-8 w-8 text-red-400" />
                </div>
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                    {error}
                </p>
                <Button variant="outline" asChild>
                    <Link href="/account" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Account
                    </Link>
                </Button>
            </div>
        );
    }

    if (!candidateUser) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">Candidate not found</p>
            </div>
        );
    }

    return <ResumeIntelligence candidateUser={candidateUser} />;
}
