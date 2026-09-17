"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import axios from "axios";
import { job_service } from "@/context/AppContext";
import {
    Search,
    MapPin,
    Briefcase,
    Users,
    TrendingUp,
    Megaphone,
    HeadphonesIcon,
    BarChart3,
    Code2,
    ArrowRight,
    Star,
    Mail,
    Sparkles,
    FileText,
    Landmark,
    Handshake,
} from "lucide-react";
import CarrerGuide from "@/components/carrer-guide";
import ResumeAnalyzer from "@/components/resume-analyser";

/* ─── hero data ─── */

const heroSlides = [
    {
        heading: "Get The",
        highlight: "Right Job",
        tail: "You Deserve",
        sub: "Connect with top employers and discover opportunities that match your skills.",
        bg: "/hero/hero-1.jpg",
    },
    {
        heading: "Build Your",
        highlight: "Dream Career",
        tail: "With Us",
        sub: "Whether you're a fresher or experienced professional, HireHeaven makes job hunting effortless.",
        bg: "/hero/hero-2.jpg",
    },
    {
        heading: "Unlock",
        highlight: "Endless",
        tail: "Opportunities",
        sub: "Thousands of companies are hiring right now. Your next big role is just one search away.",
        bg: "/hero/hero-3.jpg",
    },
];

/* ─── categories ─── */

const categories = [
    {
        icon: Megaphone,
        title: "Marketing",
        desc: "SEO, content strategy, social media & growth marketing roles.",
        jobs: 240,
        color: "var(--jl-primary)",
        bgColor: "rgba(59, 130, 246, 0.1)",
    },
    {
        icon: Code2,
        title: "Design & Development",
        desc: "UI/UX design, frontend, backend & full-stack engineering.",
        jobs: 820,
        color: "var(--jl-primary)",
        bgColor: "rgba(59, 130, 246, 0.1)",
    },
    {
        icon: Users,
        title: "Human Resources",
        desc: "Talent acquisition, employee experience & organizational design.",
        jobs: 150,
        color: "var(--jl-primary)",
        bgColor: "rgba(59, 130, 246, 0.1)",
    },
    {
        icon: Landmark,
        title: "Finance",
        desc: "Financial analysis, accounting, risk management & FinTech.",
        jobs: 310,
        color: "var(--jl-primary)",
        bgColor: "rgba(59, 130, 246, 0.1)",
    },
    {
        icon: Handshake,
        title: "Business Consulting",
        desc: "Strategy, management consulting & operational improvement.",
        jobs: 180,
        color: "var(--jl-primary)",
        bgColor: "rgba(59, 130, 246, 0.1)",
    },
    {
        icon: HeadphonesIcon,
        title: "Customer Support",
        desc: "Client success, technical support & helpdesk management.",
        jobs: 420,
        color: "var(--jl-primary)",
        bgColor: "rgba(59, 130, 246, 0.1)",
    },
];

/* ─── component ─── */

