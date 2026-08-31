import type { ComponentPropsWithoutRef } from "react"
import Balancer from "react-wrap-balancer"

import { cn } from "@/lib/utils"

function PageHeader({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "mx-auto flex max-w-4xl flex-col items-center gap-2 px-4 pt-8 motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in-0 md:pt-12",
        className
      )}
      {...props}
    >
      {children}
    </section>
  )
}

function PageHeaderHeading({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      className={cn(
        "font-display bg-gradient-to-br from-black to-stone-500 bg-clip-text text-center text-4xl leading-tight tracking-tight text-transparent drop-shadow-sm motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 dark:from-stone-100 dark:to-stone-400 md:text-8xl md:leading-[6rem] lg:leading-[1.1]",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  )
}

function PageHeaderDescription({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cn(
        "text-center text-lg text-muted-foreground motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 md:text-xl",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}

function PageHeaderCTA({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-center gap-3 motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { PageHeader, PageHeaderHeading, PageHeaderDescription, PageHeaderCTA }
