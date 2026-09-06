import { FuelIcon, GaugeIcon, RouteIcon, WarningIcon } from '@/components/icons';
import type { VehiclePerformance } from '@/management/lib/fleet-api';
import { GlassCard, cn } from '@/management/ui';
import { useMemo } from 'react';

/**
 * O que a telemetria já mede na tela de Custos.
 *
 * <h2>Por que este cartão existe</h2>
 *
 * A tela de Custos inteira era um aviso de origem ausente, e isso estava certo
 * pela metade: o custo em REAIS depende de preço do diesel, nota da oficina e
 * valor da multa, que ninguém lança no sistema. Mas o consumo em quilômetro por
 * litro é medido pela rede CAN, existe para 30 dos 35 veículos que rodam, e
 * responde a pergunta que vem antes do dinheiro: quem está bebendo mais.
 *
 * Mostrar o medido ao lado do que falta é diferente de mostrar a tela vazia.
 *
 * <h2>⚠️ Van não se compara com compactador</h2>
 *
 * Medido em produção em 06/09/2026: as vans fazem de 8,7 a 15,3 km/l e os
 * caminhões compactadores de 1,7 a 3,5. Um ranking único premiaria as vans todo
 * mês, e o gestor concluiria que os compactadores estão sendo mal dirigidos.
 *
 * Por isso a lista é AGRUPADA por categoria, e a comparação acontece dentro de
 * cada grupo. Cada um traz a própria média, que é o número contra o qual faz
 * sentido comparar um veículo.
 *
 * ⚠️ A categoria vem do backend como `COALESCE(body_class, type)`: o cadastro
 * da operação primeiro, o palpite do ícone da MiX depois. O palpite erra, e o
 * caso conhecido é a Renault MASTER, que aparece como `van` em cinco placas e
 * `truck` numa sexta, porque alguém escolheu outro ícone no painel do
 * fornecedor. Conferir a ficha do veículo corrige, e desde 06/09/2026 a
 * correção NÃO é mais sobrescrita pela sincronização.
 *
 * <h2>⚠️ Veículo sem medição não é veículo econômico</h2>
 *
 * Cinco veículos não reportam combustível nenhum: três FIAT FIORINO e dois
 * modelos antigos, sem CAN moderno. Eles aparecem no fim da lista, marcados, e
 * NUNCA com zero: zero leria como "não gastou nada", que é o oposto da verdade.
 */

const litro = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Onde caem os veículos sem categoria no cadastro. */
const SEM_CATEGORIA = 'sem-categoria';

/** O rótulo do tipo, com o cru do cadastro como reserva. */
const TIPO: Record<string, string> = {
  van: 'Van',
  truck: 'Caminhão',
  tractor_unit: 'Cavalo',
  trailer: 'Carreta',
  light: 'Leve',
  [SEM_CATEGORIA]: 'Sem categoria',
};

export interface FuelEfficiencyCardProps {
  vehicles: VehiclePerformance[];
  /** Consumo agregado da frota, do indicador operacional. */
  fleetAverage?: number | undefined;
  /** Horas de motor ligado sem o veículo sair do lugar. */
  idleHours?: number | undefined;
  periodLabel: string;
  className?: string | undefined;
}

