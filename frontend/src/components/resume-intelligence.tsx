"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import MarkdownText from "@/components/markdown-text";
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

/**
 * Source cards sit on the normal card surface — colour is carried by the left
 * rule and the section label only. Full tinted fills made the achievements
 * card read as an error state and hurt legibility.
 */
const SECTION_ACCENTS: Record<string, { rule: string; label: string }> = {
    skills: { rule: "border-l-primary", label: "text-primary" },
    experience: { rule: "border-l-success", label: "text-success-subtle-foreground" },
    education: { rule: "border-l-primary", label: "text-primary" },
    projects: { rule: "border-l-warning", label: "text-warning-subtle-foreground" },
    summary: { rule: "border-l-primary", label: "text-primary" },
    achievements: { rule: "border-l-[var(--chart-4)]", label: "text-[var(--chart-4)]" },
    other: { rule: "border-l-border", label: "text-muted-foreground" },
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
        if (c >= 0.7) return "text-success";
        if (c >= 0.4) return "text-warning";
        return "text-destructive";
    }

    // ── Structured sidebar ──────────────────────────────────────────────
    const structured = indexStatus?.structured;

    return (
        <div className="hh-page flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
            <div className="mx-auto grid w-full min-h-0 max-w-7xl flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
                {/* ── Sidebar: structured resume data ───────────────────── */}
                <aside className="hh-scroll hh-stagger min-h-0 space-y-4 overflow-y-auto pr-1 lg:col-span-1">
                    {/* Candidate card — carries the index state now that the top bar is gone */}
                    <div className="hh-panel overflow-hidden">
                        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary to-[var(--chart-4)]" />
                        <div className="p-4">
                            <div className="mb-4 flex items-center gap-3">
                                {candidateUser.profile_pic ? (
                                    <img
                                        src={candidateUser.profile_pic}
                                        alt={candidateUser.name}
                                        className="size-11 rounded-full border-2 border-card object-cover shadow-soft"
                                    />
                                ) : (
                                    <div className="flex size-11 items-center justify-center rounded-full bg-brand-subtle">
                                        <UserIcon className="size-5 text-brand-subtle-foreground" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">
                                        {candidateUser.name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {candidateUser.email}
                                    </p>
                                </div>
                            </div>

                            {/* Index state + re-index, relocated from the old header */}
                            <div className="flex flex-wrap items-center gap-2">
                                {statusLoading ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Loader2 className="size-3 animate-spin" /> Checking index…
                                    </span>
                                ) : indexStatus?.indexed ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-2.5 py-1 text-xs font-medium text-success-subtle-foreground">
                                        <Sparkles className="size-3" />
                                        {indexStatus.chunksCount} chunks indexed
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-subtle px-2.5 py-1 text-xs font-medium text-warning-subtle-foreground">
                                        <AlertCircle className="size-3" />
                                        Not indexed
                                    </span>
                                )}

                                <button
                                    onClick={indexResume}
                                    disabled={indexing || !candidateUser.resume}
                                    title={indexStatus?.indexed ? "Re-index resume" : "Index resume"}
                                    aria-label={indexStatus?.indexed ? "Re-index resume" : "Index resume"}
                                    className="hh-chip inline-flex size-7 items-center justify-center rounded-full border text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
                                >
                                    <RefreshCw
                                        className={`size-3.5 ${indexing ? "animate-spin" : ""}`}
                                    />
                                </button>
                            </div>

                            {candidateUser.resume && (
                                <a
                                    href={candidateUser.resume}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-primary transition-colors hover:underline"
                                >
                                    <FileText className="size-3.5" />
                                    View original resume
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Extracted skills */}
                    {structured?.skills && structured.skills.length > 0 && (
                        <div className="hh-panel p-4">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                <Code2 className="size-4 text-primary" />
                                Skills
                                <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    {structured.skills.length}
                                </span>
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                                {structured.skills.map((skill, i) => (
                                    <span
                                        key={i}
                                        className="hh-chip cursor-default rounded-md border border-primary/20 bg-brand-subtle px-2 py-0.5 text-xs text-brand-subtle-foreground"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Experience summary */}
                    {structured?.experience_summary && (
                        <div className="hh-panel p-4">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                <Briefcase className="size-4 text-success" />
                                Experience
                            </h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                {structured.experience_summary}
                            </p>
                        </div>
                    )}

                    {/* Projects */}
                    {structured?.projects && structured.projects.length > 0 && (
                        <div className="hh-panel p-4">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                <Cpu className="size-4 text-warning" />
                                Projects
                            </h3>
                            <ul className="space-y-1.5">
                                {structured.projects.map((proj, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-2 text-xs text-muted-foreground"
                                    >
                                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" />
                                        {proj}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Education */}
                    {structured?.education && (
                        <div className="hh-panel p-4">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                <GraduationCap className="size-4 text-primary" />
                                Education
                            </h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                {structured.education}
                            </p>
                        </div>
                    )}

                    {/* Job match mode */}
                    <div className="hh-panel p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                                <Target className="size-4 text-primary" />
                                Job match mode
                            </h3>
                            <button
                                onClick={() => setJobMode(!jobMode)}
                                role="switch"
                                aria-checked={jobMode}
                                aria-label="Toggle job match mode"
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${jobMode ? "bg-primary" : "bg-muted"
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 size-4 rounded-full bg-card shadow-soft transition-transform duration-200 ${jobMode ? "translate-x-4.5" : "translate-x-0.5"
                                        }`}
                                />
                            </button>
                        </div>
                        {jobMode ? (
                            <textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste a job description to compare against this resume…"
                                className="hh-composer h-28 w-full resize-none rounded-lg border bg-background p-2.5 text-xs outline-none"
                            />
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Enable to compare this resume against a specific job description.
                            </p>
                        )}
                    </div>
                </aside>

                {/* ── Chat ──────────────────────────────────────────────── */}
                <section className="flex h-full min-h-0 flex-col lg:col-span-3">
                    <div
                        ref={chatContainerRef}
                        className="hh-scroll min-h-0 flex-1 space-y-4 overflow-y-auto scroll-smooth pb-4 pr-2"
                    >
                        {/* Welcome state */}
                        {messages.length === 0 && (
                            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                                <div className="hh-breathe mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[var(--chart-4)] shadow-brand">
                                    <Brain className="size-8 text-primary-foreground" />
                                </div>
                                <h2 className="mb-2 text-xl font-bold tracking-tight">
                                    Resume Intelligence
                                </h2>
                                <p className="mb-8 max-w-md text-sm text-muted-foreground">
                                    Ask anything about {candidateUser.name}&apos;s resume. Every
                                    answer cites the exact section it came from.
                                </p>

                                {indexStatus?.indexed && (
                                    <div className="hh-stagger grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-3">
                                        {QUICK_QUESTIONS.map(({ label, question, icon: Icon }) => (
                                            <button
                                                key={label}
                                                onClick={() => sendQuery(question)}
                                                disabled={loading}
                                                className="hh-chip flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left text-xs font-medium disabled:opacity-50"
                                            >
                                                <Icon className="size-4 shrink-0 text-primary" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {!statusLoading && !indexStatus?.indexed && (
                                    <div className="mt-4 max-w-md rounded-xl border border-dashed border-warning/40 bg-warning-subtle/40 p-4">
                                        <p className="mb-3 text-sm text-warning-subtle-foreground">
                                            This resume needs indexing before you can ask questions.
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={indexResume}
                                            disabled={indexing || !candidateUser.resume}
                                            className="gap-2"
                                        >
                                            {indexing ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Zap className="size-4" />
                                            )}
                                            {indexing ? "Processing…" : "Index resume now"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Messages */}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`hh-pop flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"
                                    }`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[var(--chart-4)] shadow-soft">
                                        <Bot className="size-4 text-primary-foreground" />
                                    </div>
                                )}

                                <div
                                    className={`max-w-[80%] p-4 ${msg.role === "user"
                                        ? "rounded-2xl rounded-tr-md border border-primary/25 bg-brand-subtle"
                                        : "rounded-2xl rounded-tl-md border bg-card shadow-soft"
                                        }`}
                                >
                                    {msg.role === "assistant" ? (
                                        <MarkdownText
                                            content={msg.content}
                                            className="text-sm"
                                        />
                                    ) : (
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                            {msg.content}
                                        </p>
                                    )}

                                    {/* Confidence meter */}
                                    {msg.confidence !== undefined && msg.confidence > 0 && (
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className={`h-full rounded-full transition-[width] duration-700 ${msg.confidence >= 0.7
                                                        ? "bg-success"
                                                        : msg.confidence >= 0.4
                                                            ? "bg-warning"
                                                            : "bg-destructive"
                                                        }`}
                                                    style={{ width: `${Math.round(msg.confidence * 100)}%` }}
                                                />
                                            </div>
                                            <span
                                                className={`text-[11px] font-semibold ${getConfidenceColor(msg.confidence)}`}
                                            >
                                                {Math.round(msg.confidence * 100)}% confidence
                                            </span>
                                        </div>
                                    )}

                                    {/* Sources */}
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className="mt-4 border-t border-dashed pt-3">
                                            <button
                                                onClick={() => toggleSource(msg.id)}
                                                aria-expanded={expandedSources.has(msg.id)}
                                                className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                {expandedSources.has(msg.id) ? (
                                                    <ChevronDown className="size-3.5" />
                                                ) : (
                                                    <ChevronRight className="size-3.5" />
                                                )}
                                                <FileText className="size-3.5" />
                                                {msg.sources.length} source
                                                {msg.sources.length > 1 ? "s" : ""} from resume
                                            </button>

                                            {expandedSources.has(msg.id) && (
                                                <div className="hh-stagger mt-1 space-y-2">
                                                    {msg.sources.map((src, idx) => {
                                                        const accent =
                                                            SECTION_ACCENTS[src.sectionType] ||
                                                            SECTION_ACCENTS.other;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`rounded-lg border border-l-[3px] bg-card p-3 text-xs shadow-soft ${accent.rule}`}
                                                            >
                                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                                    <span
                                                                        className={`text-[11px] font-bold uppercase tracking-wide ${accent.label}`}
                                                                    >
                                                                        {src.sectionType}
                                                                    </span>
                                                                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                                                        {Math.round(src.relevanceScore * 100)}% match
                                                                    </span>
                                                                </div>
                                                                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                                                                    {src.chunkText}
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {msg.role === "user" && (
                                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-brand-subtle">
                                        <UserIcon className="size-4 text-brand-subtle-foreground" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Thinking state */}
                        {loading && (
                            <div className="hh-pop flex gap-3">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[var(--chart-4)] shadow-soft">
                                    <Bot className="size-4 text-primary-foreground" />
                                </div>
                                <div className="rounded-2xl rounded-tl-md border bg-card p-4 shadow-soft">
                                    <div className="flex items-center gap-2.5">
                                        <span className="flex gap-1">
                                            <span className="hh-dot size-1.5 rounded-full bg-primary" />
                                            <span className="hh-dot size-1.5 rounded-full bg-primary" />
                                            <span className="hh-dot size-1.5 rounded-full bg-primary" />
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            Reading the resume…
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Composer */}
                    <div className="shrink-0 border-t pb-1 pt-3">
                        {messages.length > 0 && indexStatus?.indexed && (
                            <div className="hh-scroll mb-3 flex gap-2 overflow-x-auto pb-1">
                                {QUICK_QUESTIONS.slice(0, 4).map(
                                    ({ label, question, icon: Icon }) => (
                                        <button
                                            key={label}
                                            onClick={() => sendQuery(question)}
                                            disabled={loading}
                                            className="hh-chip flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
                                        >
                                            <Icon className="size-3 text-primary" />
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
                            className="hh-composer flex items-center gap-2 rounded-xl border bg-card p-1.5"
                        >
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={
                                    !indexStatus?.indexed
                                        ? "Index the resume first to start asking questions…"
                                        : jobMode
                                            ? "Ask about this resume vs the job description…"
                                            : "Ask anything about this candidate's resume…"
                                }
                                disabled={loading || !indexStatus?.indexed}
                                aria-label="Ask a question about this resume"
                                className="h-10 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={loading || !input.trim() || !indexStatus?.indexed}
                                aria-label="Send question"
                                className="size-10 shrink-0 rounded-lg"
                            >
                                {loading ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Send className="size-4" />
                                )}
                            </Button>
                        </form>

                        <p className="mt-2 text-center text-[11px] text-muted-foreground">
                            Answers come only from this resume&apos;s contents. Verify anything
                            critical.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
