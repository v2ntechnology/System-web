import {
  AlertCircleIcon,
  CalendarIcon,
  FileIcon,
  MoneyIcon,
  SearchIcon,
  WarningIcon,
} from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { HeroBand, HeroPill } from '@/management/components/layout/hero-band';
import { HeroStats } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';
import { SegmentedFilter } from '@/management/components/layout/segmented-filter';
import { Pagination } from '@/management/ui';

import { fetchDocuments } from '../api';
import { DocumentRow } from '../components/document-row';
import { copyDigitableLine } from '../copy-line';
import { KIND_LABEL } from '../types';

/** Fila: dez por página, como as demais do painel. */
const POR_PAGINA = 10;

type Recorte = 'pendentes' | 'todos' | 'LICENCIAMENTO' | 'IPVA' | 'CRONOTACOGRAFO';

export function DocumentsPage() {
  const [recorte, setRecorte] = useState<Recorte>('pendentes');
  const [pagina, setPagina] = useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ['vehicle-documents'],
    queryFn: () => fetchDocuments(),
  });

  const todos = useMemo(() => data?.items ?? [], [data]);

  const filtrados = useMemo(() => {
    if (recorte === 'todos') return todos;
    if (recorte === 'pendentes') return todos.filter((d) => d.pending);
    if (recorte === 'IPVA') return todos.filter((d) => d.kind.startsWith('IPVA'));
    return todos.filter((d) => d.kind === recorte);
  }, [todos, recorte]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const visiveis = filtrados.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  const resumo = data?.summary;

  function trocar(novo: Recorte) {
    setRecorte(novo);
    setPagina(1);
  }

  return (
    <>
      <HeroBand
        title="Documentos da frota"
        description="Licenciamento, IPVA e cronotacógrafo, com a guia e a linha digitável de cada veículo."
      >
        {resumo ? <HeroPill icon={FileIcon}>{resumo.total} guias</HeroPill> : null}
      </HeroBand>

      <PageContent className="rounded-t-4xl bg-light -mt-16 pt-8 sm:-mt-20 sm:rounded-t-[40px]">
        <QueryState isPending={isPending} isError={isError} label="os documentos da frota">
          {data && resumo ? (
            <>
              <h2 className="sr-only">Resumo dos documentos</h2>

              {/*
               * ⚠️ **"Pendências" NÃO é "guias com data passada", e a diferença é
               * enorme.** Na frota real são 88 com data vencida e 9 pendências:
               * a guia de licenciamento vence em janeiro, e quem pagou em
               * janeiro fica com a data passada o ano inteiro. Mostrar 88 aqui
               * seria alarme falso sobre uma frota quase em dia.
               */}
              <HeroStats
                items={[
                  {
                    key: 'pendentes',
                    label: 'Pendências',
                    value: resumo.overdue,
                    hint: 'Exercício atrasado ou certificado vencido',
                    icon: AlertCircleIcon,
                    tone: resumo.overdue > 0 ? 'alert' : 'neutral',
                    onSelect: () => trocar('pendentes'),
                    selected: recorte === 'pendentes',
                  },
                  {
                    key: 'vencendo',
                    label: 'Vencem em 30 dias',
                    value: resumo.dueIn30Days,
                    hint: 'Guias com data a chegar',
                    icon: CalendarIcon,
                    tone: resumo.dueIn30Days > 0 ? 'warn' : 'neutral',
                  },
                  {
                    key: 'valor',
                    label: 'Valor do exercício',
                    value: moeda(resumo.openAmount),
                    hint: 'Somando as guias do ano corrente',
                    icon: MoneyIcon,
                  },
                  {
                    key: 'nunca',
                    label: 'Nunca pesquisados',
                    value: resumo.neverSearched,
                    hint: 'Veículos sem consulta no DETRAN',
                    icon: SearchIcon,
                    tone: resumo.neverSearched > 0 ? 'warn' : 'neutral',
                  },
                ]}
              />

              <div className="mt-8">
                <SegmentedFilter<Recorte>
                  label="Recorte dos documentos"
                  options={[
                    {
                      id: 'pendentes',
                      label: 'Pendentes',
                      count: todos.filter((d) => d.pending).length,
                    },
                    { id: 'todos', label: 'Todos', count: todos.length },
                    {
                      id: 'LICENCIAMENTO',
                      label: KIND_LABEL.LICENCIAMENTO,
                      count: todos.filter((d) => d.kind === 'LICENCIAMENTO').length,
                    },
                    {
                      id: 'IPVA',
                      label: 'IPVA',
                      count: todos.filter((d) => d.kind.startsWith('IPVA')).length,
                    },
                    {
                      id: 'CRONOTACOGRAFO',
                      label: KIND_LABEL.CRONOTACOGRAFO,
                      count: todos.filter((d) => d.kind === 'CRONOTACOGRAFO').length,
                    },
                  ]}
                  value={recorte}
                  onValueChange={trocar}
                />
              </div>

              {/*
               * ⚠️ A frase diz de onde veio e o que a tela NÃO faz. Uma tela com
               * botão de boleto em cima de uma frota inteira sugere que dá para
               * pagar por aqui, e não dá: a Smartec entrega o documento, o
               * pagamento acontece no banco.
               */}
              <p className="text-on-light-variant text-body-sm mt-6">
                {frase(filtrados.length, todos.length)} O RookHub mostra a guia e a linha digitável;
                o pagamento é feito no banco.
              </p>

              <ul className="mt-4 flex flex-col gap-3">
                {visiveis.map((doc) => (
                  <li key={doc.id}>
                    <DocumentRow doc={doc} onCopy={() => void copyDigitableLine(doc)} />
                  </li>
                ))}
              </ul>

              {filtrados.length === 0 ? (
                <p className="text-on-light-variant text-body-md py-10 text-center">
                  {recorte === 'pendentes'
                    ? 'Nenhuma pendência de documento na frota.'
                    : 'Nenhum documento neste recorte.'}
                </p>
              ) : null}

              {paginas > 1 ? (
                <div className="mt-6">
                  <Pagination
                    page={atual}
                    pageCount={paginas}
                    pageSize={POR_PAGINA}
                    total={filtrados.length}
                    onPageChange={setPagina}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </QueryState>
      </PageContent>
    </>
  );
}

function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function frase(visiveis: number, total: number): string {
  return visiveis === total ? `${total} guias.` : `${visiveis} de ${total} guias.`;
}

/* O ícone de aviso entra no cabeçalho quando há pendência, e não por enfeite. */
export const DOCUMENTS_ALERT_ICON = WarningIcon;