const JobSeekerLandingPage = () => {
    const [jobTitle, setJobTitle] = useState("");
    const [location, setLocation] = useState("");
    const [email, setEmail] = useState("");
    const [currentSlide, setCurrentSlide] = useState(0);

    interface Job {
        job_id: number;
        title: string;
        description: string;
        salary: string;
        location: string;
        job_type: string;
        role: string;
        work_location: string;
        company_name: string;
        company_logo: string;
        company_id: number;
    }

    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobsLoading, setJobsLoading] = useState(true);

    const fetchFeaturedJobs = useCallback(async () => {
        try {
            const res: any = await axios.get(`${job_service}/api/job`);
            setJobs(res.data.slice(0, 6));
        } catch (error) {
            console.error("Error fetching featured jobs:", error);
        } finally {
            setJobsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFeaturedJobs();
    }, [fetchFeaturedJobs]);

    // Rotate hero slides
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const slide = heroSlides[currentSlide];

    return (
        <div className="jobseeker-landing">
            {/* ═══ HERO ═══ */}
            <section className="jl-hero">
                {/* Cycling background images */}
                {heroSlides.map((s, i) => (
                    <div
                        key={i}
                        className="jl-hero-bg"
                        style={{
                            backgroundImage: `url(${s.bg})`,
                            opacity: i === currentSlide ? 1 : 0,
                        }}
                    />
                ))}
                {/* Dark overlay for readability */}
                <div className="jl-hero-overlay" />

                <div className="jl-container" style={{ position: "relative", zIndex: 2 }}>
                    <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                        {/* Animated heading */}
                        <h1 className="jl-hero-heading" key={currentSlide}>
                            {slide.heading}{" "}
                            <span className="jl-hero-highlight">{slide.highlight}</span>{" "}
                            {slide.tail}
                        </h1>
                        <p className="jl-hero-sub" key={`sub-${currentSlide}`}>
                            {slide.sub}
                        </p>

                        {/* Search bar — glassmorphism */}
                        <div className="jl-hero-search">
                            <div style={{ flex: "1 1 200px", position: "relative" }}>
                                <Search
                                    size={18}
                                    style={{
                                        position: "absolute",
                                        left: 14,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        color: "rgba(255,255,255,0.5)",
                                    }}
                                />
                                <input
                                    className="jl-hero-input"
                                    placeholder="Job title or keyword"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                />
                            </div>
                            <div style={{ flex: "1 1 200px", position: "relative" }}>
                                <MapPin
                                    size={18}
                                    style={{
                                        position: "absolute",
                                        left: 14,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        color: "rgba(255,255,255,0.5)",
                                    }}
                                />
                                <input
                                    className="jl-hero-input"
                                    placeholder="Location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                />
                            </div>
                            <Link href="/jobs" style={{ flexShrink: 0 }}>
                                <button className="jl-btn-primary" style={{ height: 46 }}>
                                    <Search size={18} /> Search
                                </button>
                            </Link>
                        </div>

                        {/* Slide indicators */}
                        <div className="jl-hero-dots">
                            {heroSlides.map((_, i) => (
                                <button
                                    key={i}
                                    className={`jl-hero-dot ${i === currentSlide ? "active" : ""}`}
                                    onClick={() => setCurrentSlide(i)}
                                />
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="jl-hero-stats">
                            {[
                                { val: "10k+", label: "Active Jobs" },
                                { val: "5k+", label: "Companies" },
                                { val: "50k+", label: "Job Seekers" },
                            ].map((s) => (
                                <div key={s.label} style={{ textAlign: "center" }}>
                                    <p className="jl-hero-stat-val">{s.val}</p>
                                    <p className="jl-hero-stat-label">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ ONE PLATFORM MANY SOLUTIONS ═══ */}
            <section className="jl-section">
                <div className="jl-container">
                    <div style={{ textAlign: "center", marginBottom: 48 }}>
                        <h2 className="jl-h2">One Platform Many Solutions</h2>
                        <p
                            className="jl-body"
                            style={{ color: "var(--jl-text-muted)", marginTop: 8 }}
                        >
                            Explore opportunities across industries and find the perfect fit
                            for your career.
                        </p>
                    </div>
                    <div className="jl-grid-3">
                        {categories.map((cat) => (
                            <Link href="/jobs" key={cat.title} style={{ textDecoration: "none", color: "inherit" }}>
                                <div className="jl-category-card">
                                    <div className="jl-category-card-stripe" style={{ background: cat.color }} />
                                    <div className="jl-category-card-body">
                                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                                            <div className="jl-category-card-icon" style={{ background: cat.bgColor }}>
                                                <cat.icon size={22} style={{ color: cat.color }} />
                                            </div>
                                            <span className="jl-category-jobs-badge">{cat.jobs}+ jobs</span>
                                        </div>
                                        <h3 className="jl-h3" style={{ marginBottom: 6, fontSize: 18 }}>
                                            {cat.title}
                                        </h3>
                                        <p className="jl-caption" style={{ marginBottom: 16 }}>{cat.desc}</p>
                                        <div className="jl-category-card-arrow">
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>Explore</span>
                                            <ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ FEATURED JOB CIRCULARS ═══ */}
            <section className="jl-section" style={{ background: "var(--jl-surface)" }}>
                <div className="jl-container">
                    <div style={{ textAlign: "center", marginBottom: 48 }}>
                        <h2 className="jl-h2">
                            <span style={{ color: "var(--jl-primary)" }}>Featured</span> Job
                            Circulars
                        </h2>
                        <p
                            className="jl-body"
                            style={{ color: "var(--jl-text-muted)", marginTop: 8 }}
                        >
                            Handpicked opportunities from top companies across India.
                        </p>
                    </div>
                    <div className="jl-grid-3">
                        {jobsLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div className="jl-soft-card" key={i} style={{ height: 260 }}>
                                    <div className="animate-pulse" style={{ width: "100%" }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--jl-border)", marginBottom: 16 }} />
                                        <div style={{ width: "70%", height: 16, borderRadius: 6, background: "var(--jl-border)", marginBottom: 10 }} />
                                        <div style={{ width: "50%", height: 12, borderRadius: 6, background: "var(--jl-border)", marginBottom: 10 }} />
                                        <div style={{ width: "90%", height: 10, borderRadius: 6, background: "var(--jl-border)", marginBottom: 6 }} />
                                        <div style={{ width: "80%", height: 10, borderRadius: 6, background: "var(--jl-border)" }} />
                                    </div>
                                </div>
                            ))
                        ) : jobs.length > 0 ? (
                            jobs.map((job) => (
                                <div className="jl-job-card" key={job.job_id}>
                                    {/* Top accent bar */}
                                    <div className="jl-job-card-accent" />
                                    <div className="jl-job-card-body">
                                        {/* Company logo + name + type */}
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <img
                                                    src={job.company_logo}
                                                    alt={job.company_name}
                                                    style={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: 12,
                                                        objectFit: "cover",
                                                        border: "2px solid var(--jl-border)",
                                                    }}
                                                />
                                                <div>
                                                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--jl-text)", display: "block" }}>
                                                        {job.company_name}
                                                    </span>
                                                    <span style={{ fontSize: 12, color: "var(--jl-text-muted)" }}>
                                                        {job.work_location || "Office"}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="jl-job-type-badge">
                                                {job.job_type}
                                            </span>
                                        </div>

                                        {/* Job title */}
                                        <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--jl-text)", lineHeight: 1.4, marginBottom: 10 }}>
                                            {job.title}
                                        </h3>

                                        {/* Description */}
                                        <p
                                            style={{
                                                fontSize: 13.5,
                                                lineHeight: 1.65,
                                                color: "var(--jl-text-muted)",
                                                marginBottom: 20,
                                                display: "-webkit-box",
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {job.description}
                                        </p>

                                        {/* Footer */}
                                        <div className="jl-job-card-footer">
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--jl-text-muted)", fontSize: 13 }}>
                                                <MapPin size={14} />
                                                <span>{job.location}</span>
                                            </div>
                                            <Link
                                                href={`/jobs/${job.job_id}`}
                                                className="jl-view-details-btn"
                                                style={{ textDecoration: "none" }}
                                            >
                                                View Details <ArrowRight size={14} />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0" }}>
                                <p className="jl-body" style={{ color: "var(--jl-text-muted)" }}>No featured jobs available at the moment.</p>
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: "center", marginTop: 40 }}>
                        <Link href="/jobs">
                            <button className="jl-btn-primary">
                                View All Jobs <ArrowRight size={16} />
                            </button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ═══ DISCOVER YOUR CAREER PATH ═══ */}
            <section className="jl-section">
                <div className="jl-container">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 48,
                            alignItems: "center",
                        }}
                        className="jl-hero-grid"
                    >
                        {/* Left — descriptive content */}
                        <div>
                            <div className="jl-badge-pill">
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--jl-primary)" }}>
                                    AI-Powered Career Guidance
                                </span>
                            </div>
                            <h2 className="jl-h2" style={{ marginBottom: 12 }}>
                                Discover Your <span style={{ color: "var(--jl-primary)" }}>Career Path</span>
                            </h2>
                            <p className="jl-body" style={{ color: "var(--jl-text-muted)", marginBottom: 28 }}>
                                Get personalized job recommendations and learning roadmaps based on your unique skill set. Our AI analyzes industry trends to guide your next career move.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
                                {[
                                    { icon: TrendingUp, text: "Personalized career trajectory mapping" },
                                    { icon: Briefcase, text: "AI-matched role recommendations" },
                                    { icon: Star, text: "Skills gap analysis & learning paths" },
                                ].map((item, idx) => (
                                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div className="jl-feature-icon">
                                            <item.icon size={18} style={{ color: "var(--jl-primary)" }} />
                                        </div>
                                        <span style={{ fontSize: 15, color: "var(--jl-text)" }}>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right — action area */}
                        <div style={{
                            background: "rgba(255, 255, 255, 0.7)",
                            backdropFilter: "blur(16px)",
                            WebkitBackdropFilter: "blur(16px)",
                            border: "1px solid rgba(255, 255, 255, 0.8)",
                            borderRadius: "24px",
                            boxShadow: "0 4px 32px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
                            padding: "48px",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            textAlign: "center",
                            overflow: "hidden"
                        }}>
                            {/* Inner glowing element */}
                            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 200, height: 200, background: "var(--jl-primary)", filter: "blur(80px)", opacity: 0.15, zIndex: 0 }} />
                            
                            <div style={{ position: "relative", zIndex: 1 }}>
                                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "20px", background: "rgba(59, 130, 246, 0.1)", color: "var(--jl-primary)", marginBottom: 24, boxShadow: "0 4px 12px rgba(59, 130, 246, 0.05)" }}>
                                    <Briefcase size={28} />
                                </div>
                                <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "var(--jl-text)" }}>
                                    Your Skills Deserve the Right Career
                                </h3>
                                <p style={{ fontSize: 15, color: "var(--jl-text-muted)", marginBottom: 32, maxWidth: "380px", margin: "0 auto 32px", lineHeight: 1.6 }}>
                                    Add your skills and get an instant AI-generated career guide with job options, learning paths, and growth strategies.
                                </p>
                                <CarrerGuide />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ OPTIMIZE YOUR RESUME FOR ATS ═══ */}
            <section className="jl-section" style={{ background: "var(--jl-surface)" }}>
                <div className="jl-container">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 48,
                            alignItems: "center",
                        }}
                        className="jl-hero-grid"
                    >
                        {/* Left — action area */}
                        <div style={{
                            background: "rgba(255, 255, 255, 0.7)",
                            backdropFilter: "blur(16px)",
                            WebkitBackdropFilter: "blur(16px)",
                            border: "1px solid rgba(255, 255, 255, 0.8)",
                            borderRadius: "24px",
                            boxShadow: "0 4px 32px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
                            padding: "48px",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            textAlign: "center",
                            overflow: "hidden"
                        }}>
                            {/* Inner glowing element */}
                            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 200, height: 200, background: "var(--jl-primary)", filter: "blur(80px)", opacity: 0.15, zIndex: 0 }} />
                            
                            <div style={{ position: "relative", zIndex: 1 }}>
                                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "20px", background: "rgba(59, 130, 246, 0.1)", color: "var(--jl-primary)", marginBottom: 24, boxShadow: "0 4px 12px rgba(59, 130, 246, 0.05)" }}>
                                    <FileText size={28} />
                                </div>
                                <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "var(--jl-text)" }}>
                                    Is Your Resume ATS-Ready?
                                </h3>
                                <p style={{ fontSize: 15, color: "var(--jl-text-muted)", marginBottom: 32, maxWidth: "380px", margin: "0 auto 32px", lineHeight: 1.6 }}>
                                    Upload your resume and get an instant score with detailed recommendations to beat applicant tracking systems.
                                </p>
                                <ResumeAnalyzer />
                            </div>
                        </div>

                        {/* Right — descriptive content */}
                        <div>
                            <div className="jl-badge-pill">
                                <FileText size={16} style={{ color: "var(--jl-primary)" }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--jl-primary)" }}>
                                    AI-Powered ATS Analysis
                                </span>
                            </div>
                            <h2 className="jl-h2" style={{ marginBottom: 12 }}>
                                Optimize Your Resume for <span style={{ color: "var(--jl-primary)" }}>ATS</span>
                            </h2>
                            <p className="jl-body" style={{ color: "var(--jl-text-muted)", marginBottom: 28 }}>
                                Most resumes get rejected by ATS before a human ever sees them. Our AI scanner identifies issues and provides actionable fixes to get you past the filters.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
                                {[
                                    { icon: BarChart3, text: "Detailed ATS compatibility score" },
                                    { icon: TrendingUp, text: "Section-by-section breakdown" },
                                    { icon: Star, text: "Priority-ranked improvement suggestions" },
                                ].map((item, idx) => (
                                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div className="jl-feature-icon">
                                            <item.icon size={18} style={{ color: "var(--jl-primary)" }} />
                                        </div>
                                        <span style={{ fontSize: 15, color: "var(--jl-text)" }}>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ NEWSLETTER ═══ */}
            <section className="jl-section">
                <div className="jl-container" style={{ textAlign: "center" }}>
                    <h2 className="jl-h2" style={{ marginBottom: 8 }}>
                        Never Want to Miss Any{" "}
                        <span style={{ color: "var(--jl-primary)" }}>Job News</span>?
                    </h2>
                    <p
                        className="jl-body"
                        style={{ color: "var(--jl-text-muted)", marginBottom: 32 }}
                    >
                        Subscribe to our newsletter and get the latest job updates delivered
                        right to your inbox.
                    </p>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 12,
                            flexWrap: "wrap",
                            maxWidth: 520,
                            margin: "0 auto",
                        }}
                    >
                        <div style={{ flex: "1 1 300px", position: "relative" }}>
                            <Mail
                                size={18}
                                style={{
                                    position: "absolute",
                                    left: 14,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--jl-text-muted)",
                                }}
                            />
                            <input
                                className="jl-input"
                                placeholder="Enter your email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <button
                            className="jl-btn-primary"
                            style={{ height: 46, flexShrink: 0 }}
                        >
                            Subscribe <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="jl-footer">
                <div className="jl-container">
                    <div className="jl-grid-4" style={{ marginBottom: 40 }}>
                        {/* Col 1 */}
                        <div>
                            <p
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: "var(--jl-text)",
                                    marginBottom: 12,
                                }}
                            >
                                <span className="hh-wordmark">HireHeaven</span>
                            </p>
                            <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.75 }}>
                                HireHeaven is India&apos;s fastest-growing job portal connecting
                                talented professionals with leading companies. Find your dream
                                job today.
                            </p>
                        </div>
                        {/* Col 2 */}
                        <div>
                            <p
                                style={{
                                    fontWeight: 600,
                                    color: "var(--jl-text)",
                                    marginBottom: 16,
                                    fontSize: 15,
                                }}
                            >
                                About
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    fontSize: 14,
                                }}
                            >
                                <Link href="/about">About Us</Link>
                                <Link href="/blog">Blog</Link>
                                <Link href="/about">Partners</Link>
                            </div>
                        </div>
                        {/* Col 3 */}
                        <div>
                            <p
                                style={{
                                    fontWeight: 600,
                                    color: "var(--jl-text)",
                                    marginBottom: 16,
                                    fontSize: 15,
                                }}
                            >
                                Jobs
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    fontSize: 14,
                                }}
                            >
                                <Link href="/jobs">Browse Jobs</Link>
                                <Link href="/jobs">Categories</Link>
                                <Link href="/about">Contact</Link>
                            </div>
                        </div>
                        {/* Col 4 */}
                        <div>
                            <p
                                style={{
                                    fontWeight: 600,
                                    color: "var(--jl-text)",
                                    marginBottom: 16,
                                    fontSize: 15,
                                }}
                            >
                                Legal
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    fontSize: 14,
                                }}
                            >
                                <Link href="/legal/terms">Terms of Service</Link>
                                <Link href="/legal/privacy">Privacy Policy</Link>
                            </div>
                        </div>
                    </div>
                    <div
                        style={{
                            borderTop: "1px solid var(--jl-border)",
                            paddingTop: 20,
                            textAlign: "center",
                            fontSize: 13,
                            opacity: 0.6,
                        }}
                    >
                        © {new Date().getFullYear()} HireHeaven. All rights reserved.
                    </div>
                </div>
            </footer>

            {/* Responsive overrides */}
            <style jsx>{`
        @media (max-width: 768px) {
          .jl-hero-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
        </div>
    );
};

export default JobSeekerLandingPage;
