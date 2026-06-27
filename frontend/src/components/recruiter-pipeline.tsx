"use client";

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Application } from "@/type";
import { Card } from "@/components/ui/card";
import { Brain, Calendar, MessageSquare, MoreVertical, Star, User } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { job_service } from "@/context/AppContext";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import InterviewModal from "@/components/interview-modal";

const STAGES = [
    "Submitted",
    "Screening",
    "Interview",
    "Assignment",
    "Final Review",
    "Offer",
    "Hired",
    "Rejected",
];

interface RecruiterPipelineProps {
    applications: Application[];
    onApplicationUpdate: () => void;
    onOpenChat: (appId: number) => void;
    chatOpenLoadingId: number | null;
}

export default function RecruiterPipeline({
    applications,
    onApplicationUpdate,
    onOpenChat,
    chatOpenLoadingId,
}: RecruiterPipelineProps) {
    const [columns, setColumns] = useState<Record<string, Application[]>>({});
    const [interviewAppId, setInterviewAppId] = useState<number | null>(null);

    useEffect(() => {
        // Group applications by status
        const grouped: Record<string, Application[]> = {};
        STAGES.forEach((stage) => {
            grouped[stage] = applications.filter((app) => app.status === stage).sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
        });
        setColumns(grouped);
    }, [applications]);

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;

        if (source.droppableId === destination.droppableId) return;

        const sourceColumn = [...columns[source.droppableId]];
        const destColumn = [...columns[destination.droppableId]];
        const [movedItem] = sourceColumn.splice(source.index, 1);

        movedItem.status = destination.droppableId as any;
        destColumn.splice(destination.index, 0, movedItem);

        setColumns({
            ...columns,
            [source.droppableId]: sourceColumn,
            [destination.droppableId]: destColumn,
        });

        // Update backend
        const token = Cookies.get("token");
        try {
            await axios.put(
                `${job_service}/api/job/application/${draggableId}`,
                { status: destination.droppableId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(`Moved to ${destination.droppableId}`);
            onApplicationUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to update stage");
            // Revert if failed (triggering parent fetch)
            onApplicationUpdate();
        }
    };

    const getScoreBadgeColor = (score = 0) => {
        if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
        if (score >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    };

    return (
        <div className="flex h-[calc(100vh-200px)] overflow-x-auto pb-4 space-x-4">
            <DragDropContext onDragEnd={handleDragEnd}>
                {STAGES.map((stage) => (
                    <div key={stage} className="flex-shrink-0 w-80 bg-secondary/50 rounded-xl p-4 flex flex-col h-full border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold">{stage}</h3>
                            <span className="bg-background text-sm px-2 py-0.5 rounded-full border">
                                {columns[stage]?.length || 0}
                            </span>
                        </div>

                        <Droppable droppableId={stage}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`flex-1 overflow-y-auto space-y-3 p-1 rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-secondary/80" : ""
                                        }`}
                                >
                                    {columns[stage]?.map((app, index) => (
                                        <Draggable
                                            key={app.application_id.toString()}
                                            draggableId={app.application_id.toString()}
                                            index={index}
                                        >
                                            {(provided, snapshot) => (
                                                <Card
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`p-4 cursor-grab shadow-sm border-2 ${snapshot.isDragging ? "shadow-lg border-blue-400" : "hover:border-blue-200"
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2 max-w-[80%]">
                                                            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                                                                <User size={14} className="text-blue-600" />
                                                            </div>
                                                            <div className="truncate">
                                                                <p className="font-medium text-sm truncate">{app.applicant_email}</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1">
                                                            <MoreVertical size={14} className="opacity-50" />
                                                        </Button>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-4 mb-3">
                                                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${getScoreBadgeColor(app.overall_score)}`}>
                                                            <Star size={12} className={app.overall_score ? "opacity-100" : "opacity-0"} />
                                                            {app.overall_score ? `Score ${app.overall_score}` : "No Score"}
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 pt-3 border-t flex-wrap">
                                                        <Link
                                                            href={`/account/${app.applicant_id}`}
                                                            target="_blank"
                                                            className="text-blue-500 hover:underline text-xs flex-1 text-center py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                        >
                                                            Profile & Resume
                                                        </Link>

                                                        <button
                                                            onClick={() => setInterviewAppId(app.application_id)}
                                                            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 font-medium"
                                                        >
                                                            <Calendar size={12} />
                                                            Interview
                                                        </button>

                                                        <button
                                                            onClick={() => onOpenChat(app.application_id)}
                                                            disabled={chatOpenLoadingId === app.application_id}
                                                            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                                                        >
                                                            <MessageSquare size={12} />
                                                            Chat
                                                        </button>

                                                        <Link
                                                            href={`/resume-intelligence/${app.applicant_id}`}
                                                            target="_blank"
                                                            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400 hover:from-violet-500/30 hover:to-purple-500/30 font-medium border border-violet-500/20"
                                                        >
                                                            <Brain size={12} />
                                                            AI
                                                        </Link>
                                                    </div>
                                                </Card>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </DragDropContext>

            <InterviewModal
                applicationId={interviewAppId}
                isOpen={interviewAppId !== null}
                onClose={() => setInterviewAppId(null)}
                onUpdate={onApplicationUpdate}
            />
        </div>
    );
}
