import { CheckCircleIcon } from '@/components/icons';
import { LightCard, Pagination } from '@/management/ui';
import { useMemo, useState, type ReactNode } from 'react';

import { sortBySeverity } from '../blockers';
import type { Blocker } from '../types';
import { BlockerRow } from './blocker-row';

/**
 * Quantos por página.
 *
 * ⚠️ **Dez, e não os trinta das listas grandes** (ajustado em 19/09/2026). Aqui a
 * lista é uma FILA, lida de cima para baixo e tratada item a item: com trinta, o
 * volume real (dezessete impedimentos, vinte e seis avisos) cabia numa página só
 * e a paginação simplesmente não aparecia, porque uma página só não é paginação.
 */
const POR_PAGINA = 10;

/**
 * A fila de impedimentos.
 *
 * Fila **única**, ordenada por severidade: o topo é sempre o que tem de ser
 * consertado primeiro. Nenhum filtro muda essa ordem, só o que entra nela. O
 * gestor não pergunta "quantos checklists reprovaram", ele pergunta o que
 * impede o próximo caminhão de sair.
 */
export function BlockerQueue({
  blockers,
  note,
  action,
  emptyMessage = 'Nenhum impedimento aberto. A frota inteira pode rodar hoje.',
}: {
  blockers: Blocker[];
  /** Linha de contexto acima da lista, como o recorte que está em vigor. */
  note?: ReactNode | undefined;
  /** Ação do cabeçalho, como limpar o filtro. */
  action?: ReactNode | undefined;
  emptyMessage?: string | undefined;
}) {
  const ordered = useMemo(() => sortBySeverity(blockers), [blockers]);

  const [pagina, setPagina] = useState(1);

  /**
   * A fila pagina (pedido do usuário em 19/09/2026).
   *
   * ⚠️ **A página é fixada dentro do total**, como nas outras listas do painel:
   * quem está na página 3 e escolhe um card de severidade que devolve cinco
   * linhas cairia numa página inexistente, veria a fila vazia e concluiria que o
   * filtro não achou nada.
   *
   * ⚠️ **A ordem por severidade continua sendo a da fila INTEIRA**, e a paginação
   * corta depois dela. Ordenar por página faria a página 2 abrir com um crítico
   * embaixo de um leve da página 1, e o topo da fila deixaria de responder "o que
   * eu conserto primeiro".
   */
  const totalPaginas = Math.max(1, Math.ceil(ordered.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordered.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <LightCard title="Fila de impedimentos" action={action}>
      {note ? (
        <p className="text-on-light-muted text-label-md -mt-2 mb-3 normal-case">{note}</p>
      ) : null}

      {ordered.length === 0 ? (
        <p className="text-on-light-variant text-body-md flex items-center justify-center gap-2 py-10">
          <CheckCircleIcon size={18} aria-hidden="true" />
          {emptyMessage}
        </p>
      ) : (
        <>
          <ol className="flex flex-col">
            {daPagina.map((blocker) => (
              <BlockerRow key={blocker.id} blocker={blocker} />
            ))}
          </ol>

          <Pagination
            className="mt-5"
            page={paginaAtual}
            total={ordered.length}
            pageSize={POR_PAGINA}
            onPageChange={setPagina}
            label="impedimentos"
          />
        </>
      )}
    </LightCard>
  );
}
