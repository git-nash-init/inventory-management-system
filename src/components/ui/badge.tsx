import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "border-line bg-surface-2 text-muted",
      ok: "border-ok/40 bg-ok-bg text-ok",
      warn: "border-warn/40 bg-warn-bg text-warn",
      bad: "border-bad/40 bg-bad-bg text-bad",
      accent: "border-accent/40 bg-surface-2 text-accent",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
