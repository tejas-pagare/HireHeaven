"use client";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, XCircle } from "lucide-react";
import axios from "axios";
import { job_service } from "@/context/AppContext";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import type { RoundTimelineEntry } from "./round-timeline";

interface RoundModalProps {
  applicationId: number | null;
  round: RoundTimelineEntry | null;
  /** "schedule" for a Pending round, "evaluate" for a Scheduled one */
  initialTab: "schedule" | "evaluate";
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function RoundModal({ applicationId, round, initialTab, isOpen, onClose, onUpdate }: RoundModalProps) {
  const [tab, setTab] = useState<"schedule" | "evaluate">(initialTab);

  const [scheduledAt, setScheduledAt] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [techRating, setTechRating] = useState(0);
  const [commRating, setCommRating] = useState(0);
  const [problemRating, setProblemRating] = useState(0);
  const [cultureRating, setCultureRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<"passed" | "failed" | null>(null);
  const [evaluateLoading, setEvaluateLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setScheduledAt("");
      setMeetLink("");
      setTechRating(0);
      setCommRating(0);
      setProblemRating(0);
      setCultureRating(0);
      setFeedback("");
      setDecision(null);
    }
  }, [isOpen, initialTab]);

  const handleSchedule = async () => {
    if (!applicationId || !round || !scheduledAt || !meetLink) {
      return toast.error("Please fill all fields");
    }
    setScheduleLoading(true);
    const token = Cookies.get("token");
    try {
      await axios.post(
        `${job_service}/api/job/interview`,
        { application_id: applicationId, round_id: round.round_id, scheduled_at: scheduledAt, meet_link: meetLink },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${round.name} scheduled`);
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to schedule round");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!round?.interview_id || !feedback || !techRating || !commRating || !problemRating || !cultureRating || !decision) {
      return toast.error("Please provide all ratings, feedback, and a decision");
    }
    setEvaluateLoading(true);
    const token = Cookies.get("token");
    try {
      await axios.post(
        `${job_service}/api/job/interview/evaluate`,
        {
          interview_id: round.interview_id,
          tech_rating: techRating,
          comm_rating: commRating,
          problem_solving_rating: problemRating,
          culture_rating: cultureRating,
          feedback,
          decision,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Evaluation submitted");
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to submit evaluation");
    } finally {
      setEvaluateLoading(false);
    }
  };

  const renderStars = (rating: number, setRating: (val: number) => void) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={20}
          className={`cursor-pointer ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
          onClick={() => setRating(star)}
        />
      ))}
    </div>
  );

  if (!round) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Round {round.round_number}: {round.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b mb-4">
          <button
            className={`flex-1 pb-2 font-medium text-sm ${tab === "schedule" ? "border-b-2 border-blue-600 text-blue-600" : "opacity-60"}`}
            onClick={() => setTab("schedule")}
          >
            Schedule
          </button>
          <button
            className={`flex-1 pb-2 font-medium text-sm ${tab === "evaluate" ? "border-b-2 border-blue-600 text-blue-600" : "opacity-60"}`}
            onClick={() => setTab("evaluate")}
            disabled={!round.interview_id}
            title={!round.interview_id ? "Schedule this round first" : undefined}
          >
            Evaluate
          </button>
        </div>

        {tab === "schedule" ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Date & Time</label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Google Meet Link</label>
              <Input type="url" placeholder="https://meet.google.com/..." value={meetLink} onChange={(e) => setMeetLink(e.target.value)} />
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSchedule} disabled={scheduleLoading}>
              {scheduleLoading ? "Scheduling..." : `Schedule ${round.name}`}
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
              <Textarea placeholder="Add detailed feedback..." value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Decision</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDecision("passed")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    decision === "passed" ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "border-border"
                  }`}
                >
                  <CheckCircle2 size={16} /> Pass
                </button>
                <button
                  type="button"
                  onClick={() => setDecision("failed")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    decision === "failed" ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "border-border"
                  }`}
                >
                  <XCircle size={16} /> Fail
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This records the outcome only — the candidate isn't automatically rejected or advanced. Use the application status
                actions to do that explicitly.
              </p>
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
