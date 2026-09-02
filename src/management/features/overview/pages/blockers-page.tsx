import { ArrowLeftIcon, WarningIcon } from '@/components/icons';
import { SpectrumButton } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';

import { getFleetOverview } from '../api';
import { KIND_META, SEVERITY_META, countByKind, countBySeverity } from '../blockers';
import { BlockerQueue } from '../components/blocker-queue';
import { HeroBand, HeroLink, HeroPill } from '@/management/components/layout/hero-band';
import { KindFilters } from '../components/kind-filters';
import { SeverityCards } from '../components/severity-cards';
import { OVERVIEW_PATH } from '../paths';
import type { BlockerKind, BlockerSeverity } from '../types';

/**
 * Tela de impedimentos (`/gestao/impedimentos`).
 *
 * É para onde o botão da visão geral leva. Lá o gestor vê o tamanho do problema;
 * aqui ele trata caso a caso.
 *
 * A leitura é a mesma da visão geral: faixa indigo, cards encostados nela e o
 * conteúdo abaixo. Os cards e a fileira de tipos são **filtros**, e o que eles
 * mudam é só o que entra na fila. A ordem por severidade nunca muda, porque o
 * topo da fila é a resposta para "o que eu conserto primeiro".
 *
 * Usa a mesma consulta da visão geral: quem vem pelo botão encontra o dado já em
 * cache, e a tela abre sem carregamento.
 */
export function BlockersPage() {
  const [severity, setSeverity] = useState<BlockerSeverity | null>(null);
  const [kind, setKind] = useState<BlockerKind | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['overview', 'fleet'],
    queryFn: getFleetOverview,
  });

  const blockers = useMemo(() => data?.blockers ?? [], [data]);

  /* Contagens sempre sobre a fila inteira: se elas seguissem o filtro, escolher
     um tipo zeraria os outros e o gestor perderia a noção do todo. */
  const bySeverity = useMemo(() => countBySeverity(blockers), [blockers]);
  const byKind = useMemo(() => countByKind(blockers), [blockers]);

  const filtered = useMemo(
    () =>
      blockers.filter(
        (blocker) =>
          (severity === null || blocker.severity === severity) &&
          (kind === null || blocker.kind === kind),
      ),
    [blockers, severity, kind],
  );

  const filtering = severity !== null || kind !== null;

  const note = filtering
    ? `Mostrando ${filtered.length} de ${blockers.length} impedimentos: ${[
        severity ? SEVERITY_META[severity].label.toLowerCase() : null,
        kind ? KIND_META[kind].label.toLowerCase() : null,
      ]
        .filter(Boolean)
        .join(' · ')}.`
    : `Todos os ${blockers.length} impedimentos abertos, do que trava a saída agora ao que ainda não dá para afirmar.`;

  return (
    <>
      <HeroBand
        title="Impedimentos"
        description="O que trava a saída hoje. A fila começa pelo que precisa ser consertado primeiro, e os cards e os tipos recortam a lista sem mudar essa ordem."
      >
        <HeroPill icon={WarningIcon}>{blockers.length} abertos</HeroPill>
        <HeroLink to={OVERVIEW_PATH} icon={ArrowLeftIcon}>
          Voltar à visão geral
        </HeroLink>
      </HeroBand>

      <PageContent>
        <QueryState isPending={isPending} isError={isError} label="a fila de impedimentos">
          {data ? (
            <>
              {/* A subida fica aqui, e não em volta do `QueryState`, senão o
                  carregamento e o erro apareceriam por cima da faixa colorida. */}
              <div className="-mt-16 sm:-mt-20">
                <SeverityCards counts={bySeverity} selected={severity} onSelect={setSeverity} />
              </div>

              <h3 className="text-on-surface-variant text-label-md mt-8 normal-case">
                Por tipo de impedimento
              </h3>
              <div className="mt-3">
                <KindFilters counts={byKind} selected={kind} onSelect={setKind} />
              </div>

              <div className="mt-8">
                <BlockerQueue
                  blockers={filtered}
                  note={note}
                  emptyMessage="Nenhum impedimento neste recorte."
                  action={
                    filtering ? (
                      <SpectrumButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSeverity(null);
                          setKind(null);
                        }}
                      >
                        Limpar filtro
                      </SpectrumButton>
                    ) : null
                  }
                />
              </div>
            </>
          ) : null}
        </QueryState>
      </PageContent>
    </>
  );
}
