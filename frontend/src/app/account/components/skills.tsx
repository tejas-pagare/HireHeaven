"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/context/AppContext";
import { AccontProps } from "@/type";
import { Award, Plus, Sparkles, X } from "lucide-react";
import React, { useState } from "react";

const Skills: React.FC<AccontProps> = ({ user, isYourAccount }) => {
  const { addSkill, btnLoading, removeSkill } = useAppData();
  const [skill, setSkill] = useState("");

  const addSkillHandler = () => {
    if (!skill.trim()) return;
    addSkill(skill, setSkill);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkillHandler();
    }
  };

  const removeSkillHandler = (skillToRemove: string) => {
    if (confirm(`Remove "${skillToRemove}" from your skills?`)) {
      removeSkill(skillToRemove);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">
          {isYourAccount ? "Your skills" : "Skills"}
        </h2>
        {isYourAccount && (
          <p className="mt-1 text-sm text-muted-foreground">
            Showcase your expertise so recruiters can find you.
          </p>
        )}
      </div>

      {isYourAccount && (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Sparkles className="icon-style" />
            <Input
              type="text"
              placeholder="e.g. React, Node.js, Python…"
              className="h-11 pl-10"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Add a skill"
            />
          </div>
          <Button
            onClick={addSkillHandler}
            className="h-11 gap-2"
            disabled={!skill.trim() || btnLoading}
          >
            <Plus size={17} /> Add skill
          </Button>
        </div>
      )}

      {user.skills && user.skills.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {user.skills.map((e, i) => (
            <span
              key={i}
              className="group inline-flex items-center gap-1.5 rounded-full border bg-card py-2 pl-4 pr-2 text-sm font-semibold transition-all hover:border-primary/40 hover:bg-accent"
            >
              {e}
              {isYourAccount && (
                <button
                  onClick={() => removeSkillHandler(e)}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive-subtle hover:text-destructive-subtle-foreground"
                  aria-label={`Remove ${e}`}
                >
                  <X size={14} />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed px-4 py-14 text-center">
          <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-muted">
            <Award size={28} className="text-muted-foreground" />
          </div>
          <p className="mb-1.5 font-semibold">
            {isYourAccount ? "No skills added yet" : "No skills listed"}
          </p>
          {isYourAccount && (
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Adding skills helps employers find you. Start with your key
              strengths above.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Skills;
