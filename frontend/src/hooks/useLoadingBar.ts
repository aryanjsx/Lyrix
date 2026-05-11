import { useCallback } from "react";
import { create } from "zustand";

interface LoadingBarState {
  isLoading: boolean;
  progress: number;
  startLoading: () => void;
  setProgress: (n: number) => void;
  stopLoading: () => void;
}

export const useLoadingBarStore = create<LoadingBarState>((set) => ({
  isLoading: false,
  progress: 0,
  startLoading: () => set({ isLoading: true, progress: 10 }),
  setProgress: (progress) => set({ progress }),
  stopLoading: () => {
    set({ progress: 100 });
    setTimeout(() => set({ isLoading: false, progress: 0 }), 300);
  },
}));

export function useLoadingBar() {
  const startLoading = useLoadingBarStore((s) => s.startLoading);
  const stopLoading = useLoadingBarStore((s) => s.stopLoading);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      startLoading();
      try {
        return await fn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  return { startLoading, stopLoading, withLoading };
}
