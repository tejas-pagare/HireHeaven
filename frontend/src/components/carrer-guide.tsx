"use client";
import { CareerGuideResponse } from "@/type";
import axios from "axios";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { utils_service } from "@/context/AppContext";
import toast from "react-hot-toast";

const CarrerGuide = () => {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CareerGuideResponse | null>(null);

  const addSkill = () => {
    if (currentSkill.trim() && !skills.includes(currentSkill.trim())) {
      setSkills([...skills, currentSkill.trim()]);
      setCurrentSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addSkill();
    }
  };

  const getCarrerGuidance = async () => {
    if (skills.length === 0) {
      toast.error("Please add at least on skill");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post<CareerGuideResponse>(`${utils_service}/api/utils/career`, {
        skills: skills,
      });

      setResponse(data);
      toast.success("Carrer guidence generated");
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setSkills([]);
    setCurrentSkill("");
    setResponse(null);
    setOpen(false);
  };
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size={"lg"} className="gap-2 h-12 px-8">
              <Sparkles size={18} />
              Get Career Guidance <ArrowRight size={16} />
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {!response ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-2">
                    <Sparkles className="text-primary" />
                    Tell us about your skills
                  </DialogTitle>
                  <DialogDescription>
                    Add your technical skills to recieve personalized carrer
                    recomendations
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="skill">Add Skills</Label>
                    <div className="flex gap-2">
                      <Input
                        id="skill"
                        placeholder="e.g., React, Node.js, Python..."
                        value={currentSkill}
                        onChange={(e) => setCurrentSkill(e.target.value)}
                        className="h-11"
                        onKeyPress={handleKeyPress}
                      />
                      <Button onClick={addSkill} className="gap-2">
                        Add
                      </Button>
                    </div>
                  </div>

                  {skills.length > 0 && (
                    <div className="space-y-2">
                      <Label>Your Skills ({skills.length})</Label>
                      <div className="flex flex-wrap gap-2">
                        {skills.map((s) => (
                          <div
                            key={s}
                            className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-brand-subtle border border-primary/25"
                          >
                            <span className="text-sm font-medium">{s}</span>
                            <button
                              onClick={() => removeSkill(s)}
                              className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex in-checked: justify-center"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={getCarrerGuidance}
                    disabled={loading || skills.length === 0}
                    className="w-full h-11 gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Analyzing
                        Your skills...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} /> Generate Carrer Guidence
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-2">
                    <Target className="text-primary" />
                    Your Personlized Carrer Guide
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* summary */}
                  <div className="p-4 rounded-lg bg-brand-subtle border border-b-blue-200 dark:border-b-blue-800">
                    <div className="flex items-start gap-3">
                      <Lightbulb
                        className="text-primary mt-1 shrink-0"
                        size={20}
                      />
                      <div>
                        <h3 className="font-semibold mb-2">Carrer Summary</h3>
                        <p className="text-sm leading-relaxed opacity-90">
                          {response.summary}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* job options */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Briefcase size={20} className="text-primary" />
                      Recomended Carrer Paths
                    </h3>
                    <div className="space-y-3">
                      {response.jobOptions.map((job, index) => (
                        <div
                          className="p-4 rounded-lg border hover:border-primary/25 transition-colors"
                          key={index}
                        >
                          <h4 className="font-semibold text-base mb-2">
                            {job.title}
                          </h4>

                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium opacity-70">
                                Responsibilities:
                              </span>
                              <span className="opacity-80">
                                {job.responsibilities}
                              </span>
                            </div>
                            <span className="font-medium opacity-70">
                              Why this Role:
                            </span>
                            <span className="opacity-80">{job.why}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Skills to learn */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp size={20} className="text-primary" />
                      Skills to Enhance Your Carrer
                    </h3>
                    <div className="space-y-4">
                      {response.skillsToLearn.map((category, index) => (
                        <div className="space-y-2" key={index}>
                          <h4 className="font-semibold text-sm text-primary">
                            {category.category}
                          </h4>
                          <div className="space-y-2">
                            {category.skills.map((skill, sindex) => (
                              <div
                                key={sindex}
                                className="p-3 rounded-lg bg-secondary border text-sm"
                              >
                                <p className="font-medium mb-1">
                                  {skill.title}
                                </p>

                                <p className="text-xs opacity-70 mb-1">
                                  <span className="font-medium">Why: </span>
                                  {skill.why}
                                </p>

                                <p className="text-xs opacity-70 mb-1">
                                  <span className="font-medium">How: </span>
                                  {skill.how}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Learning approch */}
                  <div className="p-4 rounded-lg border bg-brand-subtle/40">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <BookOpen size={20} className="text-primary" />
                      {response?.learningApproach?.title}
                    </h3>

                    <ul className="space-y-2">
                      {response?.learningApproach?.points?.map(
                        (point, index) => (
                          <li
                            key={index}
                            className="text-sm flex items-start gap-2"
                          >
                            <span className="text-primary mt-0.5">•</span>
                            <span
                              className="opacity-90"
                              dangerouslySetInnerHTML={{ __html: point }}
                            />
                          </li>
                        )
                      )}
                    </ul>
                  </div>

                  <Button
                    onClick={resetDialog}
                    variant={"outline"}
                    className="w-full"
                  >
                    Start New Analysis
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default CarrerGuide;
