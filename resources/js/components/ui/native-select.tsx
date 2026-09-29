import * as React from "react"

import { cn } from "@/lib/utils"

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 [&>option]:bg-background",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
