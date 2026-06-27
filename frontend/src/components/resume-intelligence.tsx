"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Brain,
    Send,
    Loader2,
    FileText,
    Sparkles,
    ChevronDown,
    ChevronRight,
    GraduationCap,
    Briefcase,
    Code2,
    Cpu,
    RefreshCw,
    Bot,
    User as UserIcon,
    Zap,
    FileSearch,
    Target,
    AlertCircle,
} from "lucide-react";
import {
    ResumeQueryResponse,
    ResumeIndexStatus,
    ResumeStructured,
    User,
} from "@/type";
import { utils_service } from "@/context/AppContext";

interface ResumeIntelligenceProps {
    candidateUser: User;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    sources?: ResumeQueryResponse["sources"];
    confidence?: number;
    timestamp: Date;
}

const QUICK_QUESTIONS = [
    {
        label: "Technical Skills",
        question: "What technologies and programming languages does this candidate know?",
        icon: Code2,
    },
    {
        label: "Work Experience",
        question: "Summarize this candidate's work experience including companies and roles.",
        icon: Briefcase,
    },
    {
        label: "Projects",
        question: "What projects has this candidate worked on? Describe each briefly.",
        icon: Cpu,
    },
    {
        label: "Education",
        question: "What is this candidate's educational background?",
        icon: GraduationCap,
    },
    {
        label: "Backend Exp",
        question: "Does this candidate have backend development experience? What technologies?",
        icon: FileSearch,
    },
    {
        label: "Strengths",
        question: "What are the top 3 strengths of this candidate based on their resume?",
        icon: Target,
    },
];

