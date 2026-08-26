import {
  BadgeCheckIcon,
  BirthdayIcon,
  BriefcaseIcon,
  IdCardIcon,
  LockIcon,
  MapPinIcon,
  PhoneIcon,
  PlayIcon,
  WarningIcon,
} from '@/components/icons';
import type { Driver, DriverWarning, WarningSeverity } from '@/management/types';
import { Avatar, Spinner, StatusChip, cn, type StatusTone } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getDriverProfile } from '../api';
import { useFinancialVisibility } from '../use-financial-visibility';
import { WarningVideoDialog } from './warning-video-dialog';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fullDate = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

const SEVERITY: Record<WarningSeverity, { label: string; tone: StatusTone }> = {
  LEVE: { label: 'Leve', tone: 'neutral' },
  MEDIA: { label: 'Média', tone: 'attention' },
  GRAVE: { label: 'Grave', tone: 'critical' },
};

/** Texto padrão para campo que a telemetria não tem e o RH ainda não preencheu. */
const SEM_DADO = 'Não informado';

/** Data curta, ou o marcador de ausência. Evita "Invalid Date" na tela. */
function dataOu(iso: string | undefined): string {
  return iso ? fullDate.format(new Date(iso)) : SEM_DADO;
}

/** Anos completos entre a data e hoje. */
function yearsSince(iso: string) {
  const from = new Date(iso);
  const now = new Date();
  let years = now.getFullYear() - from.getFullYear();
  const monthDiff = now.getMonth() - from.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < from.getDate())) years -= 1;
  return years;
}

function Field({
  icon,
  label,
  children,
}: {
  icon?: ReactNode | undefined;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-on-surface-muted text-label-md flex items-center gap-1.5 normal-case">
        {icon}
        {label}
      </dt>
      <dd className="text-on-surface text-body-md mt-0.5">{children}</dd>
    </div>
  );
}

