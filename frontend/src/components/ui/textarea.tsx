import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground bg-background dark:bg-input/30",
        "flex field-sizing-content min-h-20 w-full rounded-lg border px-3.5 py-2.5 text-base shadow-soft",
        "transition-[color,box-shadow,border-color] outline-none md:text-sm",
        "hover:border-border/80",
        "focus-visible:border-primary focus-visible:ring-ring/25 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
