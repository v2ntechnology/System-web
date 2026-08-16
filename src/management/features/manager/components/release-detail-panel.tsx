import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowUpRightIcon,
  CameraIcon,
  CheckIcon,
  ClockIcon,
  LockKeyIcon,
  ProhibitIcon,
  TruckIcon,
  UserIcon,
} from '@phosphor-icons/react';
import type { ReleaseRequest } from '@/management/types';
import { LightCard, SpectrumButton, Spinner, StatusChip, cn } from '@/management/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { dateTime } from '@/management/lib/format';
import { ApiError } from '@/management/mocks/latency';

import { decideRelease } from '../api';
import { releaseDecisionSchema, stepsFromText, type ReleaseDecisionValues } from '../schema';
import {
  RELEASE_STATUS_META,
  SEVERITY_LABEL,
  SEVERITY_RULE,
  SEVERITY_TONE,
  managerCanRelease,
  requiresActionPlan,
} from '../severity';

export interface ReleaseDetailPanelProps {
  release: ReleaseRequest;
}

/**
 * Pedido de liberação aberto, com a decisão do gestor.
 *
 * A tela é dirigida pela severidade, não pelo gosto de quem clica:
 *
 * - **leve** — liberação direta, só com justificativa;
 * - **média** — o botão de liberar exige plano de ação preenchido;
 * - **grave** — **não existe botão de liberar**. O caso escala para o
 *   proprietário e o veículo continua bloqueado.
 *
 * Esconder o botão no caso grave não é o controle: o backend recusa de qualquer
 * jeito (403). É para o gestor não perder tempo tentando o que não é dele.
 */
