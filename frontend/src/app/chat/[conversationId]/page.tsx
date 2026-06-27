"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAppData } from "@/context/AppContext";
import { useSocket } from "@/context/SocketContext";
import { Message, Conversation } from "@/type";
import axios from "axios";
import Cookies from "js-cookie";
import Link from "next/link";
import { ArrowLeft, Send, Briefcase, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const chat_service =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const ChatConversationPage = () => {
    const params = useParams();
    const conversationId = Number(params.conversationId);

    const { user } = useAppData();
    const { socket, isConnected, setUnreadCount, setActiveConversationId } = useSocket();

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUser, setTypingUser] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const token = Cookies.get("token");

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load conversation details and messages
    useEffect(() => {
        if (!token || !conversationId) return;

        const fetchData = async () => {
            try {
                // Fetch conversations to get this one's details
                const { data: convs } = await axios.get<Conversation[]>(
                    `${chat_service}/api/chat/conversations`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const conv = convs.find(
                    (c: Conversation) => c.conversation_id === conversationId
                );
                setConversation(conv || null);

                // Fetch messages
                const { data: msgData } = await axios.get<{ messages: Message[]; page: number; limit: number; total: number; hasMore: boolean }>(
                    `${chat_service}/api/chat/conversations/${conversationId}/messages`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setMessages(msgData.messages || []);

                // Mark messages as read
                await axios.put(
                    `${chat_service}/api/chat/conversations/${conversationId}/read`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch (error) {
                console.error("Error loading chat:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [conversationId, token]);

    // Scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Socket.IO event listeners
    useEffect(() => {
        if (!socket || !isConnected || !conversationId) return;

        // Tell the context which conversation is active so notifications are suppressed for it
        setActiveConversationId(conversationId);

        // Join conversation room
        socket.emit("join-conversation", { conversationId });

        // Mark messages as read via socket too
        socket.emit("mark-read", { conversationId });

        // Listen for new messages from the server.
        // When a message arrives, replace the matching optimistic entry (same sender + content)
        // with the server-confirmed version, or append if it's from the other person.
        const handleNewMessage = (message: Message) => {
            if (message.conversation_id === conversationId) {
                setMessages((prev) => {
                    // Check if a real (non-optimistic) duplicate already exists
                    if (prev.some((m) => !m._isOptimistic && m.message_id === message.message_id)) {
                        return prev;
                    }
                    // Replace the optimistic placeholder from the same sender with the same content
                    const optimisticIndex = prev.findIndex(
                        (m) => m._isOptimistic && m.sender_id === message.sender_id && m.content === message.content
                    );
                    if (optimisticIndex !== -1) {
                        const updated = [...prev];
                        updated[optimisticIndex] = message; // swap placeholder with real message
                        return updated;
                    }
                    return [...prev, message];
                });

                // Mark as read since we're viewing the conversation
                socket.emit("mark-read", { conversationId });
            }
        };

        // Typing indicators
        const handleTyping = (data: {
            conversationId: number;
            userName: string;
        }) => {
            if (data.conversationId === conversationId) {
                setIsTyping(true);
                setTypingUser(data.userName);
            }
        };

        const handleStopTyping = (data: { conversationId: number }) => {
            if (data.conversationId === conversationId) {
                setIsTyping(false);
                setTypingUser("");
            }
        };

        // Read receipts
        const handleMessagesRead = (data: { conversationId: number }) => {
            if (data.conversationId === conversationId) {
                setMessages((prev) =>
                    prev.map((m) => ({
                        ...m,
                        is_read: true,
                    }))
                );
            }
        };

        socket.on("new-message", handleNewMessage);
        socket.on("user-typing", handleTyping);
        socket.on("user-stop-typing", handleStopTyping);
        socket.on("messages-read", handleMessagesRead);

        return () => {
            // Clear active conversation so notifications resume for this conversation
            setActiveConversationId(null);
            socket.emit("leave-conversation", { conversationId });
            socket.off("new-message", handleNewMessage);
            socket.off("user-typing", handleTyping);
            socket.off("user-stop-typing", handleStopTyping);
            socket.off("messages-read", handleMessagesRead);
        };
    }, [socket, isConnected, conversationId]);

    // Send message
    const handleSend = () => {
        if (!newMessage.trim() || !socket || sending) return;

        const trimmedContent = newMessage.trim();

        // 1. Optimistically add the message to the UI immediately —
        //    no waiting for the DB round-trip.
        const optimisticMsg: Message = {
            message_id: Date.now(), // temporary id; replaced when server echo arrives
            conversation_id: conversationId,
            sender_id: user!.user_id,
            content: trimmedContent,
            message_type: "text",
            is_read: false,
            created_at: new Date().toISOString(),
            sender_name: user?.name || "",
            sender_pic: null,
            _isOptimistic: true,
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        // 2. Emit over socket — server saves to DB and broadcasts to the room.
        socket.emit("send-message", {
            conversationId,
            content: trimmedContent,
            type: "text",
        });

        socket.emit("stop-typing", { conversationId });
        setNewMessage("");
        setSending(false);
        inputRef.current?.focus();
    };

    // Handle typing
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);

        if (socket && isConnected) {
            socket.emit("typing", { conversationId });

            // Clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Stop typing after 2 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit("stop-typing", { conversationId });
            }, 2000);
        }
    };

    // Handle enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Format time for messages
    const formatMessageTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    // Group messages by date
    const getDateLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
        return date.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const isApplicant = user?.user_id === conversation?.applicant_id;
    const otherName = isApplicant
        ? conversation?.recruiter_name
        : conversation?.applicant_name;
    const otherPic = isApplicant
        ? conversation?.recruiter_pic
        : conversation?.applicant_pic;

    return (
        <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/80 backdrop-blur-md">
                <Link
                    href="/chat"
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                >
                    <ArrowLeft size={20} />
                </Link>

                <Avatar className="h-10 w-10 ring-2 ring-offset-1 ring-offset-background ring-blue-500/20">
                    <AvatarImage src={otherPic || ""} alt={otherName || ""} />
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 font-semibold">
                        {otherName?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    <h2 className="font-semibold truncate">{otherName}</h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Briefcase size={12} />
                        <span className="truncate">{conversation?.job_title}</span>
                        <span>•</span>
                        <Building2 size={12} />
                        <span className="truncate">{conversation?.company_name}</span>
                    </div>
                </div>

                {isConnected && (
                    <div className="flex items-center gap-1 text-xs text-green-500">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        Live
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                        <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                            <Send size={24} className="text-blue-500" />
                        </div>
                        <p className="text-center">
                            No messages yet. Say hello! 👋
                        </p>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, index) => {
                            const isOwn = msg.sender_id === user?.user_id;
                            const showDateLabel =
                                index === 0 ||
                                getDateLabel(msg.created_at) !==
                                getDateLabel(messages[index - 1].created_at);

                            return (
                                <React.Fragment key={msg.message_id}>
                                    {showDateLabel && (
                                        <div className="flex items-center justify-center my-4">
                                            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                                                {getDateLabel(msg.created_at)}
                                            </span>
                                        </div>
                                    )}

                                    <div
                                        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}
                                    >
                                        <div
                                            className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${isOwn
                                                ? "bg-blue-500 text-white rounded-br-md"
                                                : "bg-muted rounded-bl-md"
                                                }`}
                                        >
                                            {!isOwn && (
                                                <p className="text-xs font-medium mb-1 opacity-70">
                                                    {msg.sender_name}
                                                </p>
                                            )}
                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                {msg.content}
                                            </p>
                                            <div
                                                className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? "text-blue-100" : "text-muted-foreground"
                                                    }`}
                                            >
                                                <span className="text-[10px]">
                                                    {formatMessageTime(msg.created_at)}
                                                </span>
                                                {isOwn && (
                                                    <span className="text-[10px]">
                                                        {msg.is_read ? "✓✓" : "✓"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </>
                )}

                {/* Typing Indicator */}
                {isTyping && (
                    <div className="flex justify-start mb-2">
                        <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-bl-md">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                    {typingUser} is typing
                                </span>
                                <div className="flex gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]"></div>
                                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]"></div>
                                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t px-4 py-3 bg-background/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="flex-1 px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="p-3 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md active:scale-95"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatConversationPage;
