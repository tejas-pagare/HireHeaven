import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/context/AppContext";
import { AccontProps } from "@/type";
import { Award, Plus, Sparkle, X } from "lucide-react";
import React, { useState } from "react";

const Skills: React.FC<AccontProps> = ({ user, isYourAccount }) => {
  const { addSkill, btnLoading, removeSkill } = useAppData();
  const [skill, setSkill] = useState("");

  const addSkillHandler = () => {
    if (!skill.trim()) {
      alert("Please enter a skill");
      return;
    }
    addSkill(skill, setSkill);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addSkillHandler();
    }
  };

  const removeSkillHandler = (skillToRemove: string) => {
    if (confirm(`Are you sure you want to remove ${skillToRemove} ?`)) {
      removeSkill(skillToRemove);
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 mt-4 sm:mt-8">
      
      {/* Header Section */}
      <div className="mb-10 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 shrink-0 shadow-sm border border-blue-200 dark:border-blue-800/30">
            <Award size={24} />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {isYourAccount ? "Your Skills" : "User Skills"}
          </h1>
        </div>
        {isYourAccount && (
          <p className="text-muted-foreground ml-15 sm:ml-16">
            Showcase your expertise and abilities to stand out to recruiters.
          </p>
        )}
      </div>

      <div className="space-y-10">
        
        {/* Add Skills Input */}
        {isYourAccount && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-6 bg-muted/20 border border-border/50 rounded-2xl shadow-sm">
            <div className="relative flex-1 w-full">
              <Sparkle
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="text"
                placeholder="e.g. React, Node.js, Python..."
                className="h-12 pl-12 bg-background border-border/50 rounded-xl"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <Button
              onClick={addSkillHandler}
              className="h-12 gap-2 px-6 rounded-xl w-full sm:w-auto shadow-sm"
              disabled={!skill.trim() || btnLoading}
            >
              <Plus size={18} /> Add Skill
            </Button>
          </div>
        )}

        {/* Skills Display */}
        <div>
          {user.skills && user.skills.length > 0 ? (
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {user.skills.map((e, i) => (
                <div
                  className="group relative inline-flex items-center gap-2 border border-border/60 bg-muted/10 rounded-full hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 duration-200 transition-all pl-5 pr-3 py-2 sm:py-2.5"
                  key={i}
                >
                  <span className="font-semibold text-sm sm:text-base text-foreground/90">{e}</span>

                  {isYourAccount && (
                    <button
                      onClick={() => removeSkillHandler(e)}
                      className="h-7 w-7 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-all ml-1"
                      title={`Remove ${e}`}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-muted/10 border border-dashed border-border/60 rounded-2xl">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/40 border border-border/50 mb-5">
                <Award size={32} className="text-muted-foreground opacity-60" />
              </div>
              <p className="text-lg font-medium text-foreground mb-2">
                {isYourAccount
                  ? "No skills added yet"
                  : "No skills added by user"}
              </p>
              {isYourAccount && (
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Adding skills helps employers find you easily. Start building your profile by adding your key strengths above.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Skills;
