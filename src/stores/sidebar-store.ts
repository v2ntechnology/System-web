import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  /** Sidebar recolhida no desktop (apenas ícones). */
  collapsed: boolean;
  /** Drawer aberto no mobile. */
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
  setMobileOpen: (value: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      mobileOpen: false,
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),
      setCollapsed: (value) => set({ collapsed: value }),
      setMobileOpen: (value) => set({ mobileOpen: value }),
    }),
    {
      name: 'rookhub.sidebar',
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
