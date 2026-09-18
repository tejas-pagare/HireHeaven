"use client";

import { useEffect, useState } from "react";
import { BlogService, Post } from "@/services/blogService";
import { toast } from "react-hot-toast";
import { Loader2, Edit, Trash2, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import SectionHeader from "./section-header";

export default function MyBlogs() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 5; // Items per page

    const fetchMyPosts = async () => {
        try {
            setLoading(true);
            const data = await BlogService.getMyPosts(page, limit);
            // Handling the response structure { posts, total, page, limit }
            // If the service/backend returns array directly (old implementation), handle that too for robustness
            if (Array.isArray(data)) {
                setPosts(data);
                setTotalPages(1);
            } else {
                setPosts((data as any).posts);
                setTotalPages(Math.ceil((data as any).total / limit));
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load your posts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyPosts();
    }, [page]);

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this post?")) return;
        try {
            await BlogService.deletePost(id);
            // Refresh current page
            fetchMyPosts();
            toast.success("Post deleted");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete post");
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    return (
        <div className="mx-auto w-full max-w-5xl">
            <SectionHeader
                title="My blogs"
                description="Manage your blog posts"
                action={
                    <Link href="/recruiter/blog/create">
                        <Button className="gap-2">
                            <Plus size={17} />
                            Create new post
                        </Button>
                    </Link>
                }
            />
            <div>
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-primary" />
                    </div>
                ) : posts.length > 0 ? (
                    <div className="space-y-4">
                        <div className="overflow-hidden rounded-xl border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Image</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Created At</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {posts.map((post) => (
                                        <TableRow key={post.id}>
                                            <TableCell>
                                                {post.cover_image ? (
                                                    <img
                                                        src={post.cover_image}
                                                        alt={post.title}
                                                        className="w-16 h-10 object-cover rounded"
                                                    />
                                                ) : (
                                                    <div className="w-16 h-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                                                        No img
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <Link href={`/blog/${post.slug || post.id}`} className="hover:underline text-primary">
                                                    {post.title}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                {new Date(post.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/recruiter/blog/edit/${post.id}`}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                                                            <Edit size={16} />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => handleDelete(post.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center px-2">
                                <div className="text-sm text-muted-foreground">
                                    Page {page} of {totalPages}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={page === 1}
                                        className="gap-1"
                                    >
                                        <ArrowLeft size={14} /> Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={page === totalPages}
                                        className="gap-1"
                                    >
                                        Next <ArrowRight size={14} />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        You haven't posted any blogs yet.
                    </div>
                )}
            </div>
        </div>
    );
}
