import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Vercel primary button (black pill)
        default:
          "bg-primary text-primary-foreground btn-pill hover:opacity-90 shadow-vercel-sm",
        // Destructive action
        destructive:
          "bg-destructive text-destructive-foreground btn-pill hover:bg-destructive/90",
        // Outline with border
        outline:
          "border border-border bg-card text-foreground btn-pill hover:bg-secondary shadow-vercel-card",
        // Secondary (white/gray)
        secondary:
          "bg-secondary text-secondary-foreground btn-pill hover:bg-secondary/80",
        // Ghost (no background)
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-md",
        // Link style
        link: "text-link underline-offset-4 hover:text-link-deep hover:underline",
        // Brand colors
        blue: "bg-[#0070f3] text-white btn-pill hover:bg-[#0761d1] shadow-vercel-sm",
        emerald: "bg-emerald-600 text-white btn-pill hover:bg-emerald-700 shadow-vercel-sm",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base btn-pill",
        xl: "h-14 px-10 text-lg btn-pill",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
