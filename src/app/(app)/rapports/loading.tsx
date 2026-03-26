import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Paramètres */}
      <Skeleton className="h-28 rounded-xl" />
      {/* Catégories de rapports */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: i === 2 ? 1 : 2 }).map((_, j) => (
              <Skeleton key={j} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
