import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor";
import { Section } from "@/services/blogService";
import { Trash, ArrowUp, ArrowDown, GripVertical } from "lucide-react";

interface SectionBuilderProps {
    sections: Section[];
    setSections: (sections: Section[]) => void;
}

export function SectionBuilder({ sections, setSections }: SectionBuilderProps) {
    const addSection = () => {
        const newSection: Section = {
            id: crypto.randomUUID(),
            heading: "",
            content: "",
            order: sections.length + 1,
        };
        setSections([...sections, newSection]);
    };

    const updateSection = (id: string, field: keyof Section, value: any) => {
        setSections(
            sections.map((s) => (s.id === id ? { ...s, [field]: value } : s))
        );
    };

    const removeSection = (id: string) => {
        setSections(sections.filter((s) => s.id !== id));
    };

    const moveSection = (index: number, direction: "up" | "down") => {
        const newSections = [...sections];
        if (direction === "up" && index > 0) {
            [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
        } else if (direction === "down" && index < sections.length - 1) {
            [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
        }
        // Reassign orders
        newSections.forEach((s, i) => (s.order = i + 1));
        setSections(newSections);
    };

    return (
        <div className="space-y-6">
            {sections.map((section, index) => (
                <div key={section.id} className="p-4 border rounded-lg bg-card shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-muted-foreground">Section {index + 1}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => moveSection(index, "up")}
                                disabled={index === 0}
                                className="p-1 hover:bg-muted rounded disabled:opacity-30"
                            >
                                <ArrowUp size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => moveSection(index, "down")}
                                disabled={index === sections.length - 1}
                                className="p-1 hover:bg-muted rounded disabled:opacity-30"
                            >
                                <ArrowDown size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => removeSection(section.id)}
                                className="p-1 text-destructive hover:bg-destructive-subtle rounded"
                            >
                                <Trash size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Heading (Optional)</label>
                            <input
                                type="text"
                                value={section.heading || ""}
                                onChange={(e) => updateSection(section.id, "heading", e.target.value)}
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-ring outline-none"
                                placeholder="e.g. Introduction"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Content</label>
                            <RichTextEditor
                                content={section.content}
                                onChange={(content) => updateSection(section.id, "content", content)}
                            />
                        </div>
                    </div>
                </div>
            ))}

            <button
                type="button"
                onClick={addSection}
                className="w-full py-3 border-2 border-dashed rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors flex justify-center items-center gap-2"
            >
                + Add Section
            </button>
        </div>
    );
}
