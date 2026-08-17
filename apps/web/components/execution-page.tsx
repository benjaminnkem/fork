"use client";

import { ErrorState } from "@/components/error-state";
import { ExecutionReview } from "@/components/execution-review";
import { PageLoading } from "@/components/loading-state";
import { useSimulation } from "@/hooks/use-api";

export function ExecutionPage({ simulationId }: { simulationId: string }) {
  const simulation = useSimulation(simulationId);
  if (simulation.isLoading) return <PageLoading label="Loading execution" />;
  if (simulation.error) return <ErrorState error={simulation.error} title="Simulation missing" />;
  if (!simulation.data) return null;
  return <ExecutionReview simulationId={simulationId} wallet={simulation.data.wallet} />;
}
