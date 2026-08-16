import { create } from "zustand";

type AnalysisSource = "paste" | "connected" | null;

interface AnalysisState {
  lastAddress: string | null;
  source: AnalysisSource;
  setAddress: (address: string, source: Exclude<AnalysisSource, null>) => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  lastAddress: null,
  source: null,
  setAddress: (address, source) => set({ lastAddress: address, source }),
}));
