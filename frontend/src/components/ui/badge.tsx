import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1.5 w-fit shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors [&>svg]:pointer-events-none [&>svg]:size-3.5 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        brand:
          "border-transparent bg-brand-subtle text-brand-subtle-foreground",
        success:
          "border-transparent bg-success-subtle text-success-subtle-foreground",
        warning:
          "border-transparent bg-warning-subtle text-warning-subtle-foreground",
        destructive:
          "border-transparent bg-destructive-subtle text-destructive-subtle-foreground",
      },
      size: {
        default: "px-2.5 py-1 text-xs",
        sm: "px-2 py-0.5 text-[11px]",
        lg: "px-3 py-1.5 text-sm",
      },
      shape: {
        default: "rounded-md",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, shape, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
