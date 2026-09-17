import {
  CircleIcon,
  DropletIcon,
  FuelIcon,
  GaugeIcon,
  RadarIcon,
  RouteIcon,
  type IconType,
} from '@/components/icons';
import type { CSSProperties, ReactNode } from 'react';

import { km } from '@/management/lib/format';
import { cn } from '@/management/ui';

/** Uma casa decimal, com vírgula: `toFixed` escreveria "3.2", que é inglês. */
const umaCasa = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Bloco da ficha do veículo.
 *
 * A moldura é uma só para os nove blocos: dentro do painel branco, cartão é
 * traço mais respiro, e não uma segunda superfície. Ver `Molde de tela` na
 * memória, que proíbe cartão dentro de cartão.
 */
export function VehicleCard({
  title,
  icon: Icon,
  hint,
  action,
  className,
  style,
  children,
}: {
  title: string;
  icon: IconType;
  hint?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
  /** Só para o fundo calculado do `MetricCard`, que sai de `color-mix`. */
  style?: CSSProperties | undefined;
  children: ReactNode;
}) {
  return (
    <section
      style={style}
      className={cn(
        'border-light-outline bg-light flex flex-col rounded-2xl border p-5',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-on-light text-body-md flex items-center gap-2 font-semibold">
            {/* Marinho no detalhe: ícone que só marca não usa a cor de ação. */}
            <Icon size={17} className="text-accent shrink-0" aria-hidden="true" />
            {title}
          </h3>
          {hint ? (
            <p className="text-on-light-muted text-label-sm mt-1 normal-case">{hint}</p>
          ) : null}
        </div>
        {action}
      </header>

      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/**
 * O molde dos blocos de medida.
 *
 * <h2>⚠️ Ele nasceu do bloco de Eficiência da rota</h2>
 *
 * Aquele cartão ganhou um desenho próprio (fundo pêssego, número gigante em
 * marinho, selo redondo terracota e um rodapé com a leitura em palavras), e o
 * usuário pediu para repetir nos demais em 16/09/2026. Repetir À MÃO em cinco
 * lugares é o caminho para eles divergirem na primeira alteração: o desenho mora
 * aqui, e os blocos só dizem o que têm dentro.
 *
 * ⚠️ **As cores saem de `palette.css`, e não dos hexes que o desenho trazia.**
 * O pêssego é a terracota a 5% sobre o branco, e o texto grande é o marinho
 * (`--accent`). Escritos literais, os dois deixariam de acompanhar o tema e a
 * marca, que é exatamente o que o projeto proíbe.
 */
export function MetricCard({
  title,
  hint,
  icon,
  label,
  value,
  unit,
  children,
  footerLeft,
  footerRight,
}: {
  title: string;
  hint?: string | undefined;
  icon: IconType;
  /** O rótulo miúdo acima do número. */
  label: string;
  value: ReactNode;
  unit?: string | undefined;
  /** O visual do meio: barras, linha, medidor. */
  children?: ReactNode | undefined;
  footerLeft?: ReactNode | undefined;
  footerRight?: ReactNode | undefined;
}) {
  const Icon = icon;

  return (
    <VehicleCard
      title={title}
      icon={icon}
      hint={hint}
      className="border-primary-on-light/20 shadow-[0_12px_28px_color-mix(in_srgb,var(--color-primary-on-light)_10%,transparent)]"
      style={{
        background: 'color-mix(in srgb, var(--color-primary-on-light) 5%, var(--color-light))',
      }}
    >
      <div className="flex h-full min-h-40 flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-accent text-label-sm normal-case">{label}</p>
            <p className="text-accent font-sora tabular text-[44px] font-bold leading-none tracking-[-0.05em]">
              {value}
              {unit ? <span className="ml-0.5 text-[22px] font-medium">{unit}</span> : null}
            </p>
          </div>
          {/* Selo terracota: a cor de ação marca o assunto do bloco sem competir
              com o número, que é marinho. */}
          <span
            aria-hidden="true"
            className="bg-primary-on-light/10 text-primary-on-light flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <Icon size={16} />
          </span>
        </div>

        {children}

        {footerLeft || footerRight ? (
          <div className="border-accent/10 flex items-end justify-between gap-3 border-t pt-3">
            <div className="text-accent text-label-sm max-w-40 normal-case">{footerLeft}</div>
            <div className="text-on-light-muted text-label-sm text-right normal-case">
              {footerRight}
            </div>
          </div>
        ) : null}
      </div>
    </VehicleCard>
  );
}

/**
 * O que a telemetria ainda não manda.
 *
 * <h2>⚠️ Por que isto existe em vez de um número bonito</h2>
 *
 * Cinco dos nove blocos desta ficha dependem de sinal que a MiX não envia nesta
 * frota: consumo, nível de tanque, posição do acelerador, eficiência de rota e
 * pressão de pneu. Preencher com valor de exemplo é o erro que o produto já
 * decidiu não cometer: **um número real ao lado de três inventados é pior que
 * uma tela faltando**, porque empresta credibilidade ao conjunto e ninguém
 * consegue distinguir depois qual era qual.
 *
 * Então o bloco existe, ocupa o lugar dele no layout e DIZ o que falta e de onde
 * viria. No dia em que o sinal chegar, troca-se este corpo pelo gráfico.
 */
export function PendingSource({
  children,
  origem,
}: {
  /** O desenho do que vai aparecer aqui, sem nenhum valor. */
  children: ReactNode;
  /** Uma frase dizendo de onde o dado viria. */
  origem: string;
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div
        aria-hidden="true"
        className="border-light-outline bg-light-container/60 flex min-h-28 flex-1 items-end justify-center rounded-xl border border-dashed p-3"
      >
        {children}
      </div>
      <p className="text-on-light-muted text-label-sm flex items-start gap-2 normal-case">
        <RadarIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Sem origem ligada.</strong> {origem}
        </span>
      </p>
    </div>
  );
}

/** Barras cegas: mostram a FORMA do gráfico, e nenhum valor. */
function BlindBars({ bars = 26 }: { bars?: number }) {
  return (
    <div className="flex h-full w-full items-end gap-[3px]">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="bg-on-light/8 flex-1 rounded-sm"
          /* Alturas fixas e sem significado: é padrão de placeholder, e por isso
             elas se repetem em ciclo em vez de simular uma medição. */
          style={{ height: `${30 + ((i * 17) % 55)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Eficiência de combustível.
 *
 * ⚠️ `fuelEfficiency` volta NULO nesta frota, e `consumo` já aparece como traço
 * na ficha antiga com o texto "rastreador não informa consumo". O gráfico de
 * barras da referência precisa de litro por trecho, que é o que falta.
 */
export function FuelEfficiencyCard({
  porTrecho,
  media,
}: {
  porTrecho?: number[] | undefined;
  media?: number | undefined;
}) {
  if (!porTrecho || porTrecho.length === 0 || media == null) {
    return (
      <VehicleCard
        title="Eficiência de combustível"
        icon={FuelIcon}
        hint="Consumo por trecho, com a média do período"
      >
        <PendingSource origem="Depende de litro consumido por trecho, que a MiX não envia nesta frota. Entra com abastecimento lançado no sistema ou com o sinal de consumo do rastreador.">
          <BlindBars />
        </PendingSource>
      </VehicleCard>
    );
  }

  const teto = Math.max(...porTrecho);
  const pior = Math.min(...porTrecho);
  const abaixo = porTrecho.filter((valor) => valor < media).length;

  return (
    <MetricCard
      title="Eficiência de combustível"
      hint="Consumo por trecho, com a média do período"
      icon={FuelIcon}
      label="Média do período"
      value={umaCasa.format(media)}
      unit="km/l"
      footerLeft={`${abaixo} de ${porTrecho.length} trechos abaixo da média`}
      footerRight={
        <>
          melhor {umaCasa.format(teto)} km/l
          <br />
          pior {umaCasa.format(pior)} km/l
        </>
      }
    >
      {/*
       * Barras proporcionais ao MAIOR trecho, e não a um teto fixo: com teto
       * fixo, uma frota econômica desenharia barras rasteiras e pareceria
       * defeito. A tracejada é a média, que é o que se compara de relance.
       */}
      <div className="relative flex h-16 items-end gap-[3px]">
        {porTrecho.map((valor, indice) => (
          <span
            key={indice}
            title={`${umaCasa.format(valor)} km/l`}
            className={cn(
              'flex-1 rounded-sm',
              /* Abaixo da média em terracota: é o trecho que pede atenção. */
              valor < media ? 'bg-primary-on-light/70' : 'bg-accent/20',
            )}
            style={{ height: `${Math.max(8, (valor / teto) * 100)}%` }}
          />
        ))}
        <span
          aria-hidden="true"
          className="border-accent/25 pointer-events-none absolute inset-x-0 border-t border-dashed"
          style={{ bottom: `${(media / teto) * 100}%` }}
        />
      </div>
    </MetricCard>
  );
}

/** Nível do tanque. ⚠️ Não existe campo de nível em nenhuma rota da API hoje. */
export function FuelTankCard({
  tanque,
}: {
  tanque?: { percent: number; litres: number; capacity: number; rangeKm: number } | undefined;
}) {
  if (!tanque) {
    return (
      <VehicleCard title="Tanque" icon={DropletIcon} hint="Quanto resta agora">
        <PendingSource origem="Nível de tanque não existe no contrato da API nem no que o rastreador manda hoje.">
          <div className="flex h-full w-full items-end justify-center">
            <div className="border-light-outline relative h-full w-16 overflow-hidden rounded-lg border">
              <div className="bg-on-light/8 absolute inset-x-0 bottom-0 h-1/3" />
            </div>
          </div>
        </PendingSource>
      </VehicleCard>
    );
  }

  const reserva = tanque.percent <= 20;

  return (
    <MetricCard
      title="Tanque"
      hint="Quanto resta agora"
      icon={DropletIcon}
      label="Nível atual"
      value={tanque.percent}
      unit="%"
      footerLeft={
        reserva ? 'Na reserva, abastecer antes de sair' : 'Nível suficiente para o próximo trecho'
      }
      footerRight={
        <>
          {km.format(tanque.litres)} de {km.format(tanque.capacity)} litros
          <br />
          autonomia de {km.format(tanque.rangeKm)} km
        </>
      }
    >
      {/* Barra deitada, e não o desenho do tanque: deitada ela mede o mesmo e
          alinha com as barras dos outros blocos. */}
      <div className="bg-accent/10 h-4 w-full overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full', reserva ? 'bg-error/70' : 'bg-accent/60')}
          style={{ width: `${tanque.percent}%` }}
        />
      </div>
    </MetricCard>
  );
}

/**
 * Acelerador.
 *
 * ⚠️ O banco guarda `max_rpm` POR JORNADA, e isso não é posição de acelerador:
 * é o pico de giro de uma viagem inteira, que não se lê como ponteiro ao vivo.
 */
export function ThrottleCard({
  acelerador,
}: {
  acelerador?: { percent: number; speedKmh: number; rpm: number } | undefined;
}) {
  if (!acelerador) {
    return (
      <VehicleCard title="Acelerador" icon={GaugeIcon} hint="Posição do pedal agora">
        <PendingSource origem="O que a telemetria guarda é o RPM máximo de cada jornada, e não a posição do pedal instante a instante.">
          <div className="flex h-full w-full items-center justify-center">
            <div className="border-on-light/10 h-20 w-20 rounded-full border-8 border-dashed" />
          </div>
        </PendingSource>
      </VehicleCard>
    );
  }

  return (
    <MetricCard
      title="Acelerador"
      hint="Posição do pedal agora"
      icon={GaugeIcon}
      label="Pedal"
      value={acelerador.percent}
      unit="%"
      footerLeft={acelerador.percent >= 80 ? 'Pedal quase no fundo' : 'Aceleração dentro do normal'}
      footerRight={
        <>
          {km.format(acelerador.speedKmh)} km/h
          <br />
          {km.format(acelerador.rpm)} rpm
        </>
      }
    >
      {/* Curso do pedal, com a marca dos 80%: acima disso o consumo dispara, e é
          a leitura que interessa a quem olha de relance. */}
      <div className="relative">
        <div className="bg-accent/10 h-4 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary-on-light/70 h-full rounded-full"
            style={{ width: `${acelerador.percent}%` }}
          />
        </div>
        <span
          aria-hidden="true"
          className="border-accent/30 absolute inset-y-0 left-[80%] border-l border-dashed"
        />
      </div>
    </MetricCard>
  );
}

/**
 * Eficiência da rota.
 *
 * ⚠️ Exige rota PLANEJADA para comparar com a percorrida, e o produto não tem
 * planejamento de rota: sem o previsto, não há do que o realizado ser eficiente.
 */
export function RouteEfficiencyCard({
  rota,
}: {
  rota?: { percent: number; plannedKm: number; drivenKm: number; trend: number[] } | undefined;
}) {
  if (!rota) {
    return (
      <VehicleCard title="Eficiência da rota" icon={RouteIcon} hint="Percorrido contra planejado">
        <PendingSource origem="Comparar exige uma rota planejada, e o sistema ainda não planeja rota: só registra a que foi percorrida.">
          <div className="flex h-full w-full items-center gap-3">
            <span className="text-on-light/15 font-sora text-[34px] font-bold leading-none">%</span>
            <div className="bg-on-light/8 h-10 flex-1 rounded-lg" />
          </div>
        </PendingSource>
      </VehicleCard>
    );
  }

  const diferenca = rota.drivenKm - rota.plannedKm;

  return (
    <MetricCard
      title="Eficiência da rota"
      hint="Percorrido contra planejado"
      icon={RouteIcon}
      label="Eficiência da rota"
      value={rota.percent}
      unit="%"
      footerLeft={
        diferenca === 0
          ? 'Trajeto realizado conforme o planejado'
          : `${km.format(Math.abs(diferenca))} km ${diferenca > 0 ? 'além' : 'a menos'} do planejado`
      }
      footerRight={
        <>
          {km.format(rota.drivenKm)} km rodados
          <br />
          para {km.format(rota.plannedKm)} km planejados
        </>
      }
    >
      <RouteTrend trend={rota.trend} />
    </MetricCard>
  );
}

/** Linha de tendência decorativa com pontos reais da série; não estima dias ausentes. */
function RouteTrend({ trend }: { trend: number[] }) {
  if (trend.length < 2) return null;

  const minimum = Math.min(...trend);
  const maximum = Math.max(...trend);
  const range = maximum - minimum || 1;
  const points = trend.map((value, index) => {
    const x = 5 + (index * 90) / (trend.length - 1);
    const y = 31 - ((value - minimum) / range) * 25;
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x},${y}`).join(' ');
  const last = points.at(-1);

  return (
    <div
      className="relative h-12"
      role="img"
      aria-label="Tendência de eficiência nos últimos registros"
    >
      <span className="absolute inset-x-0 bottom-1 border-t border-dotted border-accent/15" />
      <svg
        viewBox="0 0 100 36"
        preserveAspectRatio="none"
        className="relative h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-primary-on-light)"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={index === points.length - 1 ? 2.6 : 1.3}
            fill={
              index === points.length - 1 ? 'var(--color-primary-on-light)' : 'var(--color-light)'
            }
            stroke="var(--color-primary-on-light)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {last ? (
          <circle
            cx={last[0]}
            cy={last[1]}
            r="4.1"
            fill="var(--color-primary-on-light)"
            opacity=".14"
          />
        ) : null}
      </svg>
      <span className="text-on-light-muted absolute bottom-0 left-0 text-[9px]">tendência</span>
      <span className="text-on-light-muted absolute bottom-0 right-0 text-[9px]">atual</span>
    </div>
  );
}

/**
 * Status dos pneus.
 *
 * ⚠️ **O desenho dos eixos é dado REAL quando existe**: `axles` vem do cadastro
 * do veículo. O que não existe é leitura por pneu, que pede sensor de pressão
 * (TPMS) ou inspeção lançada na manutenção. Por isso cada posição aparece
 * marcada como sem leitura, e não como "ok".
 */
export function TireStatusCard({
  axles,
  pneus,
}: {
  axles?: number | undefined;
  pneus?: { position: string; psi: number; status: 'ok' | 'atencao' | 'critico' }[] | undefined;
}) {
  const eixos = axles && axles > 0 ? axles : 2;

  if (pneus && pneus.length > 0) {
    /* A cor repete o rótulo escrito, nunca o substitui: a lista abaixo diz
       "atenção" e "crítico" com todas as letras. */
    const tinta = { ok: 'bg-success', atencao: 'bg-warning', critico: 'bg-error' } as const;
    const rotulo = { ok: 'normal', atencao: 'atenção', critico: 'crítico' } as const;
    const foraDoPadrao = pneus.filter((pneu) => pneu.status !== 'ok');
    const menor = pneus.reduce((pior, pneu) => (pneu.psi < pior.psi ? pneu : pior), pneus[0]!);

    return (
      <MetricCard
        title="Pneus"
        hint="Pressão por posição"
        icon={CircleIcon}
        label="Fora do padrão"
        value={foraDoPadrao.length}
        unit={`de ${pneus.length}`}
        footerLeft={
          foraDoPadrao.length === 0
            ? 'Todas as posições dentro do padrão'
            : `Menor pressão em ${menor.position.toLowerCase()}`
        }
        footerRight={
          <>
            {km.format(menor.psi)} psi
            <br />
            na pior posição
          </>
        }
      >
        <ul className="space-y-1.5">
          {pneus.map((pneu) => (
            <li key={pneu.position} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn('size-2 shrink-0 rounded-full', tinta[pneu.status])}
              />
              <span className="text-accent text-label-sm min-w-0 flex-1 truncate normal-case">
                {pneu.position}
              </span>
              <span className="text-accent text-label-sm tabular normal-case">{pneu.psi} psi</span>
              <span className="text-on-light-muted text-label-sm w-14 text-right normal-case">
                {rotulo[pneu.status]}
              </span>
            </li>
          ))}
        </ul>
      </MetricCard>
    );
  }

  return (
    <VehicleCard
      title="Pneus"
      icon={CircleIcon}
      hint={
        axles
          ? `${eixos} eixos no cadastro deste veículo`
          : 'Eixos não preenchidos no cadastro, desenho padrão de 2 eixos'
      }
    >
      <PendingSource origem="Pressão e desgaste por pneu pedem sensor TPMS ou inspeção lançada na manutenção. Nenhum dos dois chega ao sistema hoje.">
        <div className="flex h-full w-full items-center justify-center gap-6">
          {Array.from({ length: eixos }, (_, eixo) => (
            <div key={eixo} className="flex flex-col items-center gap-1.5">
              <span className="bg-on-light/12 h-3.5 w-7 rounded-sm" />
              <span className="bg-on-light/8 h-1 w-10 rounded-full" />
              <span className="bg-on-light/12 h-3.5 w-7 rounded-sm" />
            </div>
          ))}
        </div>
      </PendingSource>
    </VehicleCard>
  );
}
