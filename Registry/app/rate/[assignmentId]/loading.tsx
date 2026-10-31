import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown between items while the next one loads: the rating layout's outline with a spinner over the scan. */
export default function Loading() {
  return (
    <main className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-2 lg:h-[calc(100vh-5rem)]">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-14 w-full" />
        <div className="relative grid min-h-[320px] flex-1 place-items-center rounded-xl border bg-muted/40">
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-7 animate-spin text-primary" />
            Loading…
          </div>
        </div>
      </div>
      <div className="hidden flex-col gap-3 lg:flex">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </main>
  );
}