export function ReleaseDetailPanel({ release }: ReleaseDetailPanelProps) {
  const queryClient = useQueryClient();
  const status = RELEASE_STATUS_META[release.status];
  const pending = release.status === 'PENDENTE';
  const canRelease = managerCanRelease(release.severity);
  const needsPlan = requiresActionPlan(release.severity);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReleaseDecisionValues>({
    resolver: zodResolver(releaseDecisionSchema),
    defaultValues: { note: '', actionPlan: '' },
  });

  /* Trocar de pedido não deve carregar o texto escrito para o anterior. */
  useEffect(() => {
    reset({ note: '', actionPlan: '' });
  }, [release.id, reset]);

  const mutation = useMutation({
    mutationFn: decideRelease,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['manager', 'releases'] });
      queryClient.invalidateQueries({ queryKey: ['manager', 'overview'] });
      /* O caso grave vira decisão do dono — a fila dele muda agora. */
      queryClient.invalidateQueries({ queryKey: ['owner', 'approvals'] });
      reset({ note: '', actionPlan: '' });

      if (updated.status === 'LIBERADO') {
        toast.success('Saída liberada', {
          description: `${updated.subject} está liberado para rodar.`,
        });
      } else if (updated.status === 'AGUARDANDO_DONO') {
        toast.info('Enviado ao proprietário', {
          description: `${updated.subject} segue bloqueado até a aprovação formal.`,
        });
      } else {
        toast.info('Pedido recusado', { description: `${updated.subject} continua retido.` });
      }
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.title : 'Não foi possível registrar', {
        description:
          error instanceof ApiError
            ? error.detail
            : 'Tente de novo em instantes. A decisão não foi gravada.',
      });
    },
  });

  const busy = isSubmitting || mutation.isPending;

  function decide(action: 'LIBERAR' | 'ESCALAR' | 'RECUSAR') {
    return handleSubmit((values) => {
      const actionPlan = stepsFromText(values.actionPlan ?? '');

      /*
       * Ocorrência média sem plano de ação é erro de formulário, não de rede:
       * barrar aqui evita uma ida ao servidor para receber o mesmo "não".
       */
      if (action === 'LIBERAR' && needsPlan && actionPlan.length === 0) {
        setError('actionPlan', {
          message: 'Ocorrência média exige pelo menos um passo de plano de ação.',
        });
        return;
      }

      return mutation
        .mutateAsync({ releaseId: release.id, action, note: values.note, actionPlan })
        .catch(() => {
          /* Já comunicado no toast; o formulário permanece preenchido. */
        });
    });
  }

  return (
    <LightCard
      title={release.subject}
      action={
        <StatusChip tone={status.tone} surface="light">
          {status.label}
        </StatusChip>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          tone="info"
          surface="light"
          icon={
            release.kind === 'VEICULO' ? (
              <TruckIcon size={14} weight="fill" aria-hidden="true" />
            ) : (
              <UserIcon size={14} weight="fill" aria-hidden="true" />
            )
          }
        >
          {release.kind === 'VEICULO' ? 'Liberação de veículo' : 'Liberação de motorista'}
        </StatusChip>

        <StatusChip tone={SEVERITY_TONE[release.severity]} surface="light">
          Ocorrência {SEVERITY_LABEL[release.severity].toLowerCase()}
        </StatusChip>

        {release.plate && release.kind !== 'VEICULO' ? (
          <StatusChip tone="neutral" surface="light">
            <span className="tabular">{release.plate}</span>
          </StatusChip>
        ) : null}

        {release.driverName && release.kind === 'VEICULO' ? (
          <StatusChip tone="neutral" surface="light">
            {release.driverName}
          </StatusChip>
        ) : null}

        <StatusChip
          tone={release.waitingHours >= 6 ? 'critical' : 'neutral'}
          surface="light"
          icon={<ClockIcon size={14} weight="fill" aria-hidden="true" />}
        >
          {release.waitingHours}h parado
        </StatusChip>
      </div>

      {/* A regra do degrau, escrita. O gestor não deveria precisar decorá-la. */}
      <p
        className={cn(
          'text-body-md mt-4 rounded-lg p-3',
          canRelease
            ? 'bg-light-container text-on-light-variant'
            : 'bg-error-on-light/10 text-error-on-light',
        )}
      >
        {!canRelease ? (
          <LockKeyIcon size={16} weight="fill" className="mr-1.5 inline" aria-hidden="true" />
        ) : null}
        {SEVERITY_RULE[release.severity]}
      </p>

      {release.tripCode ? (
        <p className="text-on-light-muted text-label-md mt-3 normal-case">
          Viagem {release.tripCode}
          {release.destination ? ` · ${release.destination}` : ''} · pedido em{' '}
          {dateTime.format(new Date(release.requestedAt))}
        </p>
      ) : (
        <p className="text-on-light-muted text-label-md mt-3 normal-case">
          Pedido em {dateTime.format(new Date(release.requestedAt))}
        </p>
      )}

      <h3 className="text-on-light-variant text-body-md mt-5 font-semibold">
        Pendências apontadas
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {release.blockers.map((blocker) => (
          <li key={blocker.id} className="bg-light-container rounded-md p-3">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-on-light min-w-0 flex-1 font-medium">{blocker.label}</span>
              <StatusChip tone={SEVERITY_TONE[blocker.severity]} surface="light">
                {SEVERITY_LABEL[blocker.severity]}
              </StatusChip>
              {blocker.hasPhoto ? (
                <CameraIcon
                  size={16}
                  weight="fill"
                  className="text-on-light-muted shrink-0"
                  aria-label="Com foto"
                />
              ) : null}
            </p>
            <p className="text-on-light-muted text-label-md mt-1 normal-case">
              {blocker.source} · {dateTime.format(new Date(blocker.at))}
            </p>
          </li>
        ))}
      </ul>

      {release.decision ? (
        <div className="border-light-outline mt-6 rounded-lg border p-4">
          <h3 className="text-on-light-variant text-body-md font-semibold">Decisão registrada</h3>
          <p className="text-on-light text-body-md mt-2">{release.decision.note}</p>

          {release.decision.actionPlan && release.decision.actionPlan.length > 0 ? (
            <ol className="mt-3 flex flex-col gap-2">
              {release.decision.actionPlan.map((step, index) => (
                <li key={step} className="text-on-light text-body-md flex gap-3">
                  <span className="tabular bg-primary-strong text-on-primary text-label-md rounded-pill flex size-6 shrink-0 items-center justify-center normal-case">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          ) : null}

          <p className="text-on-light-muted text-label-md mt-3 normal-case">
            {release.decision.by} · {dateTime.format(new Date(release.decision.at))}
          </p>

          {release.escalatedApprovalId ? (
            <p className="text-primary-on-light text-label-md mt-2 flex items-center gap-1.5 normal-case">
              <ArrowUpRightIcon size={14} weight="bold" aria-hidden="true" />
              Na fila do proprietário como {release.escalatedApprovalId}
            </p>
          ) : null}
        </div>
      ) : (
        <form className="border-light-outline mt-6 rounded-lg border p-4" noValidate>
          <label
            htmlFor="release-note"
            className="text-on-light-variant text-body-md font-semibold"
          >
            Justificativa da decisão
          </label>
          <p className="text-on-light-muted text-label-md mt-1 normal-case">
            Obrigatória — fica no histórico do veículo e do motorista.
          </p>

          <textarea
            id="release-note"
            rows={3}
            disabled={busy}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? 'release-note-error' : undefined}
            placeholder="Ex.: lanterna substituída no pátio e conferida antes da saída."
            className={cn(
              'text-body-md text-on-light placeholder:text-on-light-muted bg-light-container mt-3 w-full rounded-md border p-3',
              'focus-visible:ring-primary-on-light focus:outline-none focus-visible:ring-2',
              'disabled:opacity-60',
              errors.note ? 'border-error-on-light' : 'border-light-outline',
            )}
            {...register('note')}
          />

          {errors.note ? (
            <p
              id="release-note-error"
              role="alert"
              className="text-error-on-light text-label-md mt-2 normal-case"
            >
              {errors.note.message}
            </p>
          ) : null}

          {/* Plano de ação: obrigatório na média, útil como anexo ao escalar. */}
          {needsPlan || !canRelease ? (
            <>
              <label
                htmlFor="release-plan"
                className="text-on-light-variant text-body-md mt-5 block font-semibold"
              >
                Plano de ação {needsPlan ? '' : '(anexado ao proprietário)'}
              </label>
              <p className="text-on-light-muted text-label-md mt-1 normal-case">
                Um passo por linha.
              </p>

              <textarea
                id="release-plan"
                rows={4}
                disabled={busy}
                aria-invalid={errors.actionPlan ? true : undefined}
                aria-describedby={errors.actionPlan ? 'release-plan-error' : undefined}
                placeholder={
                  'Substituir o terminal de direção na Oficina Central\nReinspecionar antes da próxima saída'
                }
                className={cn(
                  'text-body-md text-on-light placeholder:text-on-light-muted bg-light-container mt-3 w-full rounded-md border p-3',
                  'focus-visible:ring-primary-on-light focus:outline-none focus-visible:ring-2',
                  'disabled:opacity-60',
                  errors.actionPlan ? 'border-error-on-light' : 'border-light-outline',
                )}
                {...register('actionPlan')}
              />

              {errors.actionPlan ? (
                <p
                  id="release-plan-error"
                  role="alert"
                  className="text-error-on-light text-label-md mt-2 normal-case"
                >
                  {errors.actionPlan.message}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            {canRelease ? (
              <SpectrumButton
                type="button"
                variant="primary"
                disabled={busy || !pending}
                onClick={decide('LIBERAR')}
              >
                {busy ? (
                  <Spinner label="Registrando" />
                ) : (
                  <CheckIcon size={18} weight="bold" aria-hidden="true" />
                )}
                {needsPlan ? 'Liberar com plano de ação' : 'Liberar saída'}
              </SpectrumButton>
            ) : (
              <SpectrumButton
                type="button"
                variant="primary"
                disabled={busy || !pending}
                onClick={decide('ESCALAR')}
              >
                {busy ? (
                  <Spinner label="Enviando" />
                ) : (
                  <ArrowUpRightIcon size={18} weight="bold" aria-hidden="true" />
                )}
                Escalar ao proprietário
              </SpectrumButton>
            )}

            <SpectrumButton
              type="button"
              variant="ghost"
              disabled={busy || !pending}
              onClick={decide('RECUSAR')}
              /* Ghost é desenhado para o grafite: sobre o painel claro precisa
                 da borda e do texto escuros para não sumir. */
              className="border-light-outline text-on-light bg-light-container hover:bg-light hover:border-on-light-muted"
            >
              <ProhibitIcon size={18} weight="bold" aria-hidden="true" />
              Manter retido
            </SpectrumButton>
          </div>
        </form>
      )}
    </LightCard>
  );
}
