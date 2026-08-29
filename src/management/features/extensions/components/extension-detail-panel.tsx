import {
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
  IntegrationIcon,
  LockIcon,
  PowerIcon,
  ShieldCheckIcon,
  WarningIcon,
} from '@/components/icons';
import type { Extension, IntegrationHealth } from '@/management/types';
import {
  GlassInput,
  LightCard,
  SpectrumButton,
  Spinner,
  StatusChip,
  cn,
  type StatusTone,
} from '@/management/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { useSession } from '@/management/features/auth/store';
import { brl, dateTime } from '@/management/lib/format';
import { ApiError } from '@/management/mocks/latency';

import { activateExtension, configureExtension, deactivateExtension } from '../api';
import { billingLabel, extensionMonthlyCost } from '../pricing';

const HEALTH_META: Record<IntegrationHealth, { label: string; tone: StatusTone }> = {
  OK: { label: 'Sincronizando', tone: 'positive' },
  ATRASADA: { label: 'Sincronização atrasada', tone: 'attention' },
  FALHA: { label: 'Falha na conexão', tone: 'critical' },
};

const STATUS_META: Record<Extension['status'], { label: string; tone: StatusTone }> = {
  DISPONIVEL: { label: 'Não contratada', tone: 'neutral' },
  AGUARDANDO_CONFIGURACAO: { label: 'Aguardando credenciais', tone: 'attention' },
  ATIVA: { label: 'Ativa', tone: 'positive' },
};

export interface ExtensionDetailPanelProps {
  extension: Extension;
  billableVehicles: number;
}

/**
 * Detalhe de uma extensão do marketplace.
 *
 * A ordem da tela é a ordem da decisão: o que ela faz, onde o dado aparece,
 * quanto custa — e só então o botão. Ativar é **contratar**, então o valor
 * aparece no próprio botão em vez de num rodapé que ninguém lê.
 */
