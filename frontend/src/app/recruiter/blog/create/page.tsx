"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionBuilder } from "@/components/blog/SectionBuilder";
import { TagInput } from "@/components/ui/tag-input";
import { BlogService, Section } from "@/services/blogService";
import { toast } from "react-hot-toast";
import { Loader2, UploadCloud } from "lucide-react";
import axios from "axios";
import { utils_service } from "@/context/AppContext";

export default function CreateBlogPage() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [coverImage, setCoverImage] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size too large (max 5MB)");
            return;
        }

        try {
            setUploading(true);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const base64data = reader.result;
                const { data } = await axios.post(`${utils_service}/api/utils/upload`, {
                    buffer: base64data,
                });
                setCoverImage((data as any).url);
                toast.success("Image uploaded successfully");
                setUploading(false);
            };
        } catch (error) {
            console.error(error);
            toast.error("Failed to upload image");
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Please enter a title");
            return;
        }
        if (sections.length === 0) {
            toast.error("Please add at least one section");
            return;
        }

        try {
            setIsSubmitting(true);
            await BlogService.createPost({
                title,
                cover_image: coverImage,
                tags,
                sections,
            });
            toast.success("Blog post created successfully!");
            router.push("/account");
        } catch (error) {
            console.error(error);
            toast.error("Failed to create blog post");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container max-w-4xl mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold mb-8">Create New Blog Post</h1>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Meta Info */}
                <div className="space-y-4 p-6 border rounded-lg bg-card">
                    <h2 className="text-lg font-semibold">Basic Information</h2>

                    <div>
                        <label className="block text-sm font-medium mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-2 border rounded-md text-lg font-medium focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Enter an engaging title..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Cover Image</label>
                        <div className="flex items-center gap-4">
                            <div className="relative w-full">
                                <label
                                    htmlFor="cover-upload"
                                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {uploading ? (
                                            <Loader2 className="animate-spin text-muted-foreground" />
                                        ) : (
                                            <>
                                                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                                <p className="text-sm text-muted-foreground">Click to upload cover image</p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        id="cover-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                    />
                                </label>
                            </div>
                        </div>
                        {coverImage && (
                            <div className="mt-4 relative h-48 w-full rounded-md overflow-hidden border">
                                <img src={coverImage} alt="Cover" className="object-cover w-full h-full" />
                                <button
                                    type="button"
                                    onClick={() => setCoverImage("")}
                                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full text-xs"
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Tags</label>
                        <TagInput tags={tags} setTags={setTags} />
                    </div>
                </div>

                {/* Dynamic Sections */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold">Content Sections</h2>
                    <p className="text-muted-foreground text-sm">Build your story by adding sections. You can reorder them.</p>
                    <SectionBuilder sections={sections} setSections={setSections} />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2 border rounded-md hover:bg-accent transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || uploading}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                        Publish Post
                    </button>
                </div>
            </form>
        </div>
    );
}
