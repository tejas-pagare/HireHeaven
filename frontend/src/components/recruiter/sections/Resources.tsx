"use client";
import React, { useEffect, useState } from "react";
import BlogCard from "../BlogCard";
import { BlogService, Post } from "@/services/blogService";

const Resources = () => {
    const [blogs, setBlogs] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBlogs = async () => {
            try {
                const data: any = await BlogService.getAllPosts(1, 3);
                setBlogs(data.posts || []);
            } catch (error) {
                console.error("Failed to fetch blogs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBlogs();
    }, []);

    if (!loading && blogs.length === 0) {
        return null;
    }

    return (
        <section className="rl-section" style={{ background: "var(--rl-surface)" }}>
            <div className="rl-container">
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <h2 className="rl-heading-2" style={{ color: "var(--rl-text)", marginBottom: 8 }}>
                        Resources & Insights
                    </h2>
                    <p className="rl-body" style={{ color: "var(--rl-text-muted)" }}>
                        Stay ahead with our latest articles and industry insights
                    </p>
                </div>

                {loading ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 24,
                        }}
                        className="rl-blog-grid"
                    >
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="rl-card"
                                style={{ overflow: "hidden", height: 320 }}
                            >
                                <div
                                    style={{
                                        height: 180,
                                        background: "var(--rl-muted)",
                                        animation: "pulse 1.5s ease-in-out infinite",
                                    }}
                                />
                                <div style={{ padding: 20 }}>
                                    <div
                                        style={{
                                            width: 80,
                                            height: 20,
                                            borderRadius: 10,
                                            background: "var(--rl-muted)",
                                            marginBottom: 12,
                                        }}
                                    />
                                    <div
                                        style={{
                                            width: "100%",
                                            height: 16,
                                            borderRadius: 4,
                                            background: "var(--rl-muted)",
                                            marginBottom: 8,
                                        }}
                                    />
                                    <div
                                        style={{
                                            width: "60%",
                                            height: 14,
                                            borderRadius: 4,
                                            background: "var(--rl-muted)",
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 24,
                        }}
                        className="rl-blog-grid"
                    >
                        {blogs.map((blog) => (
                            <BlogCard
                                key={blog.id}
                                image={blog.cover_image || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=300&fit=crop&crop=center"}
                                category={blog.tags?.[0] || "Blog"}
                                title={blog.title}
                                date={new Date(blog.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "2-digit",
                                    year: "numeric",
                                })}
                                slug={blog.slug}
                            />
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                @media (max-width: 768px) {
                    .rl-blog-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </section>
    );
};

export default Resources;
