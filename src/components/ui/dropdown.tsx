"use client";

import * as React from "react";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownTrigger = M.Trigger;

export function DropdownContent({
  className,
  align = "end",
  ...props
}: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={4}
        className={cn("z-50 min-w-48 rounded border border-line bg-surface p-1 text-sm", className)}
        {...props}
      />
    </M.Portal>
  );
}

export function DropdownItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn("flex cursor-default select-none items-center gap-2 rounded px-2.5 py-1.5 outline-none data-[highlighted]:bg-surface-2", className)}
      {...props}
    />
  );
}

export const DropdownLabel = ({ className, ...props }: React.ComponentProps<typeof M.Label>) => (
  <M.Label className={cn("px-2.5 py-1.5 text-xs text-muted", className)} {...props} />
);
export const DropdownSeparator = ({ className, ...props }: React.ComponentProps<typeof M.Separator>) => (
  <M.Separator className={cn("my-1 h-px bg-line", className)} {...props} />
);
