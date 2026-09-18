import {
  ArrowLeftIcon,
  ChartIcon,
  GridIcon,
  IdCardIcon,
  TruckIcon,
  WarningIcon,
} from '@/components/icons';
import type { Driver, DriverProfile, DriverStatus } from '@/management/types';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router';

import { HeroBand, HeroLink, HeroPill } from '@/management/components/layout/hero-band';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';
import { Avatar, StatusChip, cn, type StatusTone } from '@/management/ui';

import { getDriverProfile, getDrivers } from '../api';
import { DriverLicenseDialog } from '../components/driver-license-dialog';

const SECOES = [
  { id: 'geral', label: 'Visão geral', icon: GridIcon },
  { id: 'cnh', label: 'CNH e documentos', icon: IdCardIcon },
  { id: 'desempenho', label: 'Desempenho', icon: ChartIcon },
  { id: 'ocorrencias', label: 'Ocorrências', icon: WarningIcon },
] as const;

type SecaoId = (typeof SECOES)[number]['id'];

const STATUS: Record<DriverStatus, { label: string; tone: StatusTone }> = {
  EM_VIAGEM: { label: 'Em viagem', tone: 'info' },
  DISPONIVEL: { label: 'Disponível', tone: 'positive' },
  DESCANSO: { label: 'Em descanso', tone: 'neutral' },
  AFASTADO: { label: 'Afastado', tone: 'attention' },
};

const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const SEM_DADO = 'Não informado';

function dataOu(valor: string | undefined) {
  return valor ? data.format(new Date(valor)) : SEM_DADO;
}

function Bloco({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="bg-light-container border-light-outline rounded-xl border p-5 sm:p-6">
      <h2 className="text-on-light text-body-lg font-semibold">{title}</h2>
      <p className="text-on-light-muted text-label-md mt-1 normal-case">{hint}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metricas({ driver, profile }: { driver: Driver; profile: DriverProfile | undefined }) {
  const items = [
    { label: 'Score de segurança', value: driver.score ?? '–', hint: 'no período' },
    {
      label: 'Quilômetros rodados',
      value: `${km.format(profile?.distanceKm ?? driver.kmDriven)} km`,
      hint: 'no período',
    },
    { label: 'Percursos', value: profile?.journeys ?? driver.tripsCount, hint: 'registrados' },
    {
      label: 'Horas dirigindo',
      value: profile?.hoursDriven == null ? '–' : `${profile.hoursDriven} h`,
      hint: 'no período',
    },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-on-light/[0.045] rounded-lg p-4">
          <dt className="text-on-light-muted text-label-sm normal-case">{item.label}</dt>
          <dd className="text-on-light font-sora tabular mt-1 text-[25px] font-bold leading-none">
            {item.value}
          </dd>
          <p className="text-on-light-muted text-label-sm mt-1 normal-case">{item.hint}</p>
        </div>
      ))}
    </dl>
  );
}

