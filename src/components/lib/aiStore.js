import { create } from "zustand";
//Tiny global store so any component (Userinfo button, App.jsx) can open or
//close the AI companion panel without prop drilling — same pattern as chatStore.

export const useAiStore = create((set) => ({
  isAiOpen: false,

  toggleAi: () => set((state) => ({ isAiOpen: !state.isAiOpen })),
  closeAi: () => set({ isAiOpen: false }),
}));
