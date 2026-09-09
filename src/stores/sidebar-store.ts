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
      /* ⚠️ Recolhida por padrão desde 09/09/2026, a pedido do usuário: o
         desenho da barra é o TRILHO de pastilhas, e é assim que ele abre.
         Quem prefere os rótulos expande uma vez, e a escolha fica gravada. */
      collapsed: true,
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