/** Ficha individual do motorista. Não há mapa: motorista não é um ativo rastreável. */
export function DriverPage() {
  const { driverId = '' } = useParams();
  const [secao, setSecao] = useState<SecaoId>('geral');
  const [cnhAberta, setCnhAberta] = useState(false);
  const drivers = useQuery({ queryKey: ['drivers'], queryFn: getDrivers });
  const driver = drivers.data?.find((item) => item.id === driverId);
  const profile = useQuery({
    queryKey: ['driver-profile', driverId],
    queryFn: () => getDriverProfile(driverId),
    enabled: Boolean(driver),
  });
  const status = driver ? STATUS[driver.status] : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <HeroBand
        title={driver?.name ?? 'Motorista'}
        description={driver?.unit ?? 'Ficha do motorista'}
      >
        {status ? <HeroPill icon={TruckIcon}>{status.label}</HeroPill> : null}
        {driver ? (
          <button
            type="button"
            onClick={() => setCnhAberta(true)}
            className="border-on-primary text-on-primary hover:bg-on-primary hover:text-primary focus-visible:ring-on-primary inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <IdCardIcon size={15} aria-hidden="true" />
            CNH
          </button>
        ) : null}
        <HeroLink to="/gestao/equipe" icon={ArrowLeftIcon}>
          Voltar para a equipe
        </HeroLink>
      </HeroBand>

      <PageContent className="bg-light rounded-t-4xl relative -mt-16 flex-1 pt-8 sm:rounded-t-[40px]">
        <QueryState isPending={drivers.isPending} isError={drivers.isError} label="o motorista">
          {!driver ? (
            <div className="bg-light-container flex min-h-64 flex-col items-center justify-center rounded-xl p-8 text-center">
              <p className="text-on-light text-body-lg font-semibold">Motorista não encontrado.</p>
              <p className="text-on-light-muted text-body-md mt-1">
                Ele pode não fazer mais parte da frota.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[208px_minmax(0,1fr)]">
              <nav aria-label="Seções do motorista" className="lg:sticky lg:top-6 lg:self-start">
                <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                  {SECOES.map((item) => {
                    const Icon = item.icon;
                    const ativa = secao === item.id;
                    return (
                      <li key={item.id} className="shrink-0 lg:shrink">
                        <button
                          type="button"
                          onClick={() => setSecao(item.id)}
                          aria-current={ativa ? 'page' : undefined}
                          className={cn(
                            'text-label-md focus-visible:ring-primary-on-light flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                            ativa
                              ? 'bg-primary-strong text-on-primary'
                              : 'text-on-light-variant hover:bg-light-container',
                          )}
                        >
                          <Icon size={16} aria-hidden="true" />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="min-w-0">
                <QueryState
                  isPending={profile.isPending}
                  isError={profile.isError}
                  label="a ficha do motorista"
                >
                  {secao === 'geral' ? (
                    <div className="grid gap-4 xl:grid-cols-3">
                      <Bloco title="Motorista" hint="Identificação e vínculo com a operação">
                        <div className="flex items-center gap-3">
                          <Avatar src={driver.avatarUrl} name={driver.name} className="size-16" />
                          <div className="min-w-0">
                            <p className="text-on-light font-semibold">{driver.name}</p>
                            <p className="text-on-light-muted text-label-md normal-case">
                              {profile.data?.employeeNumber ?? 'Sem matrícula'} ·{' '}
                              {profile.data?.unit ?? driver.unit ?? 'Sem filial'}
                            </p>
                          </div>
                        </div>
                      </Bloco>
                      <Bloco title="Veículo atual" hint="Identificação pelo último percurso">
                        <p className="text-on-light font-sora tabular text-[28px] font-bold">
                          {profile.data?.currentVehiclePlate ?? driver.currentVehiclePlate ?? '–'}
                        </p>
                        <p className="text-on-light-muted text-label-md mt-2 normal-case">
                          A telemetria não informa escala nem próxima viagem.
                        </p>
                      </Bloco>
                      <Bloco title="Situação" hint="Estado informado pela operação">
                        <StatusChip tone={status?.tone ?? 'neutral'} surface="light">
                          {status?.label ?? 'Sem situação'}
                        </StatusChip>
                      </Bloco>
                      <div className="xl:col-span-3">
                        <Metricas driver={driver} profile={profile.data} />
                      </div>
                    </div>
                  ) : null}

                  {secao === 'cnh' ? (
                    <Bloco title="CNH e documentos" hint="Dados de habilitação e cadastro de RH">
                      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <dt className="text-on-light-muted text-label-sm normal-case">
                            Categoria
                          </dt>
                          <dd className="text-on-light text-body-md mt-1">
                            {profile.data?.cnhCategory ?? driver.cnhCategory ?? SEM_DADO}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-on-light-muted text-label-sm normal-case">
                            Validade
                          </dt>
                          <dd className="text-on-light text-body-md mt-1">
                            {dataOu(profile.data?.cnhExpiresAt ?? driver.cnhExpiresAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-on-light-muted text-label-sm normal-case">
                            Registro
                          </dt>
                          <dd className="text-on-light text-body-md mt-1 tabular">
                            {profile.data?.cnhNumber ?? SEM_DADO}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-on-light-muted text-label-sm normal-case">Pontos</dt>
                          <dd className="text-on-light text-body-md mt-1">
                            {profile.data?.cnhPoints ?? SEM_DADO}
                          </dd>
                        </div>
                      </dl>
                    </Bloco>
                  ) : null}

                  {secao === 'desempenho' ? (
                    <Bloco title="Desempenho" hint="O que a telemetria mediu no período">
                      <Metricas driver={driver} profile={profile.data} />
                    </Bloco>
                  ) : null}

                  {secao === 'ocorrencias' ? (
                    <Bloco
                      title="Ocorrências de condução"
                      hint="Eventos sinalizados pela telemetria"
                    >
                      {profile.data?.warnings.length ? (
                        <ul className="divide-light-outline divide-y">
                          {profile.data.warnings.map((warning) => (
                            <li key={warning.id} className="py-3">
                              <p className="text-on-light font-medium">{warning.title}</p>
                              <p className="text-on-light-muted text-label-md mt-1 normal-case">
                                {warning.description}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-on-light-muted text-body-md">
                          Nenhuma ocorrência registrada no período.
                        </p>
                      )}
                    </Bloco>
                  ) : null}
                </QueryState>
              </div>
            </div>
          )}
        </QueryState>
      </PageContent>

      {driver ? (
        <DriverLicenseDialog
          open={cnhAberta}
          onOpenChange={setCnhAberta}
          driverId={driver.id}
          name={driver.name}
        />
      ) : null}
    </div>
  );
}
