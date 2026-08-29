import {
  ArrowRightIcon,
  IdCardIcon,
  PhoneIcon,
  ShieldAlertIcon,
  TruckIcon,
  WarningIcon,
} from '@/components/icons';
import type { DriverStatus, TeamPerson } from '@/management/types';
import { Avatar, StatusChip, cn, type StatusTone } from '@/management/ui';
import { Link } from 'react-router';

import { dateOnly, daysUntil, km, monthYear } from '@/management/lib/format';

const DRIVER_STATUS: Record<DriverStatus, { label: string; tone: StatusTone }> = {
  EM_VIAGEM: { label: 'Em viagem', tone: 'info' },
  DISPONIVEL: { label: 'Disponível', tone: 'positive' },
  DESCANSO: { label: 'Em descanso', tone: 'neutral' },
  AFASTADO: { label: 'Afastado', tone: 'critical' },
};

/** Janela de renovação da CNH — a mesma do resumo, para os dois concordarem. */
const CNH_WARNING_DAYS = 60;

export interface PersonCardProps {
  person: TeamPerson;
  /** Gestor recebe os atalhos de tratativa; o dono, só a leitura. */
  canAct: boolean;
}

/**
 * Uma pessoa do quadro.
 *
 * Mostra o que muda a decisão de hoje: se pode assumir viagem, se o documento
 * vence, se o acesso está desprotegido. O histórico completo fica na ficha do
 * motorista e a gestão de acesso em Configurações — este cartão aponta para lá
 * em vez de reimplementar as duas.
 */
export function PersonCard({ person, canAct }: PersonCardProps) {
  const isDriver = person.kind === 'MOTORISTA';

  const cnhDays = isDriver ? daysUntil(person.cnhExpiresAt) : null;
  const cnhExpired = cnhDays !== null && cnhDays < 0;
  const cnhSoon = cnhDays !== null && cnhDays >= 0 && cnhDays <= CNH_WARNING_DAYS;

  const status = isDriver
    ? DRIVER_STATUS[person.status]
    : person.active
      ? { label: 'Acesso ativo', tone: 'positive' as StatusTone }
      : { label: 'Acesso inativo', tone: 'neutral' as StatusTone };

  return (
    <li
      className={cn(
        'bg-light-container min-w-0 rounded-lg p-4',
        /* Documento vencido não é detalhe de rodapé: o veículo não sai. */
        cnhExpired && 'ring-error-on-light/40 ring-1',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar src={person.avatarUrl} name={person.name} className="size-11 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-on-light truncate font-semibold">{person.name}</p>
          {/* Mês/ano, não data cheia: com "01 de maio de 2019" a linha do cargo
              truncava, e o dia exato da admissão não decide nada aqui. */}
          <p className="text-on-light-muted text-label-md truncate normal-case">
            {person.roleLabel}
            {person.hiredAt ? ` · desde ${monthYear.format(new Date(person.hiredAt))}` : ''}
          </p>
        </div>

        <StatusChip tone={status.tone} surface="light">
          {status.label}
        </StatusChip>
      </div>

      {isDriver ? (
        <>
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex gap-1.5">
              <dt className="text-on-light-muted text-label-md normal-case">Score</dt>
              <dd className="tabular text-on-light-variant text-label-md normal-case">
                {person.score}
                {/* Delta zero fica de fora: "Score 92 0" se lê como erro de
                    digitação, não como "estável". */}
                {person.scoreDelta !== 0 ? (
                  <span
                    className={cn(
                      person.scoreDelta > 0 ? 'text-success-on-light' : 'text-error-on-light',
                    )}
                  >
                    {' '}
                    {person.scoreDelta > 0 ? '+' : ''}
                    {person.scoreDelta}
                  </span>
                ) : null}
              </dd>
            </div>

            <div className="flex gap-1.5">
              <dt className="text-on-light-muted text-label-md normal-case">Rodados</dt>
              <dd className="tabular text-on-light-variant text-label-md normal-case">
                {km.format(person.kmDriven)} km
              </dd>
            </div>

            {person.currentVehiclePlate ? (
              <div className="flex items-center gap-1.5">
                <TruckIcon size={14} className="text-on-light-muted" aria-hidden="true" />
                <dd className="tabular text-on-light-variant text-label-md normal-case">
                  {person.currentVehiclePlate}
                </dd>
              </div>
            ) : null}
          </dl>

          <p
            className={cn(
              'text-label-md mt-2 flex items-center gap-1.5 normal-case',
              cnhExpired
                ? 'text-error-on-light font-semibold'
                : cnhSoon
                  ? 'text-warning-on-light'
                  : 'text-on-light-muted',
            )}
          >
            <IdCardIcon size={14} aria-hidden="true" />
            CNH {person.cnhCategory} ·{' '}
            {cnhExpired
              ? `vencida há ${Math.abs(cnhDays!)} dias`
              : cnhSoon
                ? `vence em ${cnhDays} dias`
                : `válida até ${dateOnly.format(new Date(person.cnhExpiresAt))}`}
          </p>

          {person.criticalEvents > 0 ? (
            <p className="text-error-on-light text-label-md mt-1.5 flex items-center gap-1.5 normal-case">
              <WarningIcon size={14} aria-hidden="true" />
              {person.criticalEvents === 1
                ? '1 evento crítico no período'
                : `${person.criticalEvents} eventos críticos no período`}
            </p>
          ) : null}

          {person.phone ? (
            <p className="text-on-light-muted text-label-md mt-1.5 flex items-center gap-1.5 normal-case">
              <PhoneIcon size={14} aria-hidden="true" />
              <span className="tabular">{person.phone}</span>
            </p>
          ) : null}

          <Link
            to="/gestao/motoristas"
            className="text-primary-on-light text-label-md focus-visible:ring-primary-on-light mt-3 inline-flex items-center gap-1.5 rounded-md normal-case underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            {canAct ? 'Abrir ficha e advertências' : 'Ver ficha completa'}
            <ArrowRightIcon size={14} aria-hidden="true" />
          </Link>
        </>
      ) : (
        <>
          <p className="text-on-light-variant text-label-md mt-3 truncate normal-case">
            {person.email}
          </p>

          <p className="text-on-light-muted text-label-md mt-1.5 normal-case">
            {person.lastAccessAt
              ? `Último acesso em ${dateOnly.format(new Date(person.lastAccessAt))}`
              : 'Nunca acessou'}
          </p>

          {/*
           * Sinal, não gestão: forçar MFA e desativar acesso é da tela de
           * Configurações. Aqui o cartão só denuncia e aponta para lá.
           */}
          {person.active && !person.mfaEnabled ? (
            <p className="text-warning-on-light text-label-md mt-2 flex items-center gap-1.5 normal-case">
              <ShieldAlertIcon size={14} aria-hidden="true" />
              Sem verificação em duas etapas
            </p>
          ) : null}

          <Link
            to="/gestao/configuracoes"
            className="text-primary-on-light text-label-md focus-visible:ring-primary-on-light mt-3 inline-flex items-center gap-1.5 rounded-md normal-case underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            Gerenciar acesso
            <ArrowRightIcon size={14} aria-hidden="true" />
          </Link>
        </>
      )}
    </li>
  );
}
