import { ClockIcon, RouteIcon, WarningIcon, MaintenanceIcon } from '@/components/icons';
import type { MechanicalAlert } from '@/management/lib/fleet-api';
import { GlassCard, cn } from '@/management/ui';
import { useMemo, useState } from 'react';

/**
 * O que a rede CAN acusou de mecânico, por veículo.
 *
 * <h2>Por que este cartão existe</h2>
 *
 * A tela de Manutenção inteira era um aviso de origem ausente, e isso estava
 * certo pela metade: ordem de serviço, oficina e plano preventivo de fato não
 * existem no sistema. Mas o rastreador acusa problema mecânico o tempo todo, e
 * ninguém estava olhando: **22.307 ocorrências em 30 dias, em 33 veículos**,
 * medido em 06/09/2026.
 *
 * <h2>⚠️ Contagem, e não diagnóstico</h2>
 *
 * O evento diz que o sensor disparou, e não que a peça está ruim. É a diferença
 * entre "este caminhão acusou pressão baixa de óleo 4.170 vezes" e "este
 * caminhão está com problema no motor". A primeira é o que temos; a segunda é
 * conclusão de quem entende, com o veículo na frente.
 *
 * A tela precisa dizer isso, e por isso a ressalva está escrita no cabeçalho do
 * cartão, e não escondida num rodapé.
 *
 * <h2>O que a frota gera hoje</h2>
 *
 * Quatro tipos, e só quatro: pressão baixa do óleo (Euro 5 e Euro 6), temperatura
 * alta do motor e carga baixa da bateria. Os dois primeiros somam 84% de tudo.
 */

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const data = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

/** Quantos veículos aparecem antes de "ver todos". */
const VISIVEIS = 8;

export interface MechanicalAlertsCardProps {
  alerts: MechanicalAlert[];
  periodLabel: string;
  className?: string | undefined;
}

interface PorVeiculo {
  vehicleId: string;
  plate: string;
  model?: string | undefined;
  total: number;
  ultimo: string;
  odometro?: number | undefined;
  tipos: MechanicalAlert[];
}

export function MechanicalAlertsCard({
  alerts,
  periodLabel,
  className,
}: MechanicalAlertsCardProps) {
  const [expandido, setExpandido] = useState(false);

  const { veiculos, porTipo, total } = useMemo(() => {
    /*
     * A resposta vem por veículo E tipo, que é a granularidade certa para a
     * oficina. A tela agrupa por veículo porque a pergunta de quem lê é "qual
     * caminhão levar", e não "qual sensor dispara mais".
     */
    const mapa = new Map<string, PorVeiculo>();
    const tipos = new Map<string, number>();

    for (const alerta of alerts) {
      tipos.set(alerta.description, (tipos.get(alerta.description) ?? 0) + alerta.occurrences);

      const atual = mapa.get(alerta.vehicleId);
      if (!atual) {
        mapa.set(alerta.vehicleId, {
          vehicleId: alerta.vehicleId,
          plate: alerta.plate,
          model: alerta.model,
          total: alerta.occurrences,
          ultimo: alerta.lastAt,
          odometro: alerta.lastOdometerKm,
          tipos: [alerta],
        });
        continue;
      }

      atual.total += alerta.occurrences;
      atual.tipos.push(alerta);
      /* A data e o odômetro são os da ocorrência MAIS RECENTE entre os tipos. */
      if (alerta.lastAt > atual.ultimo) {
        atual.ultimo = alerta.lastAt;
        atual.odometro = alerta.lastOdometerKm;
      }
    }

    return {
      veiculos: [...mapa.values()].sort((a, b) => b.total - a.total),
      porTipo: [...tipos.entries()].sort((a, b) => b[1] - a[1]),
      total: alerts.reduce((soma, a) => soma + a.occurrences, 0),
    };
  }, [alerts]);

  if (veiculos.length === 0) return null;

  const mostrados = expandido ? veiculos : veiculos.slice(0, VISIVEIS);

  return (
    <GlassCard className={cn('flex flex-col p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-on-surface text-body-md font-semibold">
            O que o rastreador está acusando
          </h3>
          {/*
            ⚠️ A ressalva vem no cabeçalho, e não num rodapé: quem lê "4.170
            ocorrências de pressão baixa de óleo" já formou opinião antes de
            chegar ao fim do cartão. Ver o cabeçalho do arquivo.
          */}
          <p className="text-on-surface-muted text-label-md mt-1 normal-case">
            {inteiro.format(total)} alertas da rede CAN em {veiculos.length} veículos, {periodLabel}
            . É o que o sensor disparou, e não um diagnóstico.
          </p>
        </div>
        <span className="bg-warning/12 text-warning flex size-9 items-center justify-center rounded-lg">
          <MaintenanceIcon size={18} aria-hidden="true" />
        </span>
      </div>

      {/* Os tipos que a frota gera, para dar a dimensão antes das placas. */}
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tipos de alerta">
        {porTipo.map(([descricao, quantidade]) => (
          <li
            key={descricao}
            className="bg-surface-lowest border-outline-variant text-on-surface-variant text-label-md rounded-pill flex items-center gap-2 border px-3 py-1.5 normal-case"
          >
            {descricao}
            <span className="tabular text-on-surface font-semibold">
              {inteiro.format(quantidade)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-outline-variant mt-5 border-t pt-4">
        <h4 className="text-on-surface-muted text-[11px] font-medium uppercase tracking-wide">
          Por veículo
        </h4>
      </div>

      <ul className="mt-3 flex flex-col gap-3" aria-label="Alertas por veículo">
        {mostrados.map((veiculo) => (
          <li key={veiculo.vehicleId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="tabular text-on-surface font-semibold">{veiculo.plate}</span>
                {veiculo.model ? (
                  <span className="text-on-surface-muted text-label-md truncate normal-case">
                    {veiculo.model}
                  </span>
                ) : null}
              </span>
              <span className="tabular text-on-surface shrink-0 text-sm font-semibold">
                {inteiro.format(veiculo.total)}
              </span>
            </div>

            <div className="text-on-surface-muted text-label-md flex flex-wrap items-center gap-x-3 gap-y-1 normal-case">
              <span className="flex items-center gap-1.5">
                <WarningIcon size={13} className="shrink-0" aria-hidden="true" />
                {veiculo.tipos.map((t) => t.description).join(', ')}
              </span>
              <span className="flex items-center gap-1.5">
                <ClockIcon size={13} className="shrink-0" aria-hidden="true" />
                último em {data.format(new Date(veiculo.ultimo))}
              </span>
              {/* O odômetro responde a pergunta que a data não responde: em que
                  quilometragem o alerta apareceu. */}
              {veiculo.odometro != null ? (
                <span className="flex items-center gap-1.5">
                  <RouteIcon size={13} className="shrink-0" aria-hidden="true" />
                  {inteiro.format(veiculo.odometro)} km
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {veiculos.length > VISIVEIS ? (
        <button
          type="button"
          onClick={() => setExpandido((valor) => !valor)}
          className="text-label-md text-primary-strong focus-visible:ring-primary mt-4 self-start rounded normal-case transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
        >
          {expandido ? 'Mostrar menos' : `Ver os outros ${veiculos.length - VISIVEIS} veículos`}
        </button>
      ) : null}
    </GlassCard>
  );
}
