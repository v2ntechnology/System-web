import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRightIcon, FloppyDiskIcon, InfoIcon } from '@phosphor-icons/react';
import type { Anomaly, Diagnosis, DiagnosisCategory } from '@/management/types';
import { LightCard, SpectrumButton, Spinner, StatusChip, cn } from '@/management/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { dateTime } from '@/management/lib/format';
import { ApiError } from '@/management/mocks/latency';

import { saveDiagnosis } from '../api';
import { diagnosisSchema, stepsFromText, type DiagnosisValues } from '../schema';
import { SEVERITY_LABEL, SEVERITY_TONE } from '../severity';

export const CATEGORY_LABEL: Record<DiagnosisCategory, string> = {
  CUSTO: 'Custo',
  SEGURANCA: 'Segurança',
  MANUTENCAO: 'Manutenção',
  OPERACAO: 'Operação',
};

export interface DiagnosisDetailPanelProps {
  anomaly: Anomaly;
  diagnosis?: Diagnosis | undefined;
}

/**
 * Anomalia aberta, com o parecer do gestor.
 *
 * O propósito do módulo é que o número chegue ao dono **já explicado**: sem
 * parecer, ele vê a variação e não a causa, e o primeiro movimento vira uma
 * ligação cobrando explicação.
 *
 * Anomalia grave não tem a opção de rascunho — precisa subir.
 */
