"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Mic, ArrowLeft, Brain, CheckCircle, XCircle } from "lucide-react";
import Loading from "@/components/loading";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface InterviewResult {
  id: number;
  application_id: number;
  transcript: { role: string; text: string }[];
  evaluation: {
    strengths: string[];
    weaknesses: string[];
    feedback: string;
    score: number;
  };
  score: number;
  created_at: string;
}

export default function AiInterviewResultPage() {
  const { applicationId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<InterviewResult | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      const token = Cookies.get("token");
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const { data } = await axios.get(
          `${BACKEND_URL}/api/ai/interview/result/${applicationId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setResult(data);
      } catch (error: any) {
        if (error.response?.status === 404) {
           toast.error("AI Interview has not been completed yet.");
        } else {
           toast.error("Failed to load interview result");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [applicationId, router]);

  if (loading) return <Loading />;

  if (!result) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Link href="/account" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Account
        </Link>
        <Card className="p-12 text-center flex flex-col items-center justify-center">
          <Mic size={48} className="text-muted-foreground mb-4 opacity-20" />
          <h2 className="text-xl font-bold">No Interview Result Found</h2>
          <p className="text-muted-foreground mt-2">The candidate has not completed the AI screen, or there was an error.</p>
        </Card>
      </div>
    );
  }

  const { evaluation, transcript } = result;
  
  // Score color logic
  const scoreColor = evaluation.score >= 80 ? "text-green-600" : evaluation.score >= 60 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <Link href="/account" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Account
      </Link>
      
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center">
          <Mic size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Interview Evaluation</h1>
          <p className="text-muted-foreground">Application #{applicationId} • Completed on {new Date(result.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Evaluation Summary */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 bg-gradient-to-br from-background to-muted/50 border-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Brain size={18} className="text-primary" /> Overall Score
              </h2>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-6xl font-bold tracking-tighter ${scoreColor}`}>
                {evaluation.score}
              </span>
              <span className="text-muted-foreground font-medium mb-1">/ 100</span>
            </div>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              {evaluation.feedback}
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-green-600 flex items-center gap-2 mb-4">
              <CheckCircle size={16} /> Strengths
            </h3>
            <ul className="space-y-3">
              {evaluation.strengths.map((str, i) => (
                <li key={i} className="text-sm bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-100 dark:border-green-900/50 text-green-800 dark:text-green-300">
                  {str}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-red-600 flex items-center gap-2 mb-4">
              <XCircle size={16} /> Weaknesses
            </h3>
            <ul className="space-y-3">
              {evaluation.weaknesses.map((wk, i) => (
                <li key={i} className="text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/50 text-red-800 dark:text-red-300">
                  {wk}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Full Transcript */}
        <div className="lg:col-span-2">
          <Card className="p-6 border-2 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Mic size={18} className="text-muted-foreground" /> Full Transcript
            </h2>
            <div className="flex-1 space-y-6 overflow-y-auto pr-2 pb-4">
               {transcript.map((msg, i) => (
                 <div key={i} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                   <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'assistant' ? 'bg-muted rounded-tl-sm text-foreground' : 'bg-primary text-primary-foreground rounded-tr-sm'}`}>
                     <p className="text-sm font-semibold mb-1 opacity-70 uppercase tracking-wider text-[10px]">
                       {msg.role === 'assistant' ? 'AI Interviewer' : 'Candidate'}
                     </p>
                     <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                   </div>
                 </div>
               ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
