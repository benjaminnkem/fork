"use client";

import { ErrorState } from "@/components/error-state";
import { ExecutionReview } from "@/components/execution-review";
import { Skeleton } from "@/components/ui/skeleton";
import { useSimulation } from "@/hooks/use-api";

export function ExecutionPage({ simulationId }: { simulationId: string }) {
  const simulation = useSimulation(simulationId);
  if (simulation.isLoading) return <Skeleton className="h-48" />;
  if (simulation.error) return <ErrorState error={simulation.error} title="Simulation missing" />;
  if (!simulation.data) return null;
  return <ExecutionReview simulationId={simulationId} wallet={simulation.data.wallet} />;
}
