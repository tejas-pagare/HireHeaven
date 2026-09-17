"use client";

import React, { useEffect, useState } from "react";
import { useAppData } from "@/context/AppContext";
import { useSocket } from "@/context/SocketContext";
import { Conversation, Message } from "@/type";
import axios from "axios";
import Cookies from "js-cookie";
import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { BACKEND_URL } from "@/lib/config";

const chat_service = BACKEND_URL;

const ChatPage = () => {
    const { user, isAuth, loading } = useAppData();
    const { socket, isConnected } = useSocket();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const token = Cookies.get("token");

    // ── Initial fetch ──
    useEffect(() => {
        if (!isAuth || !token) return;

        const fetchConversations = async () => {
            try {
                const { data } = await axios.get<Conversation[]>(
                    `${chat_service}/api/chat/conversations`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                setConversations(data);
            } catch (error) {
                console.error("Error fetching conversations:", error);
            } finally {
                setLoadingConversations(false);
            }
        };

        fetchConversations();
    }, [isAuth, token]);

    // ── Real-time updates ──
    // When a new message arrives, update the matching conversation's unread
    // count, last message preview, and timestamp — without a full reload.
    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleNewMessageNotification = (data: {
            conversationId: number;
            message: Message;
        }) => {
            setConversations((prev) => {
                // Move the updated conversation to the top and bump its unread count
                const updated = prev.map((conv) => {
                    if (conv.conversation_id !== data.conversationId) return conv;
                    return {
                        ...conv,
                        unread_count: conv.unread_count + 1,
                        last_message: data.message.content,
                        last_message_at: data.message.created_at,
                    };
                });

                // Sort so conversations with newest messages appear first
                return [...updated].sort(
                    (a, b) =>
                        new Date(b.last_message_at).getTime() -
                        new Date(a.last_message_at).getTime()
                );
            });
        };

        socket.on("new-message-notification", handleNewMessageNotification);

        return () => {
            socket.off("new-message-notification", handleNewMessageNotification);
        };
    }, [socket, isConnected]);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const filteredConversations = conversations.filter((conv) => {
        const searchLower = searchQuery.toLowerCase();
        const otherName =
            user?.user_id === conv.applicant_id
                ? conv.recruiter_name
                : conv.applicant_name;
        return (
            otherName.toLowerCase().includes(searchLower) ||
            conv.job_title.toLowerCase().includes(searchLower) ||
            conv.company_name.toLowerCase().includes(searchLower)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAuth) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
                <MessageSquare size={48} className="text-muted-foreground" />
                <p className="text-muted-foreground text-lg">
                    Please login to access your messages
                </p>
                <Link
                    href="/login"
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                >
                    Sign In
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <MessageSquare className="text-primary" />
                    Messages
                </h1>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="icon-style" />
                <Input
                    type="text"
                    placeholder="Search conversations…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 pl-10"
                    aria-label="Search conversations"
                />
            </div>

            {/* Conversations List */}
            {loadingConversations ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-xl border">
                            <div className="h-12 w-12 rounded-full bg-muted"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-1/3 bg-muted rounded"></div>
                                <div className="h-3 w-2/3 bg-muted rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <MessageSquare size={48} className="text-muted-foreground/50" />
                    <p className="text-muted-foreground text-center">
                        {searchQuery
                            ? "No conversations match your search"
                            : "No conversations yet. Chat will appear here when you or a recruiter starts a conversation about your application."}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredConversations.map((conv) => {
                        const isApplicant = user?.user_id === conv.applicant_id;
                        const otherName = isApplicant
                            ? conv.recruiter_name
                            : conv.applicant_name;
                        const otherPic = isApplicant
                            ? conv.recruiter_pic
                            : conv.applicant_pic;

                        return (
                            <Link
                                key={conv.conversation_id}
                                href={`/chat/${conv.conversation_id}`}
                            >
                                <div
                                    className={`flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-md ${conv.unread_count > 0
                                        ? "border-primary/30 bg-brand-subtle/40"
                                        : ""
                                        }`}
                                >
                                    <Avatar className="h-12 w-12 ring-2 ring-offset-2 ring-offset-background ring-ring/20">
                                        <AvatarImage src={otherPic || ""} alt={otherName} />
                                        <AvatarFallback className="bg-brand-subtle text-brand-subtle-foreground font-semibold">
                                            {otherName.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h3
                                                className={`font-semibold truncate ${conv.unread_count > 0 ? "text-foreground" : ""
                                                    }`}
                                            >
                                                {otherName}
                                            </h3>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                {conv.last_message_at
                                                    ? formatTime(conv.last_message_at)
                                                    : ""}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {conv.job_title} • {conv.company_name}
                                        </p>
                                        <div className="flex items-center justify-between mt-1">
                                            <p
                                                className={`text-sm truncate ${conv.unread_count > 0
                                                    ? "font-medium text-foreground"
                                                    : "text-muted-foreground"
                                                    }`}
                                            >
                                                {conv.last_message || "No messages yet"}
                                            </p>
                                            {conv.unread_count > 0 && (
                                                <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center font-bold">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ChatPage;
