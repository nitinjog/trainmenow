import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LearningJourney, TrainingModule } from '../types';

interface LearningState {
  currentJourney: LearningJourney | null;
  currentModule: TrainingModule | null;
  progress: Record<string, number>;
  notes: Record<string, string>;
  setCurrentJourney: (journey: LearningJourney) => void;
  setCurrentModule: (module: TrainingModule) => void;
  updateProgress: (key: string, percentage: number) => void;
  updateNote: (submoduleId: string, note: string) => void;
  clearJourney: () => void;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set) => ({
      currentJourney: null,
      currentModule: null,
      progress: {},
      notes: {},
      setCurrentJourney: (journey) => set({ currentJourney: journey }),
      setCurrentModule: (module) => set({ currentModule: module }),
      updateProgress: (key, percentage) =>
        set((state) => ({ progress: { ...state.progress, [key]: percentage } })),
      updateNote: (submoduleId, note) =>
        set((state) => ({ notes: { ...state.notes, [submoduleId]: note } })),
      clearJourney: () =>
        set({ currentJourney: null, currentModule: null, progress: {}, notes: {} }),
    }),
    { name: 'learning-store' }
  )
);
