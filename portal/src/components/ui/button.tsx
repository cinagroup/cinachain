import { cva, type VariantProps } from "class-variance-authority"

/**
 * Button class variants — mirrors the DApp's `buttonVariants` exactly.
 * The portal only needs the class strings (applied to <a> elements), so the
 * Radix Slot-backed <Button> is intentionally omitted.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Vercel primary button (ink black). Marketing CTAs add the
        // `btn-pill` utility explicitly — in-app scale stays at 6px.
        default:
          "bg-primary text-primary-foreground hover:opacity-90 shadow-vercel-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-card text-foreground hover:bg-secondary shadow-vercel-card",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-link underline-offset-4 hover:text-link-deep hover:underline",
        blue: "bg-link text-white shadow-vercel-sm hover:bg-link-deep",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]
export type ButtonSize = VariantProps<typeof buttonVariants>["size"]
