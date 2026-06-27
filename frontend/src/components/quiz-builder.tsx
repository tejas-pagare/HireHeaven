import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash, Wand2 } from "lucide-react";
import axios from "axios";
import { job_service } from "@/context/AppContext";
import Cookies from "js-cookie";
import toast from "react-hot-toast";

const utils_service = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface QuizQuestion {
    text: string;
    options: string[];
    correct_answer_index: number;
}

interface QuizBuilderProps {
    jobId: number;
    jobDescription: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function QuizBuilder({ jobId, jobDescription, isOpen, onClose }: QuizBuilderProps) {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    const handleAddQuestion = () => {
        setQuestions([
            ...questions,
            { text: "", options: ["", "", "", ""], correct_answer_index: 0 },
        ]);
    };

    const handleQuestionChange = (index: number, field: string, value: string | number) => {
        const updated = [...questions];
        (updated[index] as any)[field] = value;
        setQuestions(updated);
    };

    const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
        const updated = [...questions];
        updated[qIndex].options[optIndex] = value;
        setQuestions(updated);
    };

    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const generateAIQuiz = async () => {
        setAiLoading(true);
        try {
            const { data } = await axios.post(`${utils_service}/api/utils/generate-quiz`, {
                jobDescription,
                questionCount: 5,
            });
            if (Array.isArray(data)) {
                setQuestions(data);
                toast.success("AI generated 5 questions based on the job description.");
            } else {
                toast.error("Unexpected response from AI");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to generate AI quiz");
        } finally {
            setAiLoading(false);
        }
    };

    const saveQuiz = async () => {
        if (questions.length === 0) return toast.error("Please add at least one question.");

        // validation
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text) return toast.error(`Question ${i + 1} text is empty`);
            if (q.options.some((opt) => !opt)) return toast.error(`Some options in question ${i + 1} are empty`);
        }

        setLoading(true);
        const token = Cookies.get("token");
        try {
            await axios.post(
                `${job_service}/api/job/quiz`,
                { job_id: jobId, questions },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Quiz saved successfully!");
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to save quiz");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">Manage Job Quiz</DialogTitle>
                    <p className="text-sm opacity-70">
                        Create an assignment quiz for candidates. You can write questions manually or use AI.
                    </p>
                </DialogHeader>

                <div className="flex gap-4 mb-4">
                    <Button onClick={generateAIQuiz} disabled={aiLoading} className="gap-2 shrink-0 bg-secondary text-foreground hover:bg-secondary/80">
                        <Wand2 size={16} />
                        {aiLoading ? "Generating..." : "Generate AI Quiz"}
                    </Button>
                    <Button onClick={handleAddQuestion} variant="outline" className="gap-2">
                        <Plus size={16} /> Add Question
                    </Button>
                </div>

                <div className="space-y-6">
                    {questions.map((q, qIndex) => (
                        <div key={qIndex} className="p-4 border rounded-xl bg-background/50 relative">
                            <button
                                onClick={() => removeQuestion(qIndex)}
                                className="absolute top-4 right-4 text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md"
                            >
                                <Trash size={16} />
                            </button>

                            <h4 className="font-semibold mb-3">Question {qIndex + 1}</h4>
                            <Input
                                placeholder="Enter question text..."
                                value={q.text}
                                onChange={(e) => handleQuestionChange(qIndex, "text", e.target.value)}
                                className="mb-4"
                            />

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {q.options.map((opt, optIndex) => (
                                    <div key={optIndex} className="flex flex-col gap-1.5">
                                        <label className="text-xs opacity-70">Option {String.fromCharCode(65 + optIndex)}</label>
                                        <Input
                                            placeholder={`Option ${optIndex + 1}`}
                                            value={opt}
                                            onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium">Correct Answer:</label>
                                <select
                                    value={q.correct_answer_index}
                                    onChange={(e) => handleQuestionChange(qIndex, "correct_answer_index", parseInt(e.target.value))}
                                    className="p-2 border rounded-md bg-transparent text-sm w-48"
                                >
                                    {q.options.map((_, i) => (
                                        <option key={i} value={i}>
                                            Option {String.fromCharCode(65 + i)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}

                    {questions.length === 0 && !aiLoading && (
                        <div className="text-center py-10 opacity-60 border-2 border-dashed rounded-xl">
                            No questions added yet. Click 'Add Question' or generate with AI.
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={saveQuiz} disabled={loading || questions.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white min-w-24">
                        {loading ? "Saving..." : "Save Quiz"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