export function DiagnosisDetailPanel({ anomaly, diagnosis }: DiagnosisDetailPanelProps) {
  const queryClient = useQueryClient();
  const mustEscalate = anomaly.severity === 'GRAVE';
  const sent = diagnosis?.sentToOwner ?? false;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DiagnosisValues>({
    resolver: zodResolver(diagnosisSchema),
    defaultValues: { finding: '', actionPlan: '' },
  });

  /*
   * Ao trocar de anomalia, recarrega o parecer daquela — e não o texto que
   * estava sendo escrito para a anterior.
   */
  useEffect(() => {
    reset({
      finding: diagnosis?.finding ?? '',
      actionPlan: diagnosis?.actionPlan.join('\n') ?? '',
    });
  }, [anomaly.id, diagnosis, reset]);

  const mutation = useMutation({
    mutationFn: saveDiagnosis,
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['manager', 'anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['manager', 'diagnoses'] });
      queryClient.invalidateQueries({ queryKey: ['manager', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['owner', 'approvals'] });

      if (saved.sentToOwner) {
        toast.success('Parecer enviado ao proprietário', {
          description: 'Ele aparece agora na fila de aprovações do dono.',
        });
      } else {
        toast.success('Rascunho salvo', {
          description: 'O parecer fica com você até ser enviado.',
        });
      }
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.title : 'Não foi possível salvar', {
        description:
          error instanceof ApiError
            ? error.detail
            : 'Tente de novo em instantes. O parecer não foi gravado.',
      });
    },
  });

  const busy = isSubmitting || mutation.isPending;

  function submit(sendToOwner: boolean) {
    return handleSubmit((values) =>
      mutation
        .mutateAsync({
          anomalyId: anomaly.id,
          finding: values.finding,
          actionPlan: stepsFromText(values.actionPlan ?? ''),
          sendToOwner,
        })
        .catch(() => {
          /* Já comunicado no toast; o formulário permanece preenchido. */
        }),
    );
  }

  return (
    <LightCard
      title={anomaly.title}
      action={
        sent ? (
          <StatusChip tone="positive" surface="light">
            Enviado ao proprietário
          </StatusChip>
        ) : diagnosis ? (
          <StatusChip tone="neutral" surface="light">
            Rascunho
          </StatusChip>
        ) : (
          <StatusChip tone="attention" surface="light">
            Sem parecer
          </StatusChip>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="info" surface="light">
          {CATEGORY_LABEL[anomaly.category]}
        </StatusChip>
        <StatusChip tone={SEVERITY_TONE[anomaly.severity]} surface="light">
          Severidade {SEVERITY_LABEL[anomaly.severity].toLowerCase()}
        </StatusChip>
        <span className="text-on-light-muted text-label-md normal-case">
          Detectada em {dateTime.format(new Date(anomaly.detectedAt))}
        </span>
      </div>

      <p className="text-on-light text-body-md mt-4">{anomaly.description}</p>

      <h3 className="text-on-light-variant text-body-md mt-5 font-semibold">
        O que disparou a detecção
      </h3>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        {anomaly.evidence.map((item) => (
          <div key={item.label} className="bg-light-container min-w-0 rounded-md p-3">
            <dt className="text-on-light-muted text-label-md normal-case">{item.label}</dt>
            <dd className="tabular text-on-light mt-1 font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>

      {mustEscalate ? (
        <p className="bg-error-on-light/10 text-error-on-light text-body-md mt-5 flex items-start gap-2 rounded-lg p-3">
          <InfoIcon size={16} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
          Anomalia grave: o parecer precisa subir para o proprietário. Não há rascunho aqui.
        </p>
      ) : null}

      <form className="border-light-outline mt-6 rounded-lg border p-4" noValidate>
        <label
          htmlFor="diagnosis-finding"
          className="text-on-light-variant text-body-md font-semibold"
        >
          Causa apurada
        </label>
        <p className="text-on-light-muted text-label-md mt-1 normal-case">
          É o texto que o proprietário vai ler no lugar do número seco.
        </p>

        <textarea
          id="diagnosis-finding"
          rows={5}
          disabled={busy}
          aria-invalid={errors.finding ? true : undefined}
          aria-describedby={errors.finding ? 'diagnosis-finding-error' : undefined}
          placeholder="Ex.: a alta de custo fixo vem do reajuste do seguro da frota, contratado em março e diluído em menos quilômetros por causa das duas semanas de chuva."
          className={cn(
            'text-body-md text-on-light placeholder:text-on-light-muted bg-light-container mt-3 w-full rounded-md border p-3',
            'focus-visible:ring-primary-on-light focus:outline-none focus-visible:ring-2',
            'disabled:opacity-60',
            errors.finding ? 'border-error-on-light' : 'border-light-outline',
          )}
          {...register('finding')}
        />

        {errors.finding ? (
          <p
            id="diagnosis-finding-error"
            role="alert"
            className="text-error-on-light text-label-md mt-2 normal-case"
          >
            {errors.finding.message}
          </p>
        ) : null}

        <label
          htmlFor="diagnosis-plan"
          className="text-on-light-variant text-body-md mt-5 block font-semibold"
        >
          Plano de ação
        </label>
        <p className="text-on-light-muted text-label-md mt-1 normal-case">Um passo por linha.</p>

        <textarea
          id="diagnosis-plan"
          rows={4}
          disabled={busy}
          placeholder={
            'Renegociar a apólice na renovação de setembro\nReavaliar o custo fixo por km ao fim do trimestre'
          }
          className={cn(
            'text-body-md text-on-light placeholder:text-on-light-muted bg-light-container border-light-outline mt-3 w-full rounded-md border p-3',
            'focus-visible:ring-primary-on-light focus:outline-none focus-visible:ring-2',
            'disabled:opacity-60',
          )}
          {...register('actionPlan')}
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <SpectrumButton type="button" variant="primary" disabled={busy} onClick={submit(true)}>
            {busy ? (
              <Spinner label="Enviando" />
            ) : (
              <ArrowUpRightIcon size={18} weight="bold" aria-hidden="true" />
            )}
            Enviar ao proprietário
          </SpectrumButton>

          {!mustEscalate ? (
            <SpectrumButton
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={submit(false)}
              className="border-light-outline text-on-light bg-light-container hover:bg-light hover:border-on-light-muted"
            >
              <FloppyDiskIcon size={18} weight="bold" aria-hidden="true" />
              Salvar rascunho
            </SpectrumButton>
          ) : null}
        </div>

        {diagnosis ? (
          <p className="text-on-light-muted text-label-md mt-3 normal-case">
            Última atualização por {diagnosis.writtenBy} ·{' '}
            {dateTime.format(new Date(diagnosis.updatedAt))}
          </p>
        ) : null}
      </form>
    </LightCard>
  );
}
