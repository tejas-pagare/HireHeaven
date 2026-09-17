"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlogService, Post } from "@/services/blogService";
import { Edit, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

export default function ManageBlogsPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMyPosts = async () => {
        try {
            setLoading(true);
            const data = await BlogService.getMyPosts();
            setPosts(data as Post[]); // Returns array directly
        } catch (error) {
            console.error(error);
            toast.error("Failed to load your posts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyPosts();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this post?")) return;
        try {
            await BlogService.deletePost(id);
            setPosts(posts.filter((p) => p.id !== id));
            toast.success("Post deleted");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete post");
        }
    };

    return (
        <div className="container mx-auto py-10 px-4">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Manage Blogs</h1>
                <Link
                    href="/recruiter/blog/create"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    <Plus size={18} />
                    Create New Post
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin" />
                </div>
            ) : (
                <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="p-4">Title</th>
                                <th className="p-4">Date</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.map((post) => (
                                <tr key={post.id} className="border-t hover:bg-muted/50">
                                    <td className="p-4 font-medium">
                                        <Link href={`/blog/${post.slug || post.id}`} className="hover:underline">
                                            {post.title}
                                        </Link>
                                    </td>
                                    <td className="p-4 text-sm">
                                        {new Date(post.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={() => alert("Edit not implemented in this demo (similar to create)")} // Placeholder
                                            className="p-2 text-brand-subtle-foreground hover:bg-brand-subtle rounded"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(post.id)}
                                            className="p-2 text-destructive hover:bg-destructive-subtle rounded"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {posts.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-muted-foreground">
                                        You haven't posted anything yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
