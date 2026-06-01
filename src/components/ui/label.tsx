import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-ex-muted text-xs font-medium tracking-wide uppercase", className)}
      {...props}
    />
  );
}
