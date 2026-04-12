import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md relative overflow-hidden", className)}
      {...props}
    >
      <div className="absolute inset-0 skeleton-shimmer" />
    </div>
  );
}

export { Skeleton };
