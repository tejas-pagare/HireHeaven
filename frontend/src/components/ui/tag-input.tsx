import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
    tags: string[];
    setTags: (tags: string[]) => void;
}

export function TagInput({ tags, setTags }: TagInputProps) {
    const [input, setInput] = useState("");

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const trimmed = input.trim();
            if (trimmed && !tags.includes(trimmed)) {
                setTags([...tags, trimmed]);
                setInput("");
            }
        } else if (e.key === "Backspace" && !input && tags.length > 0) {
            setTags(tags.slice(0, -1));
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter((tag) => tag !== tagToRemove));
    };

    return (
        <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md focus-within:ring-2 focus-within:ring-ring">
            {tags.map((tag, index) => (
                <span
                    key={index}
                    className="flex items-center gap-1 px-2 py-1 text-sm bg-brand-subtle text-brand-subtle-foreground rounded-full"
                >
                    {tag}
                    <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-primary hover:text-brand-subtle-foreground"
                    >
                        <X size={14} />
                    </button>
                </span>
            ))}
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add tags..."
                className="flex-1 min-w-[120px] outline-none bg-transparent"
            />
        </div>
    );
}
