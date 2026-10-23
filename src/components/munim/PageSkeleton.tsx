import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return <div role="status" aria-label="Carregando" className="space-y-4 p-6">
    <Skeleton className="h-8 w-40" />
    <Skeleton className="h-4 w-2/3 max-w-md" />
    <div className="grid gap-4 sm:grid-cols-2">
      <Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" />
    </div>
    <Skeleton className="h-48 w-full" />
  </div>;
}