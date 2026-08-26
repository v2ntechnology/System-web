import { ClockIcon, InfoIcon, WarningIcon } from '@/components/icons';
import { StatusChip, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';

import { getDriverHours } from '../api';

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
 */

/** Cinco horas e meia, o limite de condução ininterrupta da Lei 13.103/2015. */
const LIMITE_CONTINUO = 5.5 * 3600;

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

export function DriverHoursCard({ className }: { className?: string | undefined }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['driver-hours'],
    queryFn: () => getDriverHours(24),
    /* A jornada anda enquanto o caminhão anda. Um minuto de defasagem é o
       bastante para a lista continuar acionável sem martelar o backend. */
    refetchInterval: 60_000,
  });

  const linhas = data ?? [];
  const comViolacao = linhas.filter((d) => d.violations.length > 0);

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-on-surface-variant text-body-md flex items-center gap-2">
          <ClockIcon size={16} aria-hidden="true" />
          Jornada nas últimas 24 horas
        </h3>
        {comViolacao.length > 0 ? (
          <StatusChip tone="critical">{comViolacao.length} acima do limite</StatusChip>
        ) : null}
      </div>

      {isPending ? (
        <p className="text-on-surface-muted text-body-md py-6 text-center">Apurando a jornada…</p>
      ) : isError ? (
        <p className="text-error text-body-md py-6 text-center">
          Não foi possível apurar a jornada.
        </p>
      ) : linhas.length === 0 ? (
        <p className="text-on-surface-muted text-body-md py-6 text-center">
          Nenhum trecho com motorista identificado nas últimas 24 horas.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {linhas.slice(0, 8).map((linha) => {
            const excedeu = linha.longestStretchSeconds > LIMITE_CONTINUO;
            /* A barra mede o bloco contínuo, não o total do dia: é o bloco que
               determina a parada obrigatória. Passar de 100% é possível e é
               justamente o que precisa saltar aos olhos. */
            const proporcao = Math.min(
              100,
              Math.round((linha.longestStretchSeconds / LIMITE_CONTINUO) * 100),
            );

            return (
              <li key={linha.driverId} className="bg-on-surface/4 min-w-0 rounded-lg px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-on-surface min-w-0 truncate font-medium">{linha.name}</span>
                  <span className="tabular text-on-surface-muted text-label-md normal-case">
                    {linha.plate} · {linha.journeys} trechos
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2.5">
                  <div className="bg-on-surface/10 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
                    <div
                      className={cn('h-full rounded-full', excedeu ? 'bg-error' : 'bg-success')}
                      style={{ width: `${proporcao}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'tabular text-label-md shrink-0 normal-case',
                      excedeu ? 'text-error' : 'text-on-surface-variant',
                    )}
                  >
                    {horas(linha.longestStretchSeconds)} contínuas
                  </span>
                </div>

                <p className="text-on-surface-muted text-label-md mt-1.5 normal-case">
                  {horas(linha.drivingSeconds)} ao volante · maior pausa{' '}
                  {horas(linha.longestBreakSeconds)}
                </p>

                {linha.violations.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {linha.violations.map((regra) => {
                      const info = REGRA[regra];
                      if (!info) return null;
                      return (
                        <StatusChip key={regra} tone={info.tom}>
                          {info.rotulo}
                        </StatusChip>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-4 normal-case">
        <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Apurado pela telemetria, com o condutor identificado no rastreador. Não substitui o
        tacógrafo nem o controle de ponto.
      </p>

      {comViolacao.length > 0 ? (
        <p className="text-warning text-label-md mt-2 flex items-start gap-1.5 normal-case">
          <WarningIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />A Lei 13.103/2015
          exige 30 minutos de pausa a cada 5h30 de condução.
        </p>
      ) : null}
    </div>
  );
}
