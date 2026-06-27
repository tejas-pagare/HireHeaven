"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    FileText,
    Upload,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    Loader2,
    FileCheck,
    Zap,
    UserCircle,
} from "lucide-react";
import axios from "axios";
import { ResumeAnalysisResponse } from "@/type";
import { utils_service, useAppData } from "@/context/AppContext";
import toast from "react-hot-toast";

interface JobAtsAnalyzerProps {
    jobDescription: string;
}

type ResumeSource = "existing" | "new" | null;

const JobAtsAnalyzer = ({ jobDescription }: JobAtsAnalyzerProps) => {
    const { user } = useAppData();
    const hasExistingResume = !!user?.resume;

    const [open, setOpen] = useState(false);
    const [resumeSource, setResumeSource] = useState<ResumeSource>(hasExistingResume ? "existing" : "new");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<ResumeAnalysisResponse | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== "application/pdf") {
                toast.error("Please upload a PDF file");
                return;
            }
            if (selectedFile.size > 5 * 1024 * 1024) {
                toast.error("File size should be less than 5MB");
                return;
            }
            setFile(selectedFile);
        }
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const analyzeResume = async () => {
        if (resumeSource === "new" && !file) {
            toast.error("Please upload a resume");
            return;
        }
        if (!jobDescription) {
            toast.error("Job description is missing");
            return;
        }

        setLoading(true);
        try {
            let payload: any = { jobDescription };

            if (resumeSource === "existing" && user?.resume) {
                payload.resumeUrl = user.resume;
            } else if (file) {
                payload.pdfBase64 = await convertToBase64(file);
            }

            const { data } = await axios.post<ResumeAnalysisResponse>(
                `${utils_service}/api/utils/ats-job-match`,
                payload
            );
            setResponse(data);
            toast.success("Resume analyzed against job successfully!");
            setOpen(false); // Close dialog on success
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to analyze resume");
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    const resetDialog = () => {
        setFile(null);
        setResponse(null);
        setOpen(false);
        setResumeSource(hasExistingResume ? "existing" : "new");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-600";
        if (score >= 60) return "text-yellow-600";
        return "text-red-600";
    };

    const getScoreBgColor = (score: number) => {
        if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
        if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/30";
        return "bg-red-100 dark:bg-red-900/30";
    };

    const getPriorityColor = (priority: string) => {
        if (priority === "high")
            return "bg-red-100 dark:bg-red-900/30 text-red-600 border-red-200 dark:border-red-800";
        if (priority === "medium")
            return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 border-yellow-200 dark:border-yellow-800";
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 border-blue-200 dark:border-blue-800";
    };

    return (
        <div className="mt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-100 dark:border-blue-900/50">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                            <FileCheck size={20} className="text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold">ATS Resume Match Check</h3>
                    </div>
                    <p className="text-sm opacity-70">
                        Check how well your resume matches this specific job description. Get tailored recommendations to improve your ATS score before applying.
                    </p>
                </div>

                <Dialog open={open} onOpenChange={(isOpen) => {
                    setOpen(isOpen);
                    if (!isOpen && !response) resetDialog();
                }}>
                    <DialogTrigger asChild>
                        <Button size="lg" className="gap-2 shrink-0">
                            <Zap size={18} />
                            Check ATS Match
                        </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-2xl flex items-center gap-2">
                                    <FileText className="text-blue-600" />
                                    Choose Resume Source
                                </DialogTitle>
                                <DialogDescription>
                                    We'll compare your resume against the requirements for this specific role.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6 py-4">
                                {hasExistingResume && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div
                                            onClick={() => setResumeSource("existing")}
                                            className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${resumeSource === "existing"
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                    : "border-gray-200 hover:border-blue-300"
                                                }`}
                                        >
                                            <div className="flex flex-col items-center gap-3 text-center">
                                                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                    <UserCircle size={24} className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">Use Profile Resume</p>
                                                    <p className="text-sm opacity-70 mt-1">Analyze the resume currently saved to your profile</p>
                                                </div>
                                                {resumeSource === "existing" && (
                                                    <div className="flex items-center gap-1.5 text-blue-600 mt-2">
                                                        <CheckCircle2 size={16} />
                                                        <span className="text-sm font-medium">Selected</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => setResumeSource("new")}
                                            className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${resumeSource === "new"
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                    : "border-gray-200 hover:border-blue-300"
                                                }`}
                                        >
                                            <div className="flex flex-col items-center gap-3 text-center">
                                                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                    <Upload size={24} className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">Upload New Resume</p>
                                                    <p className="text-sm opacity-70 mt-1">Select a different PDF file from your device</p>
                                                </div>
                                                {resumeSource === "new" && (
                                                    <div className="flex items-center gap-1.5 text-blue-600 mt-2">
                                                        <CheckCircle2 size={16} />
                                                        <span className="text-sm font-medium">Selected</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {resumeSource === "new" && (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
                                    >
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                <Upload size={32} className="text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium mb-1">
                                                    {file ? file.name : "Click to upload your resume"}
                                                </p>
                                                <p className="text-sm opacity-60">
                                                    PDF format only, maximum 5MB
                                                </p>
                                            </div>
                                            {file && (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle2 size={18} />
                                                    <span className="text-sm font-medium">
                                                        File uploaded successfully
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                <Button
                                    onClick={analyzeResume}
                                    disabled={(resumeSource === "new" && !file) || loading}
                                    className="w-full gap-2"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <Zap size={18} />
                                    )}
                                    {loading ? "Analyzing..." : "Analyze Resume"}
                                </Button>
                            </div>
                        </>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Render results underneath if response exists */}
            {response && (
                <div className="mt-6 space-y-6 bg-background p-6 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <FileCheck className="text-blue-600" />
                            Job Match Results
                        </h2>
                        <Button
                            onClick={() => {
                                setResponse(null);
                                setOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                        >
                            Test Another
                        </Button>
                    </div>

                    {/* Overall Score */}
                    <div
                        className={`p-6 rounded-lg ${getScoreBgColor(
                            response.atsScore
                        )} border-2`}
                    >
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-1">
                                <p className="text-sm font-medium opacity-70 mb-2">
                                    Job Match Score
                                </p>
                                <div
                                    className={`text-6xl md:text-7xl font-bold tracking-tighter ${getScoreColor(
                                        response.atsScore
                                    )}`}
                                >
                                    {response.atsScore}
                                </div>
                                <p className="text-sm opacity-70 mt-2">out of 100</p>
                            </div>
                            <div className="flex-[2] p-4 rounded-lg bg-background/50 border border-current/10">
                                <p className="text-base leading-relaxed font-medium">
                                    {response.summary}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Breakdown & Strengths side */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-blue-500" />
                                    Detailed Breakdown
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(response.scoreBreakdown).map(
                                        ([key, value]) => (
                                            <div key={key} className="p-4 rounded-lg border bg-background hover:bg-secondary/50 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="font-semibold capitalize text-sm">{key}</p>
                                                    <span
                                                        className={`text-base font-bold ${getScoreColor(
                                                            value.score
                                                        )}`}
                                                    >
                                                        {value.score}%
                                                    </span>
                                                </div>
                                                <p className="text-xs opacity-70">
                                                    {value.feedback}
                                                </p>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <CheckCircle2 size={20} className="text-green-600" />
                                    Matching Strengths
                                </h3>
                                <ul className="space-y-2">
                                    {response.strengths.map((strength, index) => (
                                        <li
                                            key={index}
                                            className="text-sm flex items-start gap-2"
                                        >
                                            <span className="text-green-600 mt-0.5">✓</span>
                                            <span>{strength}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Suggestions side */}
                        <div>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <AlertTriangle size={20} className="text-orange-500" />
                                Missing Keywords & Improvements
                            </h3>
                            <div className="space-y-3">
                                {response.suggestions.map((suggestion, index) => (
                                    <div key={index} className="p-4 rounded-lg border bg-background">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <h4 className="font-semibold text-sm">
                                                {suggestion.category}
                                            </h4>
                                            <span
                                                className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(
                                                    suggestion.priority
                                                )}`}
                                            >
                                                {suggestion.priority} priority
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="font-medium opacity-70">
                                                    Gap:{" "}
                                                </span>
                                                <span className="opacity-80">
                                                    {suggestion.issue}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-medium opacity-70">
                                                    Recommendation:{" "}
                                                </span>
                                                <span className="opacity-80">
                                                    {suggestion.recommendation}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobAtsAnalyzer;

