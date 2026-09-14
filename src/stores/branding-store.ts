import { create } from 'zustand';

/**
 * O logo do cliente, quando ele enviou um.
 *
 * As cores e a fonte da marca são aplicadas como variáveis CSS e nenhum
 * componente precisa saber delas (ver `services/branding.ts`). O logo é a
 * exceção: é um `<img>`, e a decisão de trocar a arte da RookHub pela do cliente
 * mora num componente, o `BrandLogo`.
 *
 * ⚠️ Nulo é o caso comum, e não uma falha: cliente sem logo enviado, e a porta
 * da própria RookHub, mostram a arte de sempre.
 */
interface BrandingState {
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
}

export const useBrandingStore = create<BrandingState>()((set) => ({
  logoUrl: null,
  setLogoUrl: (logoUrl) => set({ logoUrl }),
}));