export function FuelEfficiencyCard({
  vehicles,
  fleetAverage,
  idleHours,
  periodLabel,
  className,
}: FuelEfficiencyCardProps) {
  const { grupos, medidos, semMedicao, kmTotal } = useMemo(() => {
    /* Só entra quem rodou: veículo parado o período inteiro não tem consumo
       para comparar, e ocuparia a lista sem dizer nada. */
    const rodaram = vehicles.filter((v) => (v.distanceKm ?? 0) > 0);
    const comConsumo = rodaram
      .filter((v) => v.fuelEfficiency != null)
      .sort((a, b) => (b.fuelEfficiency ?? 0) - (a.fuelEfficiency ?? 0));

    /*
     * A média de cada grupo é ponderada pela QUILOMETRAGEM, e não a média das
     * médias. Um veículo que rodou 200 km não pode pesar igual a um que rodou
     * 3.000 na média da categoria.
     */
    const porCategoria = new Map<string, VehiclePerformance[]>();
    for (const veiculo of comConsumo) {
      const chave = veiculo.type ?? SEM_CATEGORIA;
      const atual = porCategoria.get(chave);
      if (atual) atual.push(veiculo);
      else porCategoria.set(chave, [veiculo]);
    }

    return {
      grupos: [...porCategoria.entries()]
        .map(([categoria, itens]) => {
          const km = itens.reduce((soma, v) => soma + (v.distanceKm ?? 0), 0);
          const litros = itens.reduce(
            (soma, v) => soma + (v.distanceKm ?? 0) / (v.fuelEfficiency || 1),
            0,
          );
          return { categoria, itens, media: litros > 0 ? km / litros : null };
        })
        /* O grupo maior primeiro: é onde está a operação. */
        .sort((a, b) => b.itens.length - a.itens.length),
      medidos: comConsumo,
      semMedicao: rodaram.filter((v) => v.fuelEfficiency == null),
      kmTotal: rodaram.reduce((soma, v) => soma + (v.distanceKm ?? 0), 0),
    };
  }, [vehicles]);

  if (medidos.length === 0 && semMedicao.length === 0) return null;

  return (
    <GlassCard className={cn('flex flex-col p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-on-surface text-body-md font-semibold">O que a telemetria já mede</h3>
          <p className="text-on-surface-muted text-label-md mt-1 normal-case">
            Consumo medido pela rede CAN, {periodLabel}. Não depende de lançamento nenhum.
          </p>
        </div>
        <span className="bg-primary-strong/12 text-primary-strong flex size-9 items-center justify-center rounded-lg">
          <FuelIcon size={18} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Numero
          icone={FuelIcon}
          rotulo="Consumo da frota"
          valor={fleetAverage != null ? `${litro.format(fleetAverage)} km/l` : null}
          nota={`${medidos.length} de ${medidos.length + semMedicao.length} veículos medem`}
        />
        <Numero
          icone={RouteIcon}
          rotulo="Quilômetros rodados"
          valor={kmTotal > 0 ? `${inteiro.format(kmTotal)} km` : null}
          nota="soma dos trechos do período"
        />
        <Numero
          icone={GaugeIcon}
          rotulo="Motor ligado parado"
          valor={idleHours != null ? `${inteiro.format(idleHours)} h` : null}
          nota="diesel queimado sem sair do lugar"
        />
      </div>

      {medidos.length > 0 ? (
        <>
          <div className="border-outline-variant mt-5 border-t pt-4">
            <h4 className="text-on-surface-muted text-[11px] font-medium uppercase tracking-wide">
              Consumo por veículo
            </h4>
            {/*
              ⚠️ A ressalva vem ANTES da lista, e não depois: quem lê um ranking
              já formou opinião na primeira linha. Ver o cabeçalho do arquivo.
            */}
            <p className="text-on-surface-muted text-label-md mt-1 normal-case">
              Agrupado por categoria, porque van e caminhão não se comparam entre si.
            </p>
          </div>

          {grupos.map((grupo) => (
            <section key={grupo.categoria} className="mt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h5 className="text-on-surface text-label-md font-semibold normal-case">
                  {TIPO[grupo.categoria] ?? grupo.categoria}
                  <span className="text-on-surface-muted font-normal">
                    {' · '}
                    {grupo.itens.length}
                    {grupo.itens.length === 1 ? ' veículo' : ' veículos'}
                  </span>
                </h5>
                {/* A média do grupo é a régua: é contra ela que se compara. */}
                {grupo.media != null ? (
                  <span className="text-on-surface-muted text-label-md shrink-0 normal-case">
                    média {litro.format(grupo.media)} km/l
                  </span>
                ) : null}
              </div>

              <ul
                className="mt-2 flex flex-col gap-1.5"
                aria-label={`Consumo de ${TIPO[grupo.categoria] ?? grupo.categoria}`}
              >
                {grupo.itens.map((veiculo) => (
                  <Linha key={veiculo.vehicleId} veiculo={veiculo} media={grupo.media} />
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : null}

      {semMedicao.length > 0 ? (
        <div className="border-outline-variant mt-4 border-t pt-4">
          <p className="text-on-surface-variant text-label-md flex items-start gap-2 normal-case">
            <WarningIcon size={15} className="text-warning mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {semMedicao.length === 1
                ? '1 veículo rodou sem informar combustível'
                : `${semMedicao.length} veículos rodaram sem informar combustível`}
              {': '}
              {semMedicao.map((v) => v.plate).join(', ')}. O rastreador deles não lê a rede CAN, e
              por isso ficam de fora da média em vez de entrar como zero.
            </span>
          </p>
        </div>
      ) : null}
    </GlassCard>
  );
}

/** Um número grande com rótulo e procedência. */
function Numero({
  icone: Icone,
  rotulo,
  valor,
  nota,
}: {
  icone: typeof FuelIcon;
  rotulo: string;
  valor: string | null;
  nota: string;
}) {
  return (
    <div className="bg-surface-lowest border-outline-variant rounded-xl border p-4">
      <p className="text-on-surface-variant text-label-md flex items-center gap-2 normal-case">
        <Icone size={14} className="text-on-surface-muted shrink-0" aria-hidden="true" />
        {rotulo}
      </p>
      {/* Sem dado a linha diz que não há leitura, e nunca zero. */}
      <p className="tabular font-sora text-on-surface mt-1.5 text-[26px] font-bold leading-none">
        {valor ?? <span className="text-on-surface-muted text-[18px]">sem leitura</span>}
      </p>
      <p className="text-on-surface-muted text-label-md mt-1.5 normal-case">{nota}</p>
    </div>
  );
}

function Linha({
  veiculo,
  media,
}: {
  veiculo: VehiclePerformance;
  media?: number | null | undefined;
}) {
  /*
   * ⚠️ Dez por cento é o corte para destacar, e não qualquer diferença.
   *
   * Marcar tudo que está abaixo da média marcaria metade da lista por definição,
   * e o destaque perderia o sentido. Dez por cento separa quem está de fato fora
   * do padrão do grupo de quem está no meio dele.
   */
  const consumo = veiculo.fuelEfficiency ?? 0;
  const abaixo = media != null && consumo < media * 0.9;

  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="tabular text-on-surface font-semibold">{veiculo.plate}</span>
        <span className="text-on-surface-muted text-label-md truncate normal-case">
          {inteiro.format(veiculo.distanceKm ?? 0)} km
        </span>
      </span>
      <span
        className={cn(
          'tabular shrink-0 font-semibold',
          abaixo ? 'text-warning' : 'text-on-surface',
        )}
      >
        {litro.format(consumo)} km/l
      </span>
    </li>
  );
}
