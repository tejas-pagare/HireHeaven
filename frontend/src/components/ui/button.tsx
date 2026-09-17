import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-[var(--primary-hover)] hover:shadow-brand",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90 focus-visible:ring-destructive/40",
        success:
          "bg-success text-success-foreground shadow-soft hover:bg-success/90 focus-visible:ring-success/40",
        outline:
          "border border-border bg-background shadow-soft hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        subtle:
          "bg-brand-subtle text-brand-subtle-foreground hover:bg-primary hover:text-primary-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-9 rounded-md gap-1.5 px-3 text-[13px] has-[>svg]:px-2.5",
        lg: "h-11 rounded-lg px-6 text-[15px] has-[>svg]:px-5",
        xl: "h-12 rounded-xl px-7 text-base has-[>svg]:px-6",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
