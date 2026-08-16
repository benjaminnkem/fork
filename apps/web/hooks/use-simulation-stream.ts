"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSimulation, simulationStreamUrl, type SimulationEvent, type SimulationRun } from "@/lib/api";

export function useSimulationStream(id: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!id) return;
    const url = simulationStreamUrl(id);
    const source = new EventSource(url);

    const applyEvent = (type: string, raw: string) => {
      let payload: { type?: string; at?: string; data?: Record<string, unknown>; status?: string } = {};
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        payload = {};
      }
      queryClient.setQueryData<SimulationRun>(["simulation", id], (current) => {
        if (!current) return current;
        const event: SimulationEvent = {
          id: crypto.randomUUID(),
          type: payload.type ?? type,
          at: payload.at ?? new Date().toISOString(),
          data: payload.data,
        };
        const already = current.events.some(
          (existing) => existing.type === event.type && existing.at === event.at,
        );
        return {
          ...current,
          status: payload.status ?? current.status,
          events: already ? current.events : [...current.events, event],
        };
      });
      if (payload.status === "COMPLETED" || payload.status === "FAILED") {
        void queryClient.invalidateQueries({ queryKey: ["simulation", id] });
        void queryClient.invalidateQueries({ queryKey: ["proof", id] });
        void queryClient.invalidateQueries({ queryKey: ["strategies", id] });
      }
    };

    source.onmessage = (event) => applyEvent("message", event.data);
    const named = [
      "SIMULATION_QUEUED",
      "FORK_STARTING",
      "FORK_READY",
      "BASELINE_CAPTURED",
      "CHANGE_REPLAY_STARTED",
      "CHANGE_REPLAY_COMPLETED",
      "RISK_MEASURED",
      "AGENT_STARTED",
      "STRATEGY_OPTIMIZATION_STARTED",
      "STRATEGY_BRANCH_RESULT",
      "RECOMMENDATION_READY",
      "PROOF_READY",
      "FAILED",
      "CANCELLED",
    ];
    for (const type of named) {
      source.addEventListener(type, (event) => {
        applyEvent(type, (event as MessageEvent<string>).data);
      });
    }
    source.onerror = () => {
      void getSimulation(id)
        .then((run) => {
          queryClient.setQueryData(["simulation", id], run);
          if (run.status === "COMPLETED" || run.status === "FAILED") {
            source.close();
          }
        })
        .catch(() => undefined);
    };

    return () => {
      source.close();
    };
  }, [id, queryClient]);
}
