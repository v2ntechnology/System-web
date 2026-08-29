import { BlockedIcon, CheckIcon, UserIcon } from '@/components/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { OwnerApproval } from '@/management/types';
import { LightCard, SpectrumButton, Spinner, StatusChip, cn } from '@/management/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ApiError } from '@/management/mocks/latency';

import { decideApproval } from '../api';
import { brlWhole, dateTime } from '@/management/lib/format';
import { approvalDecisionSchema, type ApprovalDecisionValues } from '../schema';
import { KIND_META, SEVERITY_LABEL, SEVERITY_TONE, STATUS_META } from './approval-meta';

export interface ApprovalDetailPanelProps {
  approval: OwnerApproval;
}

/**
 * Parecer aberto, com a decisão do dono.
 *
 * A ordem da leitura é deliberada: o que o gestor concluiu, os números que
 * sustentam a conclusão, o plano de ação e só então os botões. Decisão de
 * liberação de ocorrência grave não deveria caber num clique sem contexto.
 */
export function ApprovalDetailPanel({ approval }: ApprovalDetailPanelProps) {
  const queryClient = useQueryClient();
  const kind = KIND_META[approval.kind];
  const status = STATUS_META[approval.status];
  const pending = approval.status === 'PENDENTE';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApprovalDecisionValues>({
    resolver: zodResolver(approvalDecisionSchema),
    defaultValues: { note: '' },
  });

  /* Trocar de parecer não deve carregar a justificativa escrita para o anterior. */
  useEffect(() => {
    reset({ note: '' });
  }, [approval.id, reset]);

  const mutation = useMutation({
    mutationFn: decideApproval,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['owner', 'summary'] });
      reset({ note: '' });

      if (updated.status === 'APROVADA') {
        toast.success('Aprovação registrada', {
          description: `${updated.title} — a decisão foi para o log de auditoria.`,
        });
      } else {
        toast.info('Recusa registrada', {
          description: `${updated.title} — o gestor foi notificado.`,
        });
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

  function decide(approve: boolean) {
    return handleSubmit((values) =>
      mutation.mutateAsync({ approvalId: approval.id, approve, note: values.note }).catch(() => {
        /* O erro já foi comunicado no toast; o formulário permanece preenchido. */
      }),
    );
  }

  return (
    <LightCard
      title={approval.title}
      action={
        <StatusChip tone={status.tone} surface="light">
          {status.label}
        </StatusChip>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="info" surface="light" icon={<kind.icon size={14} aria-hidden="true" />}>
          {kind.label}
        </StatusChip>

        <StatusChip tone={SEVERITY_TONE[approval.severity]} surface="light">
          Ocorrência {SEVERITY_LABEL[approval.severity].toLowerCase()}
        </StatusChip>

        {approval.plate ? (
          <StatusChip tone="neutral" surface="light">
            <span className="tabular">{approval.plate}</span>
          </StatusChip>
        ) : null}

        {approval.driverName ? (
          <StatusChip
            tone="neutral"
            surface="light"
            icon={<UserIcon size={14} aria-hidden="true" />}
          >
            {approval.driverName}
          </StatusChip>
        ) : null}
      </div>

      <p className="text-on-light-muted text-label-md mt-3 normal-case">
        Enviado por {approval.requestedBy} · {dateTime.format(new Date(approval.requestedAt))}
      </p>

      <h3 className="text-on-light-variant text-body-md mt-5 font-semibold">Parecer do gestor</h3>
      <p className="text-on-light text-body-md mt-2">{approval.summary}</p>

      {/* Os números que sustentam o parecer, antes de qualquer botão. */}
      <h3 className="text-on-light-variant text-body-md mt-5 font-semibold">Evidências</h3>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        {approval.evidence.map((item) => (
          <div key={item.label} className="bg-light-container min-w-0 rounded-md p-3">
            <dt className="text-on-light-muted text-label-md normal-case">{item.label}</dt>
            <dd className="tabular text-on-light mt-1 font-semibold">{item.value}</dd>
          </div>
        ))}

        {approval.financialImpact !== undefined ? (
          <div className="bg-light-container min-w-0 rounded-md p-3">
            <dt className="text-on-light-muted text-label-md normal-case">Impacto no resultado</dt>
            <dd
              className={cn(
                'tabular mt-1 font-semibold',
                approval.financialImpact >= 0 ? 'text-success-on-light' : 'text-error-on-light',
              )}
            >
              {brlWhole.format(approval.financialImpact)}
            </dd>
          </div>
        ) : null}
      </dl>

      {approval.actionPlan && approval.actionPlan.length > 0 ? (
        <>
          <h3 className="text-on-light-variant text-body-md mt-5 font-semibold">
            Plano de ação do gestor
          </h3>
          <ol className="mt-2 flex flex-col gap-2">
            {approval.actionPlan.map((step, index) => (
              <li key={step} className="text-on-light text-body-md flex gap-3">
                <span className="tabular bg-primary-strong text-on-primary text-label-md rounded-pill flex size-6 shrink-0 items-center justify-center normal-case">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {approval.decision ? (
        /* Decisão já tomada: o registro fica visível, não vira histórico escondido. */
        <div className="border-light-outline mt-6 rounded-lg border p-4">
          <h3 className="text-on-light-variant text-body-md font-semibold">Decisão registrada</h3>
          <p className="text-on-light text-body-md mt-2">{approval.decision.note}</p>
          <p className="text-on-light-muted text-label-md mt-2 normal-case">
            {approval.decision.by} · {dateTime.format(new Date(approval.decision.at))}
          </p>
        </div>
      ) : (
        <form className="border-light-outline mt-6 rounded-lg border p-4" noValidate>
          <label
            htmlFor="decision-note"
            className="text-on-light-variant text-body-md font-semibold"
          >
            Justificativa da decisão
          </label>
          <p className="text-on-light-muted text-label-md mt-1 normal-case">
            Obrigatória — vai para o log de auditoria junto com o seu nome.
          </p>

          <textarea
            id="decision-note"
            rows={3}
            disabled={busy}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? 'decision-note-error' : undefined}
            placeholder="Ex.: liberado após reteste do freio aprovado; manter inspeção extra em 30 dias."
            className={cn(
              'text-body-md text-on-light placeholder:text-placeholder bg-light-container mt-3 w-full rounded-md border p-3',
              'focus-visible:ring-primary-on-light focus:outline-none focus-visible:ring-2',
              'disabled:opacity-60',
              errors.note ? 'border-error-on-light' : 'border-light-outline',
            )}
            {...register('note')}
          />

          {errors.note ? (
            <p
              id="decision-note-error"
              role="alert"
              className="text-error-on-light text-label-md mt-2 normal-case"
            >
              {errors.note.message}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <SpectrumButton
              type="button"
              variant="primary"
              disabled={busy || !pending}
              onClick={decide(true)}
            >
              {busy ? <Spinner label="Registrando" /> : <CheckIcon size={18} aria-hidden="true" />}
              Aprovar
            </SpectrumButton>

            <SpectrumButton
              type="button"
              variant="ghost"
              disabled={busy || !pending}
              onClick={decide(false)}
              /* Ghost é desenhado para o grafite: sobre o painel claro precisa
                 da borda e do texto escuros para não sumir. */
              className="border-light-outline text-on-light bg-light-container hover:bg-light hover:border-on-light-muted"
            >
              <BlockedIcon size={18} aria-hidden="true" />
              Recusar
            </SpectrumButton>
          </div>
        </form>
      )}
    </LightCard>
  );
}