export function ExtensionDetailPanel({ extension, billableVehicles }: ExtensionDetailPanelProps) {
  const queryClient = useQueryClient();
  const session = useSession();

  /*
   * Trocar de extensão não pode carregar credencial digitada para outra — quem
   * garante isso é o `key={extension.id}` na tela que monta este painel, que
   * remonta o componente e zera o estado sem efeito nenhum.
   */
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmingOff, setConfirmingOff] = useState(false);

  const contracted = session?.tenant.modules ?? [];
  const locked =
    Boolean(extension.requiredModule) && !contracted.includes(extension.requiredModule!);

  const monthly = extensionMonthlyCost(extension, billableVehicles);
  const status = STATUS_META[extension.status];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['extensions'] });
    /* Contratar muda a fatura e a lista de integrações — as duas leem daqui. */
    queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    queryClient.invalidateQueries({ queryKey: ['settings'] });
  }

  function onError(error: unknown) {
    toast.error(error instanceof ApiError ? error.title : 'Não foi possível concluir', {
      description:
        error instanceof ApiError ? error.detail : 'Tente de novo em instantes. Nada foi alterado.',
    });
  }

  const activate = useMutation({
    mutationFn: () => activateExtension(extension.id),
    onSuccess: (updated) => {
      invalidate();
      toast.success(`${updated.name} contratada`, {
        description:
          monthly > 0
            ? `${brl.format(monthly)} entram na sua próxima fatura. Cadastre as credenciais para começar a receber os dados.`
            : 'Cadastre as credenciais para começar a receber os dados.',
      });
    },
    onError,
  });

  const configure = useMutation({
    mutationFn: () => configureExtension({ extensionId: extension.id, values }),
    onSuccess: (updated) => {
      invalidate();
      setValues({});
      toast.success(`${updated.name} conectada`, {
        description: 'Os dados do fornecedor já aparecem no painel.',
      });
    },
    onError,
  });

  const deactivate = useMutation({
    mutationFn: () => deactivateExtension(extension.id),
    onSuccess: (updated) => {
      invalidate();
      setConfirmingOff(false);
      toast.info(`${updated.name} desativada`, {
        description: 'A cobrança para no próximo ciclo e a credencial foi revogada.',
      });
    },
    onError,
  });

  const busy = activate.isPending || configure.isPending || deactivate.isPending;

  return (
    <LightCard
      title={extension.name}
      action={
        <StatusChip tone={status.tone} surface="light">
          {status.label}
        </StatusChip>
      }
    >
      <p className="text-on-light-muted text-label-md normal-case">por {extension.vendor}</p>
      <p className="text-on-light text-body-md mt-3">{extension.description}</p>

      {extension.health ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusChip tone={HEALTH_META[extension.health].tone} surface="light">
            {HEALTH_META[extension.health].label}
          </StatusChip>
          {extension.lastSuccessfulSyncAt ? (
            <span className="text-on-light-muted text-label-md normal-case">
              última sincronização em {dateTime.format(new Date(extension.lastSuccessfulSyncAt))}
            </span>
          ) : null}
        </div>
      ) : null}

      {extension.healthNote ? (
        <p className="bg-warning-on-light/10 text-warning-on-light text-body-md mt-3 flex items-start gap-2 rounded-lg p-3">
          <WarningIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {extension.healthNote}
        </p>
      ) : null}

      <h3 className="text-on-light-variant text-body-md mt-5 font-semibold">O que ela traz</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {extension.capabilities.map((item) => (
          <li key={item} className="text-on-light text-body-md flex items-start gap-2">
            <CheckIcon
              size={16}
              className="text-success-on-light mt-1 shrink-0"
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>

      {/* Sem isto, "integrar" fica abstrato: o dono não sabe onde vai ver o dado. */}
      <h3 className="text-on-light-variant text-body-md mt-5 font-semibold">Aparece em</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {extension.surfacesIn.map((surface) => (
          <li key={surface}>
            <StatusChip tone="info" surface="light">
              {surface}
            </StatusChip>
          </li>
        ))}
      </ul>

      <div className="bg-light-container mt-5 flex flex-wrap items-baseline justify-between gap-3 rounded-lg p-4">
        <div className="min-w-0">
          <p className="text-on-light-muted text-label-md normal-case">Cobrança</p>
          <p className="text-on-light mt-1 font-semibold">
            {billingLabel(extension.billing, (value) => brl.format(value))}
          </p>
        </div>

        {extension.billing.model === 'POR_VEICULO' ? (
          <p className="tabular text-on-light-variant text-body-md">
            {brl.format(monthly)}
            <span className="text-on-light-muted"> / mês · {billableVehicles} veículos</span>
          </p>
        ) : null}
      </div>

      {/* --------------------------------------------------------------
       * Ações
       * ------------------------------------------------------------ */}
      {locked ? (
        <div className="border-light-outline mt-6 rounded-lg border p-4">
          <p className="text-on-light text-body-md flex items-start gap-2">
            <LockIcon
              size={18}
              className="text-warning-on-light mt-0.5 shrink-0"
              aria-hidden="true"
            />
            Esta extensão depende de um módulo que não está no seu plano. Fale com o time comercial
            para incluí-lo antes de contratar.
          </p>
          <Link
            to="/gestao/cobranca"
            className="text-primary-on-light text-label-md mt-3 inline-flex items-center gap-1.5 normal-case underline-offset-4 hover:underline"
          >
            Ver plano e cobrança
            <ArrowRightIcon size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : extension.status === 'DISPONIVEL' ? (
        <div className="mt-6">
          <SpectrumButton disabled={busy} onClick={() => activate.mutate()}>
            {activate.isPending ? (
              <Spinner label="Contratando" />
            ) : (
              <IntegrationIcon size={18} aria-hidden="true" />
            )}
            {monthly > 0 ? `Ativar por ${brl.format(monthly)}/mês` : 'Ativar'}
          </SpectrumButton>

          {/*
           * O aviso de cobrança fica ao lado do botão, não num rodapé: ativar é
           * assinar um serviço, e a consequência tem de estar onde a mão está.
           */}
          <p className="text-on-light-muted text-label-md mt-3 flex items-start gap-1.5 normal-case">
            <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {monthly > 0
              ? 'A ativação contrata o serviço e o valor entra na sua próxima fatura, proporcional ao ciclo.'
              : 'Inclusa no seu plano — a ativação não gera cobrança adicional.'}
          </p>
        </div>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              configure.mutate();
            }}
            className="border-light-outline mt-6 rounded-lg border p-4"
            noValidate
          >
            <h3 className="text-on-light-variant text-body-md font-semibold">
              Credenciais da conta {extension.name}
            </h3>
            <p className="text-on-light-muted text-label-md mt-1 normal-case">
              Pegue estes dados no portal do fornecedor.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {extension.credentialFields.map((field) => (
                <div
                  key={field.name}
                  className={cn('min-w-0', field.kind === 'secret' && 'sm:col-span-2')}
                >
                  <GlassInput
                    surface="light"
                    label={field.label}
                    hint={field.hint}
                    placeholder={field.placeholder}
                    /*
                     * `password` no campo de segredo: sem isso a chave fica na
                     * tela durante uma apresentação de resultados.
                     */
                    type={field.kind === 'secret' ? 'password' : 'text'}
                    autoComplete="off"
                    disabled={busy}
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                </div>
              ))}
            </div>

            {extension.configuredHint ? (
              <p className="text-on-light-variant text-label-md mt-4 flex items-center gap-1.5 normal-case">
                <ShieldCheckIcon size={14} className="text-success-on-light" aria-hidden="true" />
                Já configurada — {extension.configuredHint}. Preencha de novo só para substituir.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <SpectrumButton type="submit" disabled={busy}>
                {configure.isPending ? (
                  <Spinner label="Conectando" />
                ) : (
                  <IntegrationIcon size={18} aria-hidden="true" />
                )}
                {extension.configuredHint ? 'Substituir credenciais' : 'Conectar'}
              </SpectrumButton>
            </div>

            {/*
             * Onde a credencial fica. É a pergunta que todo dono faz antes de
             * colar uma chave de API num sistema de terceiro.
             */}
            <p className="text-on-light-muted text-label-md mt-4 flex items-start gap-1.5 normal-case">
              <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />A credencial é
              guardada cifrada no servidor do RookHub e nunca volta para esta tela — só a indicação
              dos últimos dígitos.
            </p>
          </form>

          <div className="border-light-outline mt-4 rounded-lg border p-4">
            {confirmingOff ? (
              <>
                <p className="text-on-light text-body-md">
                  Desativar {extension.name}? A cobrança para no próximo ciclo, a credencial é
                  revogada e o dado do fornecedor deixa de entrar no painel.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <SpectrumButton
                    disabled={busy}
                    onClick={() => deactivate.mutate()}
                    className="bg-error-on-light hover:bg-error-on-light/90 text-on-primary"
                  >
                    {deactivate.isPending ? (
                      <Spinner label="Desativando" />
                    ) : (
                      <PowerIcon size={18} aria-hidden="true" />
                    )}
                    Confirmar desativação
                  </SpectrumButton>
                  <SpectrumButton
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmingOff(false)}
                    className="border-light-outline text-on-light bg-light-container hover:bg-light hover:border-on-light-muted"
                  >
                    Manter ativa
                  </SpectrumButton>
                </div>
              </>
            ) : (
              <SpectrumButton
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmingOff(true)}
                /* Ghost é desenhado para o grafite: sobre o painel claro precisa
                   da borda e do texto escuros para não sumir. */
                className="border-light-outline text-on-light bg-light-container hover:bg-light hover:border-on-light-muted"
              >
                <PowerIcon size={18} aria-hidden="true" />
                Desativar extensão
              </SpectrumButton>
            )}
          </div>
        </>
      )}
    </LightCard>
  );
}
