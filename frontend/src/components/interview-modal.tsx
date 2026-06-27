import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import axios from "axios";
import { job_service } from "@/context/AppContext";
import Cookies from "js-cookie";
import toast from "react-hot-toast";

interface InterviewModalProps {
    applicationId: number | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void; // Trigger parent refresh if stage/score updates
}

export default function InterviewModal({
    applicationId,
    isOpen,
    onClose,
    onUpdate,
}: InterviewModalProps) {
    const [tab, setTab] = useState<"schedule" | "evaluate">("schedule");

    // Schedule state
    const [scheduledAt, setScheduledAt] = useState("");
    const [meetLink, setMeetLink] = useState("");
    const [scheduleLoading, setScheduleLoading] = useState(false);

    // Evaluate state
    const [techRating, setTechRating] = useState(0);
    const [commRating, setCommRating] = useState(0);
    const [problemRating, setProblemRating] = useState(0);
    const [cultureRating, setCultureRating] = useState(0);
    const [feedback, setFeedback] = useState("");
    const [evaluateLoading, setEvaluateLoading] = useState(false);

    const handleSchedule = async () => {
        if (!applicationId || !scheduledAt || !meetLink) {
            return toast.error("Please fill all fields");
        }
        setScheduleLoading(true);
        const token = Cookies.get("token");
        try {
            await axios.post(
                `${job_service}/api/job/interview`,
                { application_id: applicationId, scheduled_at: scheduledAt, meet_link: meetLink },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Interview scheduled successfully");
            onUpdate();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to schedule interview");
        } finally {
            setScheduleLoading(false);
        }
    };

    const handleEvaluate = async () => {
        if (!applicationId || !feedback || !techRating || !commRating || !problemRating || !cultureRating) {
            return toast.error("Please provide all ratings and feedback");
        }
        setEvaluateLoading(true);
        const token = Cookies.get("token");
        try {
            await axios.post(
                `${job_service}/api/job/interview/evaluate`,
                {
                    application_id: applicationId,
                    tech_rating: techRating,
                    comm_rating: commRating,
                    problem_solving_rating: problemRating,
                    culture_rating: cultureRating,
                    feedback,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Evaluation submitted successfully");
            onUpdate();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to submit evaluation");
        } finally {
            setEvaluateLoading(false);
        }
    };

    const renderStars = (rating: number, setRating: (val: number) => void) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={20}
                        className={`cursor-pointer ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                        onClick={() => setRating(star)}
                    />
                ))}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Interview Management</DialogTitle>
                </DialogHeader>

                <div className="flex border-b mb-4">
                    <button
                        className={`flex-1 pb-2 font-medium ${tab === "schedule" ? "border-b-2 border-blue-600 text-blue-600" : "opacity-60"}`}
                        onClick={() => setTab("schedule")}
                    >
                        Schedule
                    </button>
                    <button
                        className={`flex-1 pb-2 font-medium ${tab === "evaluate" ? "border-b-2 border-blue-600 text-blue-600" : "opacity-60"}`}
                        onClick={() => setTab("evaluate")}
                    >
                        Evaluate
                    </button>
                </div>

                {tab === "schedule" ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Date & Time</label>
                            <Input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Google Meet Link</label>
                            <Input
                                type="url"
                                placeholder="https://meet.google.com/..."
                                value={meetLink}
                                onChange={(e) => setMeetLink(e.target.value)}
                            />
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSchedule} disabled={scheduleLoading}>
                            {scheduleLoading ? "Scheduling..." : "Schedule Interview"}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm block mb-1">Technical Skills</label>
                                {renderStars(techRating, setTechRating)}
                            </div>
                            <div>
                                <label className="text-sm block mb-1">Communication</label>
                                {renderStars(commRating, setCommRating)}
                            </div>
                            <div>
                                <label className="text-sm block mb-1">Problem Solving</label>
                                {renderStars(problemRating, setProblemRating)}
                            </div>
                            <div>
                                <label className="text-sm block mb-1">Culture Fit</label>
                                {renderStars(cultureRating, setCultureRating)}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Feedback Notes</label>
                            <Textarea
                                placeholder="Add detailed feedback..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleEvaluate} disabled={evaluateLoading}>
                            {evaluateLoading ? "Submitting..." : "Submit Evaluation"}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
