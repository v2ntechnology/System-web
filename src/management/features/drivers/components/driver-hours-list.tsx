import { InfoIcon, WarningIcon } from '@/components/icons';
import { Pagination, StatusChip, cn } from '@/management/ui';
import { useMemo, useState } from 'react';

import type { DriverHours } from '../api';
import { countViolations } from '../hours';

/**
 * Quem está passando do limite de jornada agora.
 *
 * ⚠️ **Indicador de risco, não ponto eletrônico.** Mede o veículo andando com
 * aquele condutor identificado, e nada mais. Quem dirige sem se identificar não
 * aparece aqui, e o número não substitui o tacógrafo em fiscalização. O aviso
 * fica escrito na própria tela: um gestor que tratar isto como prova legal vai
 * se dar mal, e a culpa seria de quem escondeu a limitação.
 *
 * A ordem é a do risco, não a alfabética: quem está mais perto do limite vem
 * primeiro, porque a lista existe para alguém ligar para essas pessoas hoje.
 *
 * <h2>⚠️ Aba do painel, e não cartão empilhado no papel (08/09/2026)</h2>
 *
 * Era um `GlassCard` entre os números da faixa e a lista de motoristas, com oito
 * linhas de altura. Duas coisas quebravam ali. A tela promete "a ficha de cada
 * motorista" e entregava primeiro um plantão de jornada, empurrando a lista de
 * verdade para fora da primeira tela. E o aviso de "requerem atenção", logo
 * acima, disparava um segundo alarme de outro eixo, roubando a urgência deste.
 *
 * Agora é uma aba, que é o objeto que a página já usa para "que fatia da equipe
 * eu olho agora". Daí os tokens `on-light`: a lista mora dentro do painel
 * branco, e a família `on-surface` do cartão antigo sumiria ali.
 */

/** Cinco horas e meia, o limite de condução ininterrupta da Lei 13.103/2015. */
const LIMITE_CONTINUO = 5.5 * 3600;

/** Quantos motoristas cabem numa página da aba. */
const POR_PAGINA = 10;

const REGRA: Record<string, { rotulo: string; tom: 'critical' | 'attention' }> = {
  CONDUCAO_CONTINUA: { rotulo: 'Passou de 5h30 sem pausa', tom: 'critical' },
  JORNADA_DIARIA: { rotulo: 'Passou de 10h ao volante', tom: 'critical' },
  PRORROGACAO: { rotulo: 'Em prorrogação (8h a 10h)', tom: 'attention' },
};

/** 20520 vira "5h42". Minuto importa quando o limite é 5h30. */
function horas(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function DriverHoursList({
  rows,
  className,
}: {
  rows: DriverHours[];
  className?: string | undefined;
}) {
  const [pagina, setPagina] = useState(1);

  /* A página é presa ao total durante o render, e não corrigida por efeito: a
     jornada é reconsultada a cada minuto, e uma lista que encolhe deixaria a
     página em pé apontando para o vazio. */
  const totalPaginas = Math.max(1, Math.ceil(rows.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);

  const daPagina = useMemo(
    () => rows.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [rows, paginaAtual],
  );

  const comViolacao = countViolations(rows);

  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">
          Jornada nas últimas 24 horas
        </h2>
        {comViolacao > 0 ? (
          <StatusChip tone="critical" surface="light">
            {comViolacao} acima do limite
          </StatusChip>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-10 text-center">
          Nenhum trecho com motorista identificado nas últimas 24 horas.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {daPagina.map((linha) => {
            const excedeu = linha.longestStretchSeconds > LIMITE_CONTINUO;
            /* A barra mede o bloco contínuo, não o total do dia: é o bloco que
               determina a parada obrigatória. Passar de 100% é possível e é
               justamente o que precisa saltar aos olhos. */
            const proporcao = Math.min(
              100,
              Math.round((linha.longestStretchSeconds / LIMITE_CONTINUO) * 100),
            );

            return (
              <li key={linha.driverId} className="bg-light-container min-w-0 rounded-lg px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-on-light min-w-0 truncate font-medium">{linha.name}</span>
                  <span className="tabular text-on-light-muted text-label-md normal-case">
                    {linha.plate} · {linha.journeys} trechos
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2.5">
                  <div className="bg-on-light/10 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        excedeu ? 'bg-error-on-light' : 'bg-success-on-light',
                      )}
                      style={{ width: `${proporcao}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'tabular text-label-md shrink-0 normal-case',
                      excedeu ? 'text-error-on-light' : 'text-on-light-variant',
                    )}
                  >
                    {horas(linha.longestStretchSeconds)} contínuas
                  </span>
                </div>

                <p className="text-on-light-muted text-label-md mt-1.5 normal-case">
                  {horas(linha.drivingSeconds)} ao volante · maior pausa{' '}
                  {horas(linha.longestBreakSeconds)}
                </p>

                {linha.violations.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {linha.violations.map((regra) => {
                      const info = REGRA[regra];
                      if (!info) return null;
                      return (
                        <StatusChip key={regra} tone={info.tom} surface="light">
                          {info.rotulo}
                        </StatusChip>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <Pagination
        className="mt-6"
        page={paginaAtual}
        total={rows.length}
        pageSize={POR_PAGINA}
        onPageChange={setPagina}
        label="motoristas"
      />

      <p className="text-on-light-muted text-label-md mt-auto flex items-start gap-1.5 pt-4 normal-case">
        <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Apurado pela telemetria, com o condutor identificado no rastreador. Não substitui o
        tacógrafo nem o controle de ponto.
      </p>

      {comViolacao > 0 ? (
        <p className="text-warning-on-light text-label-md mt-2 flex items-start gap-1.5 normal-case">
          <WarningIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />A Lei 13.103/2015
          exige 30 minutos de pausa a cada 5h30 de condução.
        </p>
      ) : null}
    </section>
  );
}
