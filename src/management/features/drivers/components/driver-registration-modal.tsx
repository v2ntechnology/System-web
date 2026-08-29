import {
  CameraIcon,
  IdCardIcon,
  InfoIcon,
  MinusCircleIcon,
  TruckIcon,
  UserIcon,
} from '@/components/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createDriver, fetchFleetSites } from '@/management/lib/fleet-api';
import {
  Alert,
  Checkbox,
  GlassDateField,
  GlassInput,
  GlassModal,
  GlassSelect,
  SpectrumButton,
  cn,
} from '@/management/ui';

import { ACCEPTED_TYPES, prepareDriverPhoto } from '../photo';
import {
  allowsTruck,
  CNH_CATEGORIES,
  daysUntilExpiry,
  DEFAULT_DRIVER_FORM,
  digitsOnly,
  driverRegistrationSchema,
  formatCpf,
  formatPhone,
  NO_SITE,
  type DriverRegistrationValues,
} from '../registration-schema';
import { DriverIdCard } from './driver-id-card';

/**
 * Cadastro de motorista, em diálogo sobre a lista.
 *
 * <h2>Por que modal e não tela própria</h2>
 *
 * Decisão do usuário em 27/08/2026. O trabalho real é conferir a lista suja que
 * veio da telemetria e ir cadastrando quem falta: sair da lista a cada pessoa
 * perderia a posição da rolagem e o filtro aplicado. O diálogo devolve a lista
 * exatamente onde estava.
 *
 * <h2>Quatro campos obrigatórios</h2>
 *
 * Nome, CPF, categoria e vencimento da CNH. A pergunta que o cadastro precisa
 * responder é operacional: esta pessoa pode assumir um caminhão hoje? Sem
 * categoria não responde; sem vencimento responde errado, porque vazio lê como
 * "está em dia".
 */
