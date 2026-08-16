"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAgentTrace,
  getChange,
  getChanges,
  getHealthReady,
  getHistoricalReplays,
  getMonitoring,
  getPositions,
  getProof,
  getRelevantChanges,
  getRisk,
  getSimulation,
  getStrategies,
  type HistoricalReplay,
} from "@/lib/api";

export function useMonitoring() {
  return useQuery({
    queryKey: ["monitoring"],
    queryFn: getMonitoring,
    refetchInterval: 15_000,
    retry: 1,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealthReady,
    refetchInterval: 15_000,
    retry: 1,
  });
}

export function usePositions(address: string | undefined) {
  return useQuery({
    queryKey: ["positions", address],
    queryFn: () => getPositions(address!),
    enabled: Boolean(address),
  });
}

export function useRisk(address: string | undefined) {
  return useQuery({
    queryKey: ["risk", address],
    queryFn: () => getRisk(address!),
    enabled: Boolean(address),
  });
}

export function useRelevantChanges(address: string | undefined) {
  return useQuery({
    queryKey: ["relevant-changes", address],
    queryFn: () => getRelevantChanges(address!),
    enabled: Boolean(address),
  });
}

export function useChanges() {
  return useQuery({
    queryKey: ["changes"],
    queryFn: getChanges,
  });
}

export function useChange(id: string | undefined) {
  return useQuery({
    queryKey: ["change", id],
    queryFn: () => getChange(id!),
    enabled: Boolean(id),
  });
}

export function useSimulation(id: string | undefined) {
  return useQuery({
    queryKey: ["simulation", id],
    queryFn: () => getSimulation(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 2000 : false;
    },
  });
}

export function useProof(id: string | undefined, ready: boolean) {
  return useQuery({
    queryKey: ["proof", id],
    queryFn: () => getProof(id!),
    enabled: Boolean(id) && ready,
    retry: false,
  });
}

export function useStrategies(id: string | undefined, ready: boolean) {
  return useQuery({
    queryKey: ["strategies", id],
    queryFn: () => getStrategies(id!),
    enabled: Boolean(id) && ready,
    retry: false,
  });
}

export function useHistoricalReplays() {
  return useQuery({
    queryKey: ["historical-replays"],
    queryFn: async (): Promise<HistoricalReplay[]> => {
      const payload = await getHistoricalReplays();
      return Array.isArray(payload) ? payload : payload.replays;
    },
  });
}

export function useAgentTrace(id: string | undefined) {
  return useQuery({
    queryKey: ["agent-trace", id],
    queryFn: () => getAgentTrace(id!),
    enabled: Boolean(id),
    retry: false,
  });
}
