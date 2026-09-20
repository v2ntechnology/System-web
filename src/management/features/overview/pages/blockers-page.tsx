import {
  ArrowLeftIcon,
  BlockedIcon,
  ClockCountdownIcon,
  EyeOffIcon,
  WarningIcon,
  type IconType,
} from '@/components/icons';
import { SpectrumButton } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';

import { getFleetOverview } from '../api';
import {
  KIND_META,
  SEVERITY_META,
  SEVERITY_ORDER,
  countByKind,
  countBySeverity,
} from '../blockers';
import { BlockerQueue } from '../components/blocker-queue';
import { HeroBand, HeroLink, HeroPill } from '@/management/components/layout/hero-band';
import { HeroStats } from '@/management/components/layout/hero-stats';
import { KindFilters } from '../components/kind-filters';
import { OVERVIEW_PATH } from '../paths';
import type { BlockerKind, BlockerSeverity } from '../types';

/** O ícone de cada degrau, herdado do `severity-cards.tsx` que saiu daqui. */
const SEVERITY_ICON: Record<BlockerSeverity, IconType> = {
  BLOQUEIA_AGORA: BlockedIcon,
  BLOQUEIA_EM_BREVE: ClockCountdownIcon,
  SEM_VISIBILIDADE: EyeOffIcon,
};

/**
 * O tom de cada degrau no `HeroStats`.
 *
 * ⚠️ `SEM_VISIBILIDADE` é `neutral`, e não um terceiro alarme: falta de
 * informação não é gravidade, é ausência dela. Pintá-la de âmbar colocaria no
 * mesmo degrau o caminhão que vai travar amanhã e o que ninguém sabe se trava.
 */
const SEVERITY_TONE: Record<BlockerSeverity, 'neutral' | 'warn' | 'alert'> = {
  BLOQUEIA_AGORA: 'alert',
  BLOQUEIA_EM_BREVE: 'warn',
  SEM_VISIBILIDADE: 'neutral',
};

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

      {/*
       * ⚠️ **Os cards entraram no painel branco em 19/09/2026** (pedido do
       * usuário), e com eles o painel passou a subir (`-mt-16`) para morder a
       * faixa, que é o molde das outras telas do par: liberações, pareceres e
       * viagens fazem exatamente isto.
       *
       * Antes eles ficavam entre a faixa e o painel, flutuando sobre o papel.
       * ⚠️ E não era só aparência: `SeverityCards`, `BlockerQueue` e `BlockerRow`
       * escrevem nos tokens `on-light`, ou seja, sempre foram feitos PARA o
       * painel branco.
       */}
      <PageContent className="rounded-t-4xl bg-light -mt-16 pt-8 sm:-mt-20 sm:rounded-t-[40px]">
        <QueryState isPending={isPending} isError={isError} label="a fila de impedimentos">
          {data ? (
            <>
              <h2 className="sr-only">Impedimentos por severidade</h2>

              {/*
               * ⚠️ **É o `HeroStats`, e não mais o `SeverityCards`.** Os dois
               * eram o mesmo cartão escrito duas vezes, com a mesma anatomia
               * (ícone em pastilha, rótulo, número grande, dica) e a mesma
               * seleção por anel; o que o `SeverityCards` tinha a mais era o
               * mapa de cor por severidade, que os três tons do `HeroStats` já
               * cobrem. Manter os dois significava encolher um e esquecer o
               * outro, que foi exatamente o que aconteceu aqui.
               *
               * O arquivo `severity-cards.tsx` continua no repositório, sem uso,
               * para a volta ser barata.
               */}
              <HeroStats
                items={SEVERITY_ORDER.map((nivel) => ({
                  key: nivel,
                  label: SEVERITY_META[nivel].label,
                  value: bySeverity[nivel],
                  hint: SEVERITY_META[nivel].hint,
                  icon: SEVERITY_ICON[nivel],
                  tone: SEVERITY_TONE[nivel],
                  onSelect: () => setSeverity(severity === nivel ? null : nivel),
                  selected: severity === nivel,
                }))}
              />

              <h3 className="text-on-light-variant text-label-md mt-8 normal-case">
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