export interface DriverRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DriverRegistrationModal({ open, onOpenChange }: DriverRegistrationModalProps) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const sites = useQuery({
    queryKey: ['fleet-sites'],
    queryFn: fetchFleetSites,
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DriverRegistrationValues>({
    resolver: zodResolver(driverRegistrationSchema),
    defaultValues: DEFAULT_DRIVER_FORM,
  });

  const values = watch();

  const limpar = () => {
    reset(DEFAULT_DRIVER_FORM);
    setPhoto(null);
    setPhotoError(null);
  };

  const save = useMutation({
    mutationFn: (form: DriverRegistrationValues) =>
      createDriver({
        name: form.name.trim(),
        document: digitsOnly(form.document),
        phone: emptyToNull(form.phone),
        email: emptyToNull(form.email),
        license: form.license === '' ? null : digitsOnly(form.license),
        cnhCategory: form.cnhCategory,
        cnhExpiresAt: form.cnhExpiresAt,
        hiredAt: emptyToNull(form.hiredAt),
        siteId: form.siteId === NO_SITE ? null : emptyToNull(form.siteId),
        employeeNumber: emptyToNull(form.employeeNumber),
        manualNotes: emptyToNull(form.manualNotes),
        active: form.active,
        photo,
      }),

    onSuccess: (driver) => {
      toast.success(`${driver.name} foi cadastrado.`);

      /* A lista atrás do diálogo precisa recarregar, senão quem acabou de
         cadastrar volta para uma lista onde a pessoa não está. */
      void queryClient.invalidateQueries({ queryKey: ['driver-registry'] });
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: ['team'] });

      /* Cadastrar em lote é o caso normal: o diálogo continua aberto, limpo, e
         o foco volta ao nome, para a próxima pessoa entrar sem tirar a mão do
         teclado. Fechar a cada gravação obrigaria a reabrir trinta vezes. */
      limpar();
      setFocus('name');
    },
  });

  const escolherFoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    try {
      setPhoto(await prepareDriverPhoto(file));
    } catch (erro) {
      setPhoto(null);
      setPhotoError(erro instanceof Error ? erro.message : 'Não foi possível usar esta imagem.');
    }
  };

  const days = daysUntilExpiry(values.cnhExpiresAt);
  const expired = days != null && days < 0;
  const expiringSoon = days != null && days >= 0 && days <= 30;
  const truck = allowsTruck(values.cnhCategory);

  const siteOptions = [
    { value: NO_SITE, label: 'Sem filial definida' },
    ...(sites.data ?? []).map((site) => ({ value: site.id, label: site.name })),
  ];

  const siteName =
    values.siteId === NO_SITE
      ? null
      : ((sites.data ?? []).find((s) => s.id === values.siteId)?.name ?? null);

  return (
    <GlassModal
      open={open}
      onOpenChange={(next) => {
        if (!next) limpar();
        onOpenChange(next);
      }}
      title="Cadastrar motorista"
      description="O que a telemetria não sabe sobre a pessoa: CPF, habilitação, admissão e foto."
      /*
       * ⚠️ `max-w` precisa vir junto com `w`. O `GlassModal` traz
       * `max-w-3xl` (768px), e o `tailwind-merge` só substitui a MESMA
       * propriedade: mandar só a largura deixava o teto de 768px de pé e o
       * diálogo continuava estreito, com o nome truncando na carteira.
       *
       * 1180px é o que faz caber a grade de dois campos à esquerda e a
       * carteira inteira à direita sem espremer nenhuma das duas.
       */
      className="w-[calc(100vw-2rem)] max-w-[1180px]"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        noValidate
        onSubmit={handleSubmit((form) => save.mutate(form))}
      >
        {/*
         * O corpo é quem rola, e não o diálogo inteiro: é isso que mantém a
         * barra de ações colada embaixo. `min-h-0` é obrigatório, senão o
         * filho flex se recusa a encolher e a barra é empurrada para fora da
         * área visível.
         */}
        <div className="grid min-h-0 flex-1 gap-x-8 gap-y-7 overflow-y-auto px-5 pb-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-7">
            <Section
              step={1}
              title="Identificação"
              description="O CPF é o que vai casar este cadastro com o motorista da telemetria mais adiante."
              icon={<UserIcon size={16} aria-hidden="true" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassInput
                  label="Nome completo"
                  autoComplete="off"
                  placeholder="Antônio Ferreira da Silva"
                  error={errors.name?.message}
                  {...register('name')}
                  className="sm:col-span-2"
                />

                <Controller
                  control={control}
                  name="document"
                  render={({ field }) => (
                    <GlassInput
                      label="CPF"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000.000.000-00"
                      hint="Conferido pelo dígito verificador"
                      error={errors.document?.message}
                      value={formatCpf(field.value)}
                      onChange={(event) => field.onChange(formatCpf(event.target.value))}
                      onBlur={field.onBlur}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <GlassInput
                      label="Telefone"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="(00) 00000-0000"
                      error={errors.phone?.message}
                      value={formatPhone(field.value)}
                      onChange={(event) => field.onChange(formatPhone(event.target.value))}
                      onBlur={field.onBlur}
                    />
                  )}
                />

                <GlassInput
                  label="E-mail"
                  type="email"
                  autoComplete="off"
                  placeholder="nome@empresa.com.br"
                  error={errors.email?.message}
                  {...register('email')}
                  className="sm:col-span-2"
                />
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Foto                                                          */}
              {/* ------------------------------------------------------------ */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="sr-only"
                  onChange={(event) => {
                    void escolherFoto(event.target.files?.[0]);
                    /* Zerar permite reescolher o MESMO arquivo depois de um erro:
                     sem isto o `change` não dispara na segunda vez. */
                    event.target.value = '';
                  }}
                />

                <SpectrumButton
                  type="button"
                  variant="secondary"
                  onClick={() => fileInput.current?.click()}
                >
                  <CameraIcon size={15} aria-hidden="true" />
                  {photo ? 'Trocar foto' : 'Adicionar foto'}
                </SpectrumButton>

                {photo ? (
                  <SpectrumButton type="button" variant="ghost" onClick={() => setPhoto(null)}>
                    <MinusCircleIcon size={15} aria-hidden="true" />
                    Remover
                  </SpectrumButton>
                ) : null}

                <p className="text-on-surface-muted text-label-md normal-case">
                  Cortada em quadrado e reduzida aqui no navegador
                </p>
              </div>

              {photoError ? <Alert severity="error">{photoError}</Alert> : null}
            </Section>

            <Section
              step={2}
              title="Habilitação"
              description="Responde a pergunta operacional: esta pessoa pode assumir um caminhão hoje?"
              icon={<IdCardIcon size={16} aria-hidden="true" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="cnhCategory"
                  render={({ field }) => (
                    <GlassSelect
                      label="Categoria da CNH"
                      options={[...CNH_CATEGORIES]}
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.cnhCategory?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="cnhExpiresAt"
                  render={({ field }) => (
                    <GlassDateField
                      label="Vencimento da CNH"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.cnhExpiresAt?.message}
                    />
                  )}
                />

                <GlassInput
                  label="Número da CNH"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="11 dígitos"
                  hint="Opcional"
                  error={errors.license?.message}
                  {...register('license')}
                  className="sm:col-span-2"
                />
              </div>

              {/* Avisa, não bloqueia: quem está renovando a via precisa conseguir
                cadastrar a pessoa mesmo assim. */}
              {expired ? (
                <Alert severity="error">
                  CNH vencida há {Math.abs(days)} dia{Math.abs(days) === 1 ? '' : 's'}. O cadastro é
                  permitido, e a pessoa fica sinalizada até a data ser atualizada.
                </Alert>
              ) : expiringSoon ? (
                <Alert severity="warning">
                  Vence em {days} dia{days === 1 ? '' : 's'}. Vale programar a renovação antes de
                  escalar para viagem longa.
                </Alert>
              ) : null}

              {!truck ? (
                <Alert severity="info">
                  A categoria {values.cnhCategory} não habilita caminhão. O cadastro segue válido
                  para quem conduz carro ou utilitário da operação.
                </Alert>
              ) : null}
            </Section>

            <Section
              step={3}
              title="Vínculo com a operação"
              description="Onde a pessoa trabalha e desde quando. Tudo opcional."
              icon={<TruckIcon size={16} aria-hidden="true" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {siteOptions.length > 1 ? (
                  <Controller
                    control={control}
                    name="siteId"
                    render={({ field }) => (
                      <GlassSelect
                        label="Filial"
                        options={siteOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    )}
                  />
                ) : null}

                <GlassInput
                  label="Matrícula"
                  autoComplete="off"
                  placeholder="Código interno do RH"
                  error={errors.employeeNumber?.message}
                  {...register('employeeNumber')}
                />

                <Controller
                  control={control}
                  name="hiredAt"
                  render={({ field }) => (
                    <GlassDateField
                      label="Data de admissão"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.hiredAt?.message}
                    />
                  )}
                />

                <GlassInput
                  label="Observação interna"
                  autoComplete="off"
                  placeholder="Restrição de rota, curso de MOPP…"
                  hint="A sincronização nunca sobrescreve"
                  error={errors.manualNotes?.message}
                  {...register('manualNotes')}
                />
              </div>

              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <Checkbox
                    label="Disponível para escala"
                    description="Desmarque para quem ainda não começou ou está afastado."
                    checked={field.value}
                    onCheckedChange={(marcado) => field.onChange(marcado === true)}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Section>

            {save.isError ? (
              <Alert severity="error">
                {save.error instanceof Error
                  ? save.error.message
                  : 'Não foi possível cadastrar. Tente de novo.'}
              </Alert>
            ) : null}
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Carteira                                                        */}
          {/* -------------------------------------------------------------- */}
          {/*
           * Gruda no topo enquanto o formulário rola: a carteira é referência, e
           * referência que sai da tela na terceira seção não serve para conferir
           * o que foi digitado na primeira.
           */}
          <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
            <p className="text-on-surface-variant text-label-md normal-case">
              Como esta pessoa vai ficar
            </p>

            <DriverIdCard
              name={values.name}
              document={values.document}
              cnhCategory={values.cnhCategory}
              cnhExpiresAt={values.cnhExpiresAt}
              siteName={siteName}
              employeeNumber={values.employeeNumber}
              phone={values.phone}
              active={values.active}
              photo={photo}
            />
          </aside>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Barra de ações                                                  */}
        {/* -------------------------------------------------------------- */}
        {/*
         * Fixa no rodapé, e não no fim do formulário.
         *
         * São doze campos em quatro blocos: com a ação rolando junto, quem
         * termina de preencher precisa procurar o botão, e quem sobe para
         * conferir um campo perde o botão de vista. Colada embaixo, a ação de
         * confirmar está sempre a um clique, que é o que uma tela de trabalho
         * repetitivo pede.
         *
         * `shrink-0` para a barra não ser comprimida quando o corpo cresce, e
         * a superfície opaca porque o conteúdo passa por baixo dela ao rolar.
         */}
        {/*
         * A sombra para cima não é enfeite: a barra de rolagem é invisível no
         * sistema inteiro (decisão do usuário em 19/08/2026), então o conteúdo
         * passando por baixo da barra é a única pista de que ainda há
         * formulário abaixo. Sem ela, o corte no fim da área rolável lê como
         * fim do conteúdo.
         */}
        <div className="border-outline-variant bg-surface-low flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t px-5 py-4 shadow-[0_-10px_22px_-14px_rgba(0,0,0,0.45)] sm:px-6">
          {/* Escondido no estreito: em 390px de largura o texto ocupa três
              linhas e rouba a altura que o formulário não tem de sobra. Quem
              cadastra em lote descobre o comportamento na primeira gravação. */}
          <p className="text-on-surface-muted text-label-md hidden min-w-0 items-start gap-1.5 normal-case sm:flex">
            <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Ao gravar, o formulário limpa e o diálogo continua aberto para a próxima pessoa
          </p>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SpectrumButton
              type="button"
              variant="ghost"
              onClick={limpar}
              disabled={isSubmitting || save.isPending}
            >
              Limpar
            </SpectrumButton>
            <SpectrumButton type="submit" disabled={isSubmitting || save.isPending}>
              {save.isPending ? 'Cadastrando…' : 'Cadastrar motorista'}
            </SpectrumButton>
          </div>
        </div>
      </form>
    </GlassModal>
  );
}

/* -------------------------------------------------------------------------- */
/* Peças                                                                       */
/* -------------------------------------------------------------------------- */

const emptyToNull = (input: string): string | null => {
  const trimmed = input.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Um bloco do formulário.
 *
 * A numeração carrega informação. O formulário tem uma ordem de preenchimento:
 * identificar a pessoa, conferir se ela pode dirigir e ligar à operação. Quem
 * chega na seção 2 sabe quanto falta.
 */
function Section({
  step,
  title,
  description,
  icon,
  children,
  className,
}: {
  step: number;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-4 border-0 p-0', className)}>
      <legend className="sr-only">{title}</legend>

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-primary-strong/10 text-primary-strong ring-primary-strong/20 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1"
        >
          {icon}
        </span>

        <div className="min-w-0">
          <h3 className="text-on-surface text-title-sm font-sora flex items-baseline gap-2 font-semibold">
            <span className="text-on-surface-muted text-label-md tabular font-normal">{step}</span>
            {title}
          </h3>
          <p className="text-on-surface-muted text-label-md normal-case">{description}</p>
        </div>
      </div>

      {children}
    </fieldset>
  );
}
