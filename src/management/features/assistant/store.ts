import type { AssistantTurn } from '@/management/types';
import { create } from 'zustand';

interface AssistantState {
  open: boolean;
  turns: AssistantTurn[];
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  addTurn: (turn: AssistantTurn) => void;
  updateTurn: (id: string, patch: Partial<AssistantTurn>) => void;
  reset: () => void;
}

/**
 * Estado do assistente.
 *
 * A conversa vive só em memória: RN-117 limita a memória a 5 turnos no servidor
 * e o histórico persistido é responsabilidade do backend, não do cliente.
 */
export const useAssistantStore = create<AssistantState>((set) => ({
  open: false,
  turns: [],
  openAssistant: () => set({ open: true }),
  closeAssistant: () => set({ open: false }),
  toggleAssistant: () => set((state) => ({ open: !state.open })),
  addTurn: (turn) => set((state) => ({ turns: [...state.turns, turn] })),
  updateTurn: (id, patch) =>
    set((state) => ({
      turns: state.turns.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)),
    })),
  reset: () => set({ turns: [] }),
}));
