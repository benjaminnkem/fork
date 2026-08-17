import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function InlineLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <WalletBodySkeleton />
      <p className="sr-only" role="status">
        {label}
      </p>
    </div>
  );
}

export function WalletBodySkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="grid gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function CardLoading({ label = "Loading" }: { label?: string }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <InlineLoading label={label} />
      </CardContent>
    </Card>
  );
}
