import { useState } from 'react';

/**
 * Seleção do painel de detalhe nas telas master-detail.
 *
 * Mantém sempre um item aberto: painel de detalhe vazio ao lado de uma lista
 * cheia não ajuda ninguém, e obriga um clique a mais para ver qualquer coisa.
 *
 * Se o item selecionado sai da lista — porque o filtro mudou — cai para o
 * primeiro visível em vez de deixar o painel órfão.
 *
 * ⚠️ A queda para o primeiro item é **derivada no render**, não sincronizada por
 * efeito: além de ser um render a menos, `useEffect` + `setState` para espelhar
 * props é erro de lint neste projeto.
 */
export function useMasterDetail<T>(items: T[], getId: (item: T) => string) {
  const [requestedId, setRequestedId] = useState<string | null>(null);

  const selected = items.find((item) => getId(item) === requestedId) ?? items[0] ?? null;

  return {
    selectedId: selected ? getId(selected) : null,
    setSelectedId: setRequestedId,
    selected,
  };
}