const SECTION_TYPE_COLORS: Record<string, string> = {
    skills: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    experience: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    education: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    projects: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    summary: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    achievements: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function ResumeIntelligence({
    candidateUser,
}: ResumeIntelligenceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [indexStatus, setIndexStatus] = useState<ResumeIndexStatus | null>(null);
    const [indexing, setIndexing] = useState(false);
    const [statusLoading, setStatusLoading] = useState(true);
    const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

    // Job description mode
    const [jobMode, setJobMode] = useState(false);
    const [jobDescription, setJobDescription] = useState("");

    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const token = Cookies.get("token");

    // ── Fetch index status ──────────────────────────────────────────────
    useEffect(() => {
        fetchStatus();
    }, [candidateUser.user_id]);

    async function fetchStatus() {
        setStatusLoading(true);
        try {
            const { data } = await axios.get<ResumeIndexStatus>(
                `${utils_service}/api/utils/resume/status/${candidateUser.user_id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setIndexStatus(data);
        } catch (err) {
            console.error("Failed to fetch resume status:", err);
        } finally {
            setStatusLoading(false);
        }
    }

    // ── Index resume ────────────────────────────────────────────────────
    async function indexResume() {
        if (!candidateUser.resume) {
            toast.error("This candidate has not uploaded a resume");
            return;
        }
        setIndexing(true);
        try {
            await axios.post(
                `${utils_service}/api/utils/resume/upload`,
                { userId: candidateUser.user_id, resumeUrl: candidateUser.resume },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Resume indexed successfully!");
            await fetchStatus();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to index resume");
        } finally {
            setIndexing(false);
        }
    }

    // ── Send query ──────────────────────────────────────────────────────
    async function sendQuery(question: string) {
        if (!question.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: question,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const endpoint = jobMode && jobDescription.trim()
                ? `${utils_service}/api/utils/resume/query-job`
                : `${utils_service}/api/utils/resume/query`;

            const body: any = {
                userId: candidateUser.user_id,
                question,
            };

            if (jobMode && jobDescription.trim()) {
                body.jobDescription = jobDescription;
            }

            const { data } = await axios.post<ResumeQueryResponse>(endpoint, body, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.answer,
                sources: data.sources,
                confidence: data.confidence,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            // Auto-expand sources so recruiter sees evidence immediately
            if (data.sources && data.sources.length > 0) {
                setExpandedSources((prev) => new Set([...prev, assistantMsg.id]));
            }
        } catch (err: any) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content:
                    err.response?.data?.message ||
                    "Sorry, I encountered an error processing your question. Please try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    }

    // ── Auto-scroll — smooth scroll to bottom on new messages ────────
    useEffect(() => {
        if (chatContainerRef.current) {
            requestAnimationFrame(() => {
                chatContainerRef.current?.scrollTo({
                    top: chatContainerRef.current.scrollHeight,
                    behavior: "smooth",
                });
            });
        }
    }, [messages, loading]);

    // ── Toggle source expansion ─────────────────────────────────────────
    function toggleSource(msgId: string) {
        setExpandedSources((prev) => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId);
            else next.add(msgId);
            return next;
        });
    }

    // ── Confidence color ────────────────────────────────────────────────
    function getConfidenceColor(c: number) {
        if (c >= 0.7) return "text-emerald-400";
        if (c >= 0.4) return "text-amber-400";
        return "text-red-400";
    }

    function getConfidenceBg(c: number) {
        if (c >= 0.7)
            return "bg-emerald-500/10 border-emerald-500/20";
        if (c >= 0.4)
            return "bg-amber-500/10 border-amber-500/20";
        return "bg-red-500/10 border-red-500/20";
    }

    // ── Structured sidebar ──────────────────────────────────────────────
    const structured = indexStatus?.structured;

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            {/* Top bar */}
            <div className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                <Brain className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold flex items-center gap-2">
                                    Resume Intelligence
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                                        AI
                                    </span>
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {candidateUser.name} · {candidateUser.email}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Index status badge */}
                            {statusLoading ? (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                                </span>
                            ) : indexStatus?.indexed ? (
                                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3" />
                                    Indexed · {indexStatus.chunksCount} chunks
                                </span>
                            ) : (
                                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                                    <AlertCircle className="h-3 w-3" />
                                    Not indexed
                                </span>
                            )}

                            {/* Re-index button */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={indexResume}
                                disabled={indexing || !candidateUser.resume}
                            >
                                {indexing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3 w-3" />
                                )}
                                {indexing ? "Indexing..." : indexStatus?.indexed ? "Re-index" : "Index Resume"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                    {/* ── Sidebar: Structured Data ────────── */}
                    <div className="lg:col-span-1 space-y-4 overflow-y-auto min-h-0 scrollbar-hide pr-1">
                        {/* Profile snapshot */}
                        <Card className="p-4 border-2 bg-card/50">
                            <div className="flex items-center gap-3 mb-3">
                                {candidateUser.profile_pic ? (
                                    <img
                                        src={candidateUser.profile_pic}
                                        alt={candidateUser.name}
                                        className="h-10 w-10 rounded-full object-cover border-2"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                                        <UserIcon className="h-5 w-5 text-violet-400" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">
                                        {candidateUser.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {candidateUser.email}
                                    </p>
                                </div>
                            </div>
                            {candidateUser.resume && (
                                <a
                                    href={candidateUser.resume}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    <FileText className="h-3 w-3" />
                                    View Original Resume
                                </a>
                            )}
                        </Card>

                        {/* Extracted skills */}
                        {structured?.skills && structured.skills.length > 0 && (
                            <Card className="p-4 border-2 bg-card/50">
                                <h3 className="text-sm font-semibold  mb-3 flex items-center gap-2">
                                    <Code2 className="h-4 w-4 text-blue-400" />
                                    Skills
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {structured.skills.map((skill, i) => (
                                        <span
                                            key={i}
                                            className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Experience summary */}
                        {structured?.experience_summary && (
                            <Card className="p-4 border-2 bg-card/50">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-emerald-400" />
                                    Experience
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {structured.experience_summary}
                                </p>
                            </Card>
                        )}

                        {/* Projects */}
                        {structured?.projects && structured.projects.length > 0 && (
                            <Card className="p-4 border-2 bg-card/50">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Cpu className="h-4 w-4 text-amber-400" />
                                    Projects
                                </h3>
                                <ul className="space-y-1.5">
                                    {structured.projects.map((proj, i) => (
                                        <li
                                            key={i}
                                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                                        >
                                            <span className="text-amber-400 mt-0.5">•</span>
                                            {proj}
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        )}

                        {/* Education */}
                        {structured?.education && (
                            <Card className="p-4 border-2 bg-card/50">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <GraduationCap className="h-4 w-4 text-purple-400" />
                                    Education
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {structured.education}
                                </p>
                            </Card>
                        )}

                        {/* Job Description Mode */}
                        <Card className="p-4 border-2 bg-card/50">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Target className="h-4 w-4 text-rose-400" />
                                    Job Match Mode
                                </h3>
                                <button
                                    onClick={() => setJobMode(!jobMode)}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${jobMode
                                        ? "bg-violet-500"
                                        : "bg-gray-600"
                                        }`}
                                >
                                    <span
                                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${jobMode ? "translate-x-5" : "translate-x-0.5"
                                            }`}
                                    />
                                </button>
                            </div>
                            {jobMode && (
                                <textarea
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="Paste job description here to compare against resume..."
                                    className="w-full text-xs bg-background/50 border rounded-lg p-2.5 h-28 resize-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all outline-none"
                                />
                            )}
                            {!jobMode && (
                                <p className="text-xs text-muted-foreground">
                                    Enable to compare resume against a specific job description.
                                </p>
                            )}
                        </Card>
                    </div>

                    {/* ── Chat area ───────────────────────── */}
                    <div className="lg:col-span-3 flex flex-col h-full min-h-0">
                        {/* Chat messages */}
                        <div
                            ref={chatContainerRef}
                            className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2 min-h-0 scroll-smooth"
                            style={{
                                scrollbarWidth: "thin",
                                scrollbarColor: "rgba(139, 92, 246, 0.3) transparent",
                            }}
                        >
                            {/* Welcome message */}
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-6 shadow-xl shadow-purple-500/20">
                                        <Brain className="h-8 w-8 text-white" />
                                    </div>
                                    <h2 className="text-xl font-bold mb-2">
                                        AI Resume Assistant
                                    </h2>
                                    <p className="text-sm text-muted-foreground max-w-md mb-8">
                                        Ask any question about {candidateUser.name}&apos;s resume.
                                        I&apos;ll provide accurate answers with source references from
                                        their resume.
                                    </p>

                                    {/* Quick questions grid */}
                                    {indexStatus?.indexed && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg">
                                            {QUICK_QUESTIONS.map(({ label, question, icon: Icon }) => (
                                                <button
                                                    key={label}
                                                    onClick={() => sendQuery(question)}
                                                    disabled={loading}
                                                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-card/50 hover:bg-card hover:border-violet-500/40 transition-all text-left group text-xs disabled:opacity-50"
                                                >
                                                    <Icon className="h-4 w-4 text-violet-400 group-hover:text-violet-300 shrink-0" />
                                                    <span className="font-medium">{label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Prompt to index */}
                                    {!statusLoading && !indexStatus?.indexed && (
                                        <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 max-w-md">
                                            <p className="text-sm text-amber-400 mb-3">
                                                Resume needs to be indexed before queries
                                            </p>
                                            <Button
                                                size="sm"
                                                onClick={indexResume}
                                                disabled={indexing || !candidateUser.resume}
                                                className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                                            >
                                                {indexing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Zap className="h-4 w-4" />
                                                )}
                                                {indexing ? "Processing..." : "Index Resume Now"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Message bubbles */}
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    {msg.role === "assistant" && (
                                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                                            <Bot className="h-4 w-4 text-white" />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-[80%] ${msg.role === "user"
                                            ? "bg-violet-500/10 border border-violet-500/20 rounded-2xl rounded-tr-md"
                                            : "bg-card border rounded-2xl rounded-tl-md"
                                            } p-4`}
                                    >
                                        {/* Message text */}
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {msg.content}
                                        </p>

                                        {/* Confidence badge */}
                                        {msg.confidence !== undefined && msg.confidence > 0 && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded-full border ${getConfidenceBg(
                                                        msg.confidence
                                                    )}`}
                                                >
                                                    <span className={getConfidenceColor(msg.confidence)}>
                                                        {Math.round(msg.confidence * 100)}% confidence
                                                    </span>
                                                </span>
                                            </div>
                                        )}

                                        {/* Source attribution */}
                                        {msg.sources && msg.sources.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-dashed border-current/10">
                                                <button
                                                    onClick={() => toggleSource(msg.id)}
                                                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
                                                >
                                                    {expandedSources.has(msg.id) ? (
                                                        <ChevronDown className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    )}
                                                    <FileText className="h-3.5 w-3.5" />
                                                    {msg.sources.length} source
                                                    {msg.sources.length > 1 ? "s" : ""} from resume
                                                </button>

                                                {expandedSources.has(msg.id) && (
                                                    <div className="space-y-2 mt-1">
                                                        {msg.sources.map((src, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`text-xs p-3 rounded-lg border-l-[3px] bg-card/60 border ${SECTION_TYPE_COLORS[src.sectionType] ||
                                                                    SECTION_TYPE_COLORS.other
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="font-bold capitalize text-[11px] tracking-wide uppercase">
                                                                        📄 {src.sectionType}
                                                                    </span>
                                                                    <span className="text-[10px] font-mono opacity-70 bg-background/50 px-1.5 py-0.5 rounded">
                                                                        {Math.round(src.relevanceScore * 100)}% match
                                                                    </span>
                                                                </div>
                                                                <p className="opacity-80 leading-relaxed whitespace-pre-wrap">
                                                                    {src.chunkText}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {msg.role === "user" && (
                                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <UserIcon className="h-4 w-4 text-blue-400" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Loading indicator */}
                            {loading && (
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
                                        <Bot className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="bg-card border rounded-2xl rounded-tl-md p-4">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                                            <span className="text-sm text-muted-foreground">
                                                Analyzing resume...
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Input bar — sticky at bottom */}
                        <div className="border-t pt-3 pb-1 shrink-0 bg-background">
                            {/* Quick question pills (shown after first message) */}
                            {messages.length > 0 && indexStatus?.indexed && (
                                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                                    {QUICK_QUESTIONS.slice(0, 4).map(
                                        ({ label, question, icon: Icon }) => (
                                            <button
                                                key={label}
                                                onClick={() => sendQuery(question)}
                                                disabled={loading}
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-card/50 hover:bg-card hover:border-violet-500/40 transition-all text-xs whitespace-nowrap shrink-0 disabled:opacity-50"
                                            >
                                                <Icon className="h-3 w-3 text-violet-400" />
                                                {label}
                                            </button>
                                        )
                                    )}
                                </div>
                            )}

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    sendQuery(input);
                                }}
                                className="flex gap-2"
                            >
                                <input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={
                                        !indexStatus?.indexed
                                            ? "Index the resume first to start asking questions..."
                                            : jobMode
                                                ? "Ask about resume vs job description..."
                                                : "Ask anything about this candidate's resume..."
                                    }
                                    disabled={loading || !indexStatus?.indexed}
                                    className="flex-1 h-11 px-4 rounded-xl border bg-card/50 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all outline-none disabled:opacity-50"
                                />
                                <Button
                                    type="submit"
                                    disabled={loading || !input.trim() || !indexStatus?.indexed}
                                    className="h-11 w-11 p-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </form>

                            <p className="text-[10px] text-muted-foreground mt-2 text-center">
                                AI answers are based only on resume content. Always verify critical
                                information.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
