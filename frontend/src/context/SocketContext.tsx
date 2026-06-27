"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";
import axios from "axios";

const chat_service =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    unreadCount: number;
    setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
    /** Set this to the conversation the user is currently viewing so notifications are suppressed for it */
    setActiveConversationId: (id: number | null) => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    unreadCount: 0,
    setUnreadCount: () => { },
    setActiveConversationId: () => { },
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Ref so the socket event handler always has the latest value without re-registering listeners
    const activeConversationIdRef = useRef<number | null>(null);

    const setActiveConversationId = (id: number | null) => {
        activeConversationIdRef.current = id;
    };

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) return;

        // Fetch initial unread count
        axios.get(`${chat_service}/api/chat/unread`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(({ data }) => {
            setUnreadCount((data as any).count || 0);
        }).catch(() => { /* ignore */ });

        // Create socket connection with JWT auth
        const newSocket = io(chat_service, {
            auth: { token },
            transports: ["websocket", "polling"],
        });

        newSocket.on("connect", () => {
            console.log("🟢 Socket connected");
            setIsConnected(true);
        });

        newSocket.on("disconnect", () => {
            console.log("🔴 Socket disconnected");
            setIsConnected(false);
        });

        newSocket.on("connect_error", (error) => {
            console.error("Socket connection error:", error.message);
            setIsConnected(false);
        });

        // Only increment unread badge if the user is NOT currently viewing that conversation
        newSocket.on("new-message-notification", (data: { conversationId: number }) => {
            if (activeConversationIdRef.current !== data.conversationId) {
                setUnreadCount((prev) => prev + 1);
            }
        });

        // Send heartbeat every 4 minutes to keep online status alive
        const heartbeatInterval = setInterval(() => {
            if (newSocket.connected) {
                newSocket.emit("heartbeat");
            }
        }, 4 * 60 * 1000);

        // Use setState so React re-renders and consumers get the socket
        setSocket(newSocket);

        return () => {
            clearInterval(heartbeatInterval);
            newSocket.disconnect();
            setSocket(null);
        };
    }, []);

    return (
        <SocketContext.Provider
            value={{
                socket,
                isConnected,
                unreadCount,
                setUnreadCount,
                setActiveConversationId,
            }}
        >
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
