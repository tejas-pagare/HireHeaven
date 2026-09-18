"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { useAppData } from "@/context/AppContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Loading from "@/components/loading";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { job_service } from "@/context/AppContext";

interface QuizQuestion {
    question_id: number;
    question_text: string;
    options: string[];
}

interface QuizData {
    quiz: { quiz_id: number; job_id: number };
    questions: QuizQuestion[];
}

export default function QuizPage() {
    const { id: jobId } = useParams();
    const searchParams = useSearchParams();
    const applicationId = searchParams.get("application_id");
    const router = useRouter();
    const { user, isAuth, loading: appLoading, fetchApplications } = useAppData();

    const [loading, setLoading] = useState(true);
    const [quizData, setQuizData] = useState<QuizData | null>(null);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submittedScore, setSubmittedScore] = useState<number | null>(null);

    useEffect(() => {
        if (!isAuth && !appLoading) {
            router.push("/login");
            return;
        }

        if (user && user.role !== "jobseeker") {
            router.push("/");
            return;
        }

        if (!applicationId) {
            toast.error("Invalid application reference");
            router.push("/account");
            return;
        }

        const fetchQuiz = async () => {
            try {
                const token = Cookies.get("token");
                const { data } = await axios.get(`${job_service}/api/job/quiz/${jobId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setQuizData(data as QuizData);
            } catch (error: any) {
                toast.error(error.response?.data?.message || "Failed to load quiz");
                router.push("/account");
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchQuiz();
        }
    }, [user, isAuth, appLoading, jobId, applicationId, router]);

    const handleOptionSelect = (questionId: number, optionIndex: number) => {
        setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    };

    const handleSubmit = async () => {
        if (!quizData) return;

        // Check if all questions are answered
        const allAnswered = quizData.questions.every((q) => answers[q.question_id] !== undefined);
        if (!allAnswered) {
            return toast.error("Please answer all questions before submitting.");
        }

        setSubmitting(true);
        const token = Cookies.get("token");
        try {
            const { data } = await axios.post(
                `${job_service}/api/job/quiz/submit`,
                { application_id: Number(applicationId), answers },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSubmittedScore((data as any).score);
            toast.success("Quiz submitted successfully!");
            fetchApplications(); // Refresh to update score in the context
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to submit quiz");
        } finally {
            setSubmitting(false);
        }
    };

    if (appLoading || loading) return <Loading />;

    if (submittedScore !== null) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-secondary/30 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="h-20 w-20 bg-success-subtle rounded-full flex items-center justify-center">
                            <CheckCircle2 size={40} className="text-success-subtle-foreground" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Quiz Submitted!</h2>
                        <p className="text-muted-foreground">Your assignment has been recorded.</p>
                    </div>
                    <div className="bg-background border rounded-xl p-6">
                        <p className="text-sm font-medium mb-1 opacity-70">Your Score</p>
                        <p className="text-4xl font-bold text-primary">{submittedScore}%</p>
                    </div>
                    <Button onClick={() => router.push("/account")} className="w-full bg-primary hover:bg-[var(--primary-hover)]">
                        Return to Dashboard
                    </Button>
                </Card>
            </div>
        );
    }

    if (!quizData || quizData.questions.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-secondary/30">
                <p className="mb-4">No questions found for this assignment.</p>
                <Button onClick={() => router.push("/account")}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-secondary/30 py-10 px-4">
            <div className="max-w-3xl mx-auto">
                <Button variant={"ghost"} className="mb-6 gap-2" onClick={() => router.push("/account")}>
                    <ArrowLeft size={18} /> Back to Dashboard
                </Button>

                <Card className="p-8 shadow-sm mb-6">
                    <h1 className="text-2xl font-bold mb-2">Technical Assignment</h1>
                    <p className="text-muted-foreground">
                        Please answer all the questions below. Your score will be automatically calculated and submitted to the recruiter.
                    </p>
                </Card>

                <div className="space-y-6">
                    {quizData.questions.map((q, index) => (
                        <Card key={q.question_id} className="p-6">
                            <h3 className="font-semibold text-lg mb-4">
                                <span className="opacity-50 mr-2">{index + 1}.</span>
                                {q.question_text}
                            </h3>
                            <div className="space-y-3">
                                {q.options.map((opt, optIndex) => (
                                    <label
                                        key={optIndex}
                                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${answers[q.question_id] === optIndex
                                            ? "border-primary/25 bg-brand-subtle/50"
                                            : "border-transparent bg-secondary hover:border-border"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name={`question-${q.question_id}`}
                                            value={optIndex}
                                            checked={answers[q.question_id] === optIndex}
                                            onChange={() => handleOptionSelect(q.question_id, optIndex)}
                                            className="w-4 h-4 text-primary"
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="mt-8 flex justify-end">
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="bg-primary hover:bg-[var(--primary-hover)] text-primary-foreground px-8 py-6 text-lg"
                    >
                        {submitting ? "Submitting..." : "Submit Assignment"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
