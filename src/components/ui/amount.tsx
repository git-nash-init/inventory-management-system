import { formatINR, formatAmount } from "@/lib/format/money";
import { cn } from "@/lib/utils";

/** Money in tabular mono figures. Negative shown with a minus sign. */
export function Money({ value, className, symbol = true }: { value: number; className?: string; symbol?: boolean }) {
  return <span className={cn("num whitespace-nowrap", value < 0 && "text-bad", className)}>{symbol ? formatINR(value) : formatAmount(value)}</span>;
}
