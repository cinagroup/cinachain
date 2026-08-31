import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

function PageSection({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "mx-auto flex w-full flex-col items-center gap-2 py-8 motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in-0 sm:px-4 md:py-12",
        className
      )}
      {...props}
    >
      {children}
    </section>
  )
}

function PageSectionGrid({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "my-10 grid w-full max-w-screen-xl grid-cols-1 gap-5 px-5 motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in-0 md:grid-cols-3 xl:px-0",
        className
      )}
      {...props}
    >
      {children}
    </section>
  )
}

export { PageSection, PageSectionGrid }
