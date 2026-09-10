import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * As classes `.acao-*` são um grupo de UMA escolha só.
 *
 * ⚠️ Sem isto o `tailwind-merge` não sabe que elas conflitam, porque não são
 * utilitárias dele: ficavam as duas na string e vencia a que o `globals.css`
 * declara por último. O sintoma, medido em 09/09/2026 no rodapé do menu do
 * painel operacional, era o botão "Sair" saindo CINZA em vez de vermelho, igual
 * ao de configurações ao lado. O `Button` injeta `acao-neutra` em todo
 * `ghost + icon`, e o `acao-sair` que o autor pedia perdia a disputa.
 *
 * Declarado o grupo, vale a regra normal do merge: a última classe ganha, e
 * "última" é a que quem escreveu o componente passou.
 *
 * Ver as definições em `styles/globals.css`. Acrescentou uma `.acao-` que ESCOLHE
 * uma cor? Ela entra aqui também, senão volta a empatar em silêncio.
 *
 * ⚠️ `.acao-sair-no-menu` fica de FORA da lista de propósito. Ela não é uma
 * sexta cor: é um reforço que anda junto com `.acao-sair` (ver `user-menu.tsx`,
 * onde as duas aparecem na mesma string). No grupo, o merge descartaria uma
 * delas e o botão perderia a cor de repouso ou o hover.
 */
/* O `'acao'` no parâmetro de tipo é o que apresenta o grupo NOVO ao
   `tailwind-merge`: sem ele o TypeScript só aceita os ids que já vêm de fábrica. */
const twMerge = extendTailwindMerge<'acao'>({
  extend: {
    classGroups: {
      acao: ['acao-editar', 'acao-excluir', 'acao-sair', 'acao-ativar', 'acao-neutra'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