export function DriverDetailPanel({ driver }: { driver: Driver }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['driver-profile', driver.id],
    queryFn: () => getDriverProfile(driver.id),
  });

  const canSeeFinancials = useFinancialVisibility();
  const [openWarning, setOpenWarning] = useState<DriverWarning | null>(null);

  const axisTick = { fill: 'var(--color-on-surface-muted)', fontSize: 12 };
  const maxRoadEvents = Math.max(...(data?.roadEvents.map((event) => event.count) ?? [1]), 1);

  return (
    <section
      aria-label={`Ficha de ${driver.name}`}
      className="bg-surface-lowest flex min-w-0 flex-col rounded-xl p-5 sm:p-6"
    >
      <header className="border-outline-variant flex flex-wrap items-start gap-4 border-b pb-5">
        <Avatar src={driver.avatarUrl} name={driver.name} className="size-16" />

        <div className="min-w-0 flex-1">
          <h3 className="font-sora text-on-surface text-headline-md font-bold">{driver.name}</h3>
          <p className="text-on-surface-variant text-body-md mt-0.5">
            {data?.role ?? 'Motorista'}
            {data?.unit ? ` · ${data.unit}` : ''}
            {data?.hiredAt ? ` · ${yearsSince(data.hiredAt)} anos de casa` : ''}
          </p>
        </div>

        <div className="text-right">
          <p className="tabular font-sora text-on-surface text-headline-md font-bold">
            {driver.score}
          </p>
          <p className="text-on-surface-muted text-label-md normal-case">score de segurança</p>
        </div>
      </header>

      {isPending ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="text-on-surface-muted size-6" label="Carregando a ficha" />
        </div>
      ) : isError || !data ? (
        <p className="text-error text-body-md py-16 text-center">
          Não foi possível carregar a ficha deste motorista.
        </p>
      ) : (
        <>
          {/* ---------------------------------------------------------------
           * Dados pessoais e contrato
           * ------------------------------------------------------------- */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h4 className="text-on-surface-variant text-body-md mb-3">Dados pessoais</h4>
              <dl className="grid gap-3 sm:grid-cols-2">
                {/* Campo que a telemetria não entrega mostra o marcador de
                    ausência. Preencher com valor plausível faria um CPF
                    inventado passar por real para quem olhasse. */}
                <Field icon={<BirthdayIcon size={14} />} label="Idade">
                  {data.birthDate ? (
                    <>
                      <span className="tabular">{yearsSince(data.birthDate)} anos</span>
                      <span className="text-on-surface-muted"> · {dataOu(data.birthDate)}</span>
                    </>
                  ) : (
                    <span className="text-on-surface-muted">{SEM_DADO}</span>
                  )}
                </Field>
                <Field label="CPF">
                  <span className="tabular">{data.cpfMasked ?? SEM_DADO}</span>
                </Field>
                <Field icon={<PhoneIcon size={14} />} label="Telefone">
                  <span className="tabular">{data.phone ?? SEM_DADO}</span>
                </Field>
                <Field icon={<MapPinIcon size={14} />} label="Matrícula">
                  <span className="tabular">{data.employeeNumber ?? SEM_DADO}</span>
                </Field>
              </dl>
            </div>

            <div>
              <h4 className="text-on-surface-variant text-body-md mb-3">Contrato</h4>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Field icon={<BriefcaseIcon size={14} />} label="Admissão">
                  <span className="tabular">{dataOu(data.hiredAt)}</span>
                </Field>
                <Field label="Tempo de empresa">
                  <span className="tabular">
                    {data.hiredAt ? `${yearsSince(data.hiredAt)} anos` : SEM_DADO}
                  </span>
                </Field>
                <Field label="Regime">{data.contractType ?? SEM_DADO}</Field>

                {/* RF-007 — bloqueado, não escondido: o usuário precisa saber que existe. */}
                <Field
                  icon={canSeeFinancials ? undefined : <LockIcon size={14} />}
                  label="Salário base"
                >
                  {canSeeFinancials && data.monthlySalary ? (
                    <span className="tabular">{brl.format(data.monthlySalary)}</span>
                  ) : (
                    <span className="text-on-surface-muted">Sem permissão para ver</span>
                  )}
                </Field>
              </dl>
            </div>
          </div>

          {/* ---------------------------------------------------------------
           * Habilitação
           * ------------------------------------------------------------- */}
          <div className="mt-6">
            <h4 className="text-on-surface-variant text-body-md mb-3">Habilitação</h4>
            <div className="bg-on-surface/4 grid gap-4 rounded-lg p-4 sm:grid-cols-4">
              <Field icon={<IdCardIcon size={14} />} label="Registro">
                <span className="tabular">{data.cnhNumber ?? SEM_DADO}</span>
              </Field>
              <Field label="Categoria">
                <span className="tabular">{data.cnhCategory ?? SEM_DADO}</span>
                {data.cnhEar ? (
                  <span className="text-success text-label-md ml-2 inline-flex items-center gap-1 normal-case">
                    <BadgeCheckIcon size={14} aria-hidden="true" />
                    EAR
                  </span>
                ) : null}
              </Field>
              <Field label="Validade">
                <span className="tabular">{dataOu(data.cnhExpiresAt)}</span>
              </Field>
              <Field label="Pontos na CNH">
                <span className="tabular">{data.cnhPoints ?? SEM_DADO}</span>
                {data.cnhPoints != null ? (
                  <span className="text-on-surface-muted"> de 40</span>
                ) : null}
                {(data.cnhPoints ?? 0) >= 15 ? (
                  <StatusChip tone="attention" className="ml-2">
                    Atenção
                  </StatusChip>
                ) : null}
              </Field>
            </div>
          </div>

          {/* ---------------------------------------------------------------
           * Operação e gráficos
           * ------------------------------------------------------------- */}
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Viagens no período', value: driver.tripsCount.toLocaleString('pt-BR') },
              { label: 'Km rodados', value: km.format(driver.kmDriven) },
              {
                label: 'Consumo médio',
                value:
                  data.avgFuelEfficiency == null
                    ? '–'
                    : `${data.avgFuelEfficiency.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })} km/l`,
              },
              {
                /* Entrega no prazo depende de viagem com destino e janela, que a
                   telemetria não conhece. Enquanto não houver a tela de fretes,
                   o indicador útil aqui é o tempo ao volante. */
                label: 'Horas dirigindo',
                value:
                  data.hoursDriven == null
                    ? '–'
                    : `${data.hoursDriven.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} h`,
              },
            ].map((metric) => (
              <div key={metric.label} className="bg-on-surface/4 min-w-0 rounded-md p-3">
                <p className="text-on-surface-muted text-label-md normal-case">{metric.label}</p>
                <p className="tabular font-sora text-on-surface text-headline-md mt-1 font-semibold">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <figure>
              <figcaption className="text-on-surface-variant text-body-md mb-3 flex items-baseline justify-between gap-3">
                Evolução do score
                <span className="text-on-surface-muted text-label-md normal-case">
                  {/* A série é diária e cobre o que já foi coletado, não seis
                      meses fixos: um cliente novo tem poucos dias de histórico. */}
                  {data.scoreHistory.length === 1
                    ? '1 dia com quilometragem'
                    : `${data.scoreHistory.length} dias com quilometragem`}
                </span>
              </figcaption>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.scoreHistory}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--color-outline-variant)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={axisTick}
                      dy={4}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={36}
                      domain={[60, 100]}
                      ticks={[60, 70, 80, 90, 100]}
                      tick={axisTick}
                    />
                    <Tooltip
                      cursor={{ stroke: 'var(--color-on-surface-muted)', strokeWidth: 1 }}
                      contentStyle={{
                        background: 'var(--color-surface-low)',
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: 12,
                        color: 'var(--color-on-surface)',
                      }}
                      formatter={(value: unknown) => [String(value), 'Score'] as [string, string]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--secondary)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'var(--secondary)', strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>

            {/*
             * Barras em HTML, não Recharts: seis categorias com rótulo de duas
             * palavras colidem no eixo de um gráfico desta altura. Aqui o rótulo
             * tem a linha inteira e o número fica sempre visível.
             */}
            <figure>
              <figcaption className="text-on-surface-variant text-body-md mb-3 flex items-baseline justify-between gap-3">
                Eventos na estrada
                <span className="text-on-surface-muted text-label-md normal-case">
                  ocorrências no período
                </span>
              </figcaption>

              <ul className="flex flex-col gap-2.5">
                {[...data.roadEvents]
                  .sort((a, b) => b.count - a.count)
                  .map((event) => (
                    <li key={event.type}>
                      <span className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="text-on-surface-variant text-label-md truncate normal-case">
                          {event.label}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2">
                          {event.delta !== 0 ? (
                            <span
                              className={cn(
                                'text-label-sm normal-case',
                                event.delta > 0 ? 'text-error' : 'text-success',
                              )}
                            >
                              {event.delta > 0 ? '+' : ''}
                              {event.delta}
                            </span>
                          ) : null}
                          <span className="tabular text-on-surface text-label-md font-semibold">
                            {event.count}
                          </span>
                        </span>
                      </span>

                      <span aria-hidden="true" className="bg-surface-high rounded-pill block h-1.5">
                        <span
                          className={cn(
                            'rounded-pill block h-full',
                            event.count === 0 ? 'bg-transparent' : 'bg-primary',
                          )}
                          style={{ width: `${(event.count / maxRoadEvents) * 100}%` }}
                        />
                      </span>
                    </li>
                  ))}
              </ul>
            </figure>
          </div>

          {/* ---------------------------------------------------------------
           * Advertências
           * ------------------------------------------------------------- */}
          <div className="mt-6">
            <h4 className="text-on-surface-variant text-body-md mb-3 flex items-center gap-2">
              Advertências
              {data.warnings.length > 0 ? (
                <StatusChip tone="critical">{data.warnings.length}</StatusChip>
              ) : null}
            </h4>

            {data.warnings.length === 0 ? (
              <p className="bg-on-surface/4 text-on-surface-variant text-body-md rounded-md px-4 py-3">
                Nenhuma advertência registrada no período.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.warnings.map((warning) => {
                  const severity = SEVERITY[warning.severity];

                  return (
                    <li key={warning.id} className="bg-on-surface/4 rounded-md p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-on-surface flex items-center gap-2 font-medium">
                            <WarningIcon
                              size={16}
                              aria-hidden="true"
                              className={cn(
                                warning.severity === 'GRAVE' ? 'text-error' : 'text-warning',
                              )}
                            />
                            {warning.title}
                          </p>
                          <p className="text-on-surface-variant text-body-md mt-1">
                            {warning.description}
                          </p>
                        </div>

                        <StatusChip tone={severity.tone}>{severity.label}</StatusChip>
                      </div>

                      <div className="border-outline-variant mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
                        <span className="text-on-surface-muted text-label-md normal-case">
                          {dateTime.format(new Date(warning.at))}
                        </span>
                        <span className="text-on-surface-muted text-label-md normal-case">
                          {warning.issuedBy}
                        </span>
                        {warning.location ? (
                          <span className="text-on-surface-muted text-label-md normal-case">
                            {warning.location}
                          </span>
                        ) : null}
                        {warning.contested ? (
                          <StatusChip tone="attention">Contestada</StatusChip>
                        ) : null}

                        {warning.media ? (
                          <button
                            type="button"
                            onClick={() => setOpenWarning(warning)}
                            className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary ml-auto inline-flex items-center gap-1.5 rounded-md border bg-on-surface/5 px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/10 focus-visible:outline-none focus-visible:ring-2"
                          >
                            <PlayIcon size={16} aria-hidden="true" />
                            Ver vídeo ({warning.media.durationSeconds}s)
                          </button>
                        ) : (
                          <span className="text-on-surface-muted text-label-md ml-auto normal-case">
                            Sem vídeo
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <WarningVideoDialog
            warning={openWarning}
            open={openWarning !== null}
            onOpenChange={(next) => (next ? undefined : setOpenWarning(null))}
          />
        </>
      )}
    </section>
  );
}
