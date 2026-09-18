"use client";
import React from "react";
import { CheckCircle2, Circle, Clock, ExternalLink, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RoundTimelineEntry {
  round_id: number;
  round_number: number;
  name: string;
  interview_id: number | null;
  scheduled_at: string | null;
  meet_link: string | null;
  decision: "passed" | "failed" | null;
  tech_rating?: number;
  comm_rating?: number;
  problem_solving_rating?: number;
  culture_rating?: number;
  feedback?: string;
}

type RoundStatus = "pending" | "scheduled" | "passed" | "failed";

function deriveStatus(round: RoundTimelineEntry): RoundStatus {
  if (round.decision) return round.decision;
  if (round.interview_id) return "scheduled";
  return "pending";
}

const STATUS_STYLES: Record<RoundStatus, { dot: string; label: string }> = {
  pending: { dot: "bg-muted border-2 border-border", label: "Pending" },
  scheduled: { dot: "bg-blue-500", label: "Scheduled" },
  passed: { dot: "bg-green-500", label: "Passed" },
  failed: { dot: "bg-red-500", label: "Failed" },
};

interface RoundTimelineProps {
  mode: "recruiter" | "candidate";
  rounds: RoundTimelineEntry[];
  applicationStatus: string;
  isTerminal: boolean;
  onSchedule?: (round: RoundTimelineEntry) => void;
  onEvaluate?: (round: RoundTimelineEntry) => void;
  onCancel?: (round: RoundTimelineEntry) => void;
}

export default function RoundTimeline({
  mode,
  rounds,
  applicationStatus,
  isTerminal,
  onSchedule,
  onEvaluate,
  onCancel,
}: RoundTimelineProps) {
  const outcome: "Hired" | "Rejected" | null =
    applicationStatus === "Hired" ? "Hired" : applicationStatus === "Rejected" ? "Rejected" : null;

  return (
    <div className="space-y-0">
      {rounds.map((round, i) => {
        const status = deriveStatus(round);
        const style = STATUS_STYLES[status];
        const isLast = i === rounds.length - 1 && !outcome;

        return (
          <div key={round.round_id} className={`relative flex gap-4 ${isTerminal ? "opacity-50" : ""}`}>
            {/* Connecting line + node */}
            <div className="flex flex-col items-center">
              <div className={`h-4 w-4 rounded-full shrink-0 flex items-center justify-center ${style.dot}`}>
                {status === "passed" && <CheckCircle2 size={16} className="text-white -m-0.5" />}
                {status === "failed" && <XCircle size={16} className="text-white -m-0.5" />}
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-border my-1" />}
            </div>

            <div className="flex-1 pb-8">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium text-sm">
                    Round {round.round_number}: {round.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{style.label}</p>
                </div>
                {mode === "recruiter" && !isTerminal && (
                  <div className="flex gap-2">
                    {status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => onSchedule?.(round)}>
                        Schedule
                      </Button>
                    )}
                    {status === "scheduled" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onEvaluate?.(round)}>
                          Evaluate
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => onCancel?.(round)}>
                          Cancel
                        </Button>
                      </>
                    )}
                    {(status === "passed" || status === "failed") && (
                      <Button size="sm" variant="ghost" onClick={() => onSchedule?.(round)}>
                        Reschedule
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {(status === "scheduled" || status === "passed" || status === "failed") && round.scheduled_at && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock size={12} />
                  {new Date(round.scheduled_at).toLocaleString()}
                </div>
              )}

              {round.meet_link && (status === "scheduled" || (mode === "candidate" && !isTerminal)) && (
                <a
                  href={round.meet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                >
                  <ExternalLink size={12} /> Join meeting
                </a>
              )}

              {mode === "recruiter" && (status === "passed" || status === "failed") && round.feedback && (
                <p className="mt-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 max-w-md">{round.feedback}</p>
              )}
            </div>
          </div>
        );
      })}

      {/* Outcome node */}
      <div className={`relative flex gap-4 ${!isTerminal ? "opacity-40" : ""}`}>
        <div className="flex flex-col items-center">
          <div
            className={`h-5 w-5 rounded-full shrink-0 flex items-center justify-center ${
              outcome === "Hired" ? "bg-green-500" : outcome === "Rejected" ? "bg-red-500" : "bg-muted border-2 border-border"
            }`}
          >
            {outcome === "Hired" && <Trophy size={12} className="text-white" />}
            {outcome === "Rejected" && <XCircle size={12} className="text-white" />}
            {!outcome && <Circle size={10} className="text-muted-foreground" />}
          </div>
        </div>
        <div>
          <p className="font-medium text-sm">{outcome || "Outcome"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {outcome ? "This application is closed." : "Awaiting a final decision."}
          </p>
        </div>
      </div>
    </div>
  );
}
