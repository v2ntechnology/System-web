import {
  CameraIcon,
  EraserIcon,
  IdCardIcon,
  InfoIcon,
  MapPinIcon,
  MinusCircleIcon,
  ShieldCheckIcon,
  TruckIcon,
  UserIcon,
} from '@/components/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  createDriver,
  fetchDriverRegistryEntry,
  fetchFleetCompanies,
  updateDriver,
} from '@/management/lib/fleet-api';
import {
  Alert,
  Checkbox,
  GlassDateField,
  GlassInput,
  GlassModal,
  GlassSelect,
  SpectrumButton,
  WizardSteps,
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
  EMPLOYMENT_TYPES,
  UF_LIST,
  formatCep,
  formatCpf,
  formatPhone,
  NO_COMPANY,
  type DriverRegistrationValues,
} from '../registration-schema';

/**
 * Cadastro e edição de motorista, em diálogo sobre a lista.
 *
 * <h2>Por que modal e não tela própria</h2>
 *
 * Decisão do usuário em 27/08/2026. O trabalho real é percorrer a lista e ir
 * corrigindo pessoa por pessoa: sair da lista a cada uma perderia a posição da
 * rolagem e o filtro aplicado. O diálogo devolve a lista exatamente onde estava.
 *
 * <h2>Um formulário para os dois verbos</h2>
 *
 * O mesmo diálogo cria e edita, porque os campos são exatamente os mesmos.
 * Manter dois arquivos faria a categoria de CNH ganhar uma opção nova em um e
 * não no outro, e o defeito só apareceria em quem usa o caminho menos comum.
 * O que muda entre os dois é o comportamento depois de gravar, e está anotado
 * no `onSuccess`.
 *
 * <h2>Quatro campos obrigatórios</h2>
 *
 * Nome, CPF, categoria e vencimento da CNH. A pergunta que o cadastro precisa
 * responder é operacional: esta pessoa pode assumir um caminhão hoje? Sem
 * categoria não responde; sem vencimento responde errado, porque vazio lê como
 * "está em dia".
 *
 * ⚠️ Isso vale na edição também, e é sentido de propósito: quem veio da
 * telemetria chega sem CPF nenhum, porque a MiX não tem o campo. Salvar a ficha
 * é justamente o momento de preencher. Quem só precisa desligar alguém sem ter
 * o CPF em mãos usa o atalho de inativar na linha da lista, que não passa por
 * aqui.
 */
/**
 * As etapas do cadastro, e os campos de cada uma.
 *
 * ⚠️ A lista de campos existe para duas coisas, e as duas são o que separa um
 * formulário em passos de um formulário quebrado em pedaços:
 *
 *   * marcar na barra a etapa que tem erro, para quem clicou em cadastrar e
 *     não viu nada acontecer saber para onde olhar;
 *   * validar só o passo atual ao avançar, em vez de acusar o CPF em branco
 *     enquanto a pessoa ainda está preenchendo o nome.
 */
const ETAPAS = [
  {
    id: 'identificacao',
    label: 'Identificação',
    campos: ['name', 'document', 'phone', 'email', 'rg', 'rgIssuer', 'birthDate'],
  },
  {
    id: 'habilitacao',
    label: 'Habilitação',
    campos: [
      'cnhCategory',
      'cnhExpiresAt',
      'cnhNumber',
      'cnhFirstLicensedAt',
      'moppExpiresAt',
      'license',
      'cnhEar',
    ],
  },
  {
    id: 'aptidao',
    label: 'Aptidão',
    campos: ['toxicologyExpiresAt', 'toxicologyExamAt', 'asoExpiresAt'],
  },
  {
    id: 'contato',
    label: 'Contato',
    campos: [
      'emergencyContactName',
      'emergencyContactPhone',
      'addressZip',
      'addressStreet',
      'addressNumber',
      'addressComplement',
      'addressDistrict',
      'addressCity',
      'addressState',
    ],
  },
  {
    id: 'vinculo',
    label: 'Vínculo',
    campos: [
      'companyId',
      'employmentType',
      'employeeNumber',
      'pis',
      'dismissedAt',
      'hiredAt',
      'manualNotes',
      'active',
    ],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  campos: readonly (keyof DriverRegistrationValues)[];
}[];

type EtapaId = (typeof ETAPAS)[number]['id'];

export interface DriverRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Identificador do motorista a editar. Nulo abre em modo de cadastro.
   *
   * ⚠️ Quem controla é a lista, e não este componente: manter o estado lá
   * permite que a linha clicada decida o que abrir, e o diálogo não precisa
   * saber que a lista existe.
   */
  driverId?: string | null | undefined;
}

export function DriverRegistrationModal({
  open,
  onOpenChange,
  driverId = null,
}: DriverRegistrationModalProps) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<EtapaId>('identificacao');
  const corpo = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const editing = driverId != null;

  const companies = useQuery({
    queryKey: ['fleet-companies'],
    queryFn: fetchFleetCompanies,
    staleTime: 5 * 60 * 1000,
  });

  const entry = useQuery({
    queryKey: ['driver-registry-entry', driverId],
    queryFn: () => fetchDriverRegistryEntry(driverId as string),
    enabled: open && editing,
  });

  /**
   * A ficha gravada, traduzida para o formato do formulário.
   *
   * ⚠️ Nulo vira string vazia, e não `undefined`. Os campos são controlados, e
   * `undefined` faz o React trocar um input controlado por não controlado no
   * meio do caminho: o aviso aparece no console e o campo para de responder ao
   * `reset`.
   */
  const loaded = useMemo<DriverRegistrationValues | undefined>(() => {
    const ficha = entry.data;
    if (!ficha) return undefined;

    return {
      name: ficha.name,
      document: formatCpf(ficha.document ?? ''),
      phone: formatPhone(ficha.phone ?? ''),
      email: ficha.email ?? '',
      license: ficha.license ?? '',
      cnhCategory: ficha.cnhCategory ?? DEFAULT_DRIVER_FORM.cnhCategory,
      cnhExpiresAt: ficha.cnhExpiresAt ?? '',
      hiredAt: ficha.hiredAt ?? '',

      rg: ficha.rg ?? '',
      rgIssuer: ficha.rgIssuer ?? '',
      birthDate: ficha.birthDate ?? '',

      cnhNumber: ficha.cnhNumber ?? '',
      cnhFirstLicensedAt: ficha.cnhFirstLicensedAt ?? '',
      cnhEar: ficha.cnhEar,
      moppExpiresAt: ficha.moppExpiresAt ?? '',

      toxicologyExamAt: ficha.toxicologyExamAt ?? '',
      toxicologyExpiresAt: ficha.toxicologyExpiresAt ?? '',
      asoExpiresAt: ficha.asoExpiresAt ?? '',

      emergencyContactName: ficha.emergencyContactName ?? '',
      emergencyContactPhone: formatPhone(ficha.emergencyContactPhone ?? ''),
      addressZip: formatCep(ficha.addressZip ?? ''),
      addressStreet: ficha.addressStreet ?? '',
      addressNumber: ficha.addressNumber ?? '',
      addressComplement: ficha.addressComplement ?? '',
      addressDistrict: ficha.addressDistrict ?? '',
      addressCity: ficha.addressCity ?? '',
      addressState: ficha.addressState ?? '',

      employmentType: ficha.employmentType ?? '',
      pis: ficha.pis ?? '',
      dismissedAt: ficha.dismissedAt ?? '',

      companyId: ficha.companyId ?? NO_COMPANY,
      employeeNumber: ficha.employeeNumber ?? '',
      manualNotes: ficha.manualNotes ?? '',
      active: ficha.active,
    };
  }, [entry.data]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setFocus,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<DriverRegistrationValues>({
    resolver: zodResolver(driverRegistrationSchema),
    defaultValues: DEFAULT_DRIVER_FORM,
    /*
     * `values` em vez de um efeito que chama `reset` quando a consulta responde.
     *
     * ⚠️ As regras do React Hooks são erro neste projeto, e sincronizar dado
     * externo com `useEffect` mais `setState` é justamente o padrão que elas
     * recusam. O `values` do próprio react-hook-form faz a mesma coisa sem
     * render extra.
     *
     * `keepDirtyValues` protege quem já está digitando: sem ele, uma revalidação
     * da consulta no meio da edição jogaria fora o que a pessoa escreveu.
     *
     * ⚠️ Espalhado, e não `values: loaded`. O `exactOptionalPropertyTypes` está
     * ligado, e passar `undefined` explicitamente em campo opcional é erro de
     * tipo: no modo de cadastro a chave não pode existir, e não pode existir
     * valendo `undefined`.
     */
    ...(loaded ? { values: loaded } : {}),
    resetOptions: { keepDirtyValues: true },
  });

  const values = watch();

  const indiceDaEtapa = ETAPAS.findIndex((e) => e.id === etapa);
  const ultimaEtapa = indiceDaEtapa === ETAPAS.length - 1;

  /**
   * O botão principal avança enquanto há etapa pela frente, e só grava na
   * última.
   *
   * ⚠️ Vale apenas no CADASTRO. Na edição ele grava de qualquer etapa: quem
   * abriu para corrigir o telefone não pode ser obrigado a passar por outras
   * quatro telas para salvar uma linha.
   */
  const avancando = !editing && !ultimaEtapa;

  const irPara = (destino: EtapaId) => {
    setEtapa(destino);
    /* O corpo volta ao topo: sem isto, entrar numa etapa curta vindo do fim de
       uma longa mostra a nova etapa já rolada, e ela parece cortada. */
    corpo.current?.scrollTo({ top: 0 });
  };

  /**
   * Avança validando SÓ o passo atual.
   *
   * ⚠️ `trigger` com a lista de campos, e não sem argumento: sem ela, sair da
   * primeira etapa acusaria o vencimento da CNH em branco, que é um campo que
   * a pessoa ainda nem viu.
   */
  const proxima = async () => {
    const atual = ETAPAS[indiceDaEtapa];
    const seguinte = ETAPAS[indiceDaEtapa + 1];
    if (!atual || !seguinte) return;
    const valido = await trigger([...atual.campos]);
    if (valido) irPara(seguinte.id);
  };

  const anterior = () => {
    const previa = ETAPAS[indiceDaEtapa - 1];
    if (previa) irPara(previa.id);
  };

  /* A etapa que tem campo com erro ganha a marca na barra. */
  const etapaComErro = (id: EtapaId): boolean => {
    const alvo = ETAPAS.find((e) => e.id === id);
    return alvo ? alvo.campos.some((campo) => errors[campo] != null) : false;
  };

  const limpar = () => {
    irPara('identificacao');
    reset(DEFAULT_DRIVER_FORM);
    setPhoto(null);
    setPhotoError(null);
  };

  const save = useMutation({
    mutationFn: (form: DriverRegistrationValues) => {
      const corpo = {
        name: form.name.trim(),
        document: digitsOnly(form.document),
        phone: emptyToNull(form.phone),
        email: emptyToNull(form.email),
        license: form.license === '' ? null : digitsOnly(form.license),
        cnhCategory: form.cnhCategory,
        cnhExpiresAt: form.cnhExpiresAt,
        hiredAt: emptyToNull(form.hiredAt),

        rg: emptyToNull(form.rg),
        rgIssuer: emptyToNull(form.rgIssuer),
        birthDate: emptyToNull(form.birthDate),

        cnhNumber: form.cnhNumber === '' ? null : digitsOnly(form.cnhNumber),
        cnhFirstLicensedAt: emptyToNull(form.cnhFirstLicensedAt),
        cnhEar: form.cnhEar,
        moppExpiresAt: emptyToNull(form.moppExpiresAt),

        toxicologyExamAt: emptyToNull(form.toxicologyExamAt),
        toxicologyExpiresAt: emptyToNull(form.toxicologyExpiresAt),
        asoExpiresAt: emptyToNull(form.asoExpiresAt),

        emergencyContactName: emptyToNull(form.emergencyContactName),
        emergencyContactPhone:
          form.emergencyContactPhone === '' ? null : digitsOnly(form.emergencyContactPhone),
        addressZip: form.addressZip === '' ? null : digitsOnly(form.addressZip),
        addressStreet: emptyToNull(form.addressStreet),
        addressNumber: emptyToNull(form.addressNumber),
        addressComplement: emptyToNull(form.addressComplement),
        addressDistrict: emptyToNull(form.addressDistrict),
        addressCity: emptyToNull(form.addressCity),
        addressState: emptyToNull(form.addressState),

        employmentType: emptyToNull(form.employmentType),
        pis: form.pis === '' ? null : digitsOnly(form.pis),
        dismissedAt: emptyToNull(form.dismissedAt),

        companyId: form.companyId === NO_COMPANY ? null : emptyToNull(form.companyId),
        employeeNumber: emptyToNull(form.employeeNumber),
        manualNotes: emptyToNull(form.manualNotes),
        active: form.active,
        photo,
      };

      return editing ? updateDriver(driverId as string, corpo) : createDriver(corpo);
    },

    onSuccess: (driver) => {
      /* A lista atrás do diálogo precisa recarregar, senão quem acabou de
         gravar volta para uma lista que não mostra a mudança. */
      void queryClient.invalidateQueries({ queryKey: ['driver-registry'] });
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: ['team'] });

      if (editing) {
        toast.success(`${driver.name} foi atualizado.`);
        void queryClient.invalidateQueries({ queryKey: ['driver-registry-entry', driverId] });
        /* Editar é uma pessoa de cada vez: o diálogo fecha e devolve a lista.
           Deixar aberto obrigaria a fechar à mão depois de cada correção. */
        onOpenChange(false);
        return;
      }

      toast.success(`${driver.name} foi cadastrado.`);

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

  const companyOptions = [
    { value: NO_COMPANY, label: 'Sem empresa definida' },
    ...(companies.data ?? []).map((company) => ({ value: company.id, label: company.name })),
  ];

  /* Enquanto a ficha não chegou, o formulário mostraria os padrões de um
     cadastro novo, e quem abriu para editar leria isso como "o cadastro está
     vazio". Bloquear a gravação até carregar evita salvar por cima com os
     padrões. */
  const loading = editing && entry.isPending;

  return (
    <GlassModal
      open={open}
      onOpenChange={(next) => {
        if (!next) limpar();
        onOpenChange(next);
      }}
      title={editing ? 'Editar motorista' : 'Cadastrar motorista'}
      description={
        editing
          ? 'A partir do primeiro salvamento, a sincronização com a telemetria não sobrescreve mais este cadastro.'
          : undefined
      }
      /*
       * ⚠️ `max-w` precisa vir junto com `w`. O `GlassModal` traz `max-w-3xl`
       * (768px), e o `tailwind-merge` só substitui a MESMA propriedade: mandar
       * só a largura deixava o teto de 768px de pé e o diálogo continuava
       * estreito, com o nome truncando.
       *
       * 720px é o que a grade de dois campos pede. Era 1180px enquanto existia
       * a carteira de pré-visualização à direita; sem ela, a largura antiga
       * deixava cada campo com o dobro da medida confortável de leitura.
       */
      className={cn(
        'w-[calc(100vw-2rem)] max-w-[720px]',
        /* Altura fixa pelo mesmo motivo do cadastro de caminhão: sem ela,
           trocar de etapa move a barra de ações embaixo do cursor. */
        'h-[min(46rem,calc(100dvh-4rem))]',
      )}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        noValidate
        onSubmit={handleSubmit((form) => {
          /* Enter no meio do cadastro avança, e não grava pela metade. */
          if (avancando) {
            void proxima();
            return;
          }
          save.mutate(form);
        })}
      >
        {/*
         * ⚠️ A barra de etapas fica FORA do corpo que rola. É ela que responde
         * "onde estou e quanto falta", e uma barra que sobe com a rolagem some
         * justamente quando a pergunta aparece.
         */}
        <WizardSteps
          steps={ETAPAS.map((e) => ({
            id: e.id,
            label: e.label,
            invalid: etapaComErro(e.id),
          }))}
          value={etapa}
          onValueChange={irPara}
          label="Etapas do cadastro"
          className="border-outline-variant mb-5 border-b px-5 pb-3 sm:px-6"
        />

        {/*
         * O corpo é quem rola, e não o diálogo inteiro: é isso que mantém a
         * barra de ações colada embaixo. `min-h-0` é obrigatório, senão o
         * filho flex se recusa a encolher e a barra é empurrada para fora da
         * área visível.
         */}
        <div
          ref={corpo}
          className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-5 pb-7 sm:px-6"
        >
          {entry.isError ? (
            <Alert severity="error">
              Não foi possível carregar o cadastro. Feche e tente de novo.
            </Alert>
          ) : null}

          {/*
           * Limpar mora no corpo, e não no rodapé (decisão do usuário em
           * 30/08/2026).
           *
           * O rodapé é a barra de decisão do diálogo: sair sem gravar, ou
           * gravar. Limpar não é nenhuma das duas, é uma ação sobre o formulário,
           * e ficava lado a lado com elas competindo por um clique que custa
           * caro. Aqui ela está junto do que de fato apaga, ancorada à direita
           * do primeiro campo.
           *
           * Só em cadastro: na edição não existe "estado limpo" para voltar, o
           * formulário nasce preenchido com a ficha gravada, e um botão que
           * zerasse tudo seria uma armadilha.
           */}
          {!editing ? (
            <div className="-mb-4 flex justify-end">
              <button
                type="button"
                onClick={limpar}
                disabled={isSubmitting || save.isPending}
                className="text-on-surface-muted hover:text-on-surface hover:bg-on-surface/[0.06] rounded-pill focus-visible:ring-secondary text-label-md flex items-center gap-1.5 px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <EraserIcon size={14} aria-hidden="true" />
                Limpar formulário
              </button>
            </div>
          ) : null}

          {etapa === 'identificacao' ? (
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

                <GlassInput
                  label="RG"
                  autoComplete="off"
                  placeholder="12.345.678-9"
                  error={errors.rg?.message}
                  {...register('rg')}
                />

                <GlassInput
                  label="Órgão emissor"
                  autoComplete="off"
                  placeholder="DETRAN-RJ"
                  error={errors.rgIssuer?.message}
                  {...register('rgIssuer')}
                />

                <Controller
                  control={control}
                  name="birthDate"
                  render={({ field }) => (
                    <GlassDateField
                      label="Data de nascimento"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.birthDate?.message}
                    />
                  )}
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

                {/*
                 * ⚠️ `ghost`, e não `secondary`. O `secondary` é cyan cheio e
                 * existe para telas com **duas escolhas equivalentes** (ver a nota
                 * no `SpectrumButton`); a foto é opcional. Cheio de cyan, este
                 * botão era o elemento mais forte do diálogo, mais forte que
                 * "Cadastrar motorista", que é o motivo do diálogo existir.
                 */}
                <SpectrumButton
                  type="button"
                  variant="ghost"
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
                  {/* Na edição, não escolher foto significa "não mexi". A foto que
                      já está gravada continua onde está: o formulário abre sem
                      carregar os bytes dela, e tratar a ausência como remoção
                      apagaria a foto de quem só corrigiu um telefone. */}
                  {editing
                    ? 'Escolha uma imagem só para substituir a atual'
                    : 'Cortada em quadrado e reduzida aqui no navegador'}
                </p>
              </div>

              {photoError ? <Alert severity="error">{photoError}</Alert> : null}
            </Section>
          ) : null}

          {etapa === 'habilitacao' ? (
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
                  label="Registro da CNH"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12345678901"
                  hint="11 dígitos, do documento"
                  error={errors.cnhNumber?.message}
                  {...register('cnhNumber')}
                />

                <Controller
                  control={control}
                  name="cnhFirstLicensedAt"
                  render={({ field }) => (
                    <GlassDateField
                      label="Primeira habilitação"
                      hint="Seguradora costuma exigir tempo mínimo"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.cnhFirstLicensedAt?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="moppExpiresAt"
                  render={({ field }) => (
                    <GlassDateField
                      label="MOPP vence em"
                      hint="Produtos perigosos. Vazio quando não tem o curso"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.moppExpiresAt?.message}
                    />
                  )}
                />

                {/* ⚠️ O identificador da telemetria, e NÃO o registro do
                    documento. É por ele que a viagem casa com a pessoa: vem do
                    que o cliente cadastrou no fornecedor (cartão, tag), e mudar
                    um pelo outro quebraria a reconciliação. */}
                <GlassInput
                  label="Identificação na telemetria"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="11 dígitos"
                  hint="O que o fornecedor usa para reconhecer a pessoa"
                  error={errors.license?.message}
                  {...register('license')}
                />

                <Controller
                  control={control}
                  name="cnhEar"
                  render={({ field }) => (
                    <Checkbox
                      label="Tem EAR na CNH"
                      description="Exerce Atividade Remunerada. Sem a observação, dirigir profissionalmente é infração grave, mesmo com a categoria certa."
                      checked={field.value}
                      onCheckedChange={(marcado) => field.onChange(marcado === true)}
                      className="sm:col-span-2"
                    />
                  )}
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
          ) : null}

          {etapa === 'aptidao' ? (
            <Section
              step={3}
              title="Aptidão"
              description="As duas datas que tiram o caminhão da rua. Vencido não dirige, e a empresa responde junto."
              icon={<ShieldCheckIcon size={16} aria-hidden="true" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {/* ⚠️ Obrigatório por lei para C, D e E, com validade de dois anos
                    e meio. É a data que mais tira caminhão da rua depois da CNH. */}
                <Controller
                  control={control}
                  name="toxicologyExpiresAt"
                  render={({ field }) => (
                    <GlassDateField
                      label="Toxicológico vence em"
                      hint="Obrigatório para C, D e E"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.toxicologyExpiresAt?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="toxicologyExamAt"
                  render={({ field }) => (
                    <GlassDateField
                      label="Data do exame"
                      hint="Quando foi colhido"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.toxicologyExamAt?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="asoExpiresAt"
                  render={({ field }) => (
                    <GlassDateField
                      label="ASO vence em"
                      hint="Atestado de saúde ocupacional"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.asoExpiresAt?.message}
                    />
                  )}
                />
              </div>
            </Section>
          ) : null}

          {etapa === 'contato' ? (
            <Section
              step={4}
              title="Contato e endereço"
              description="Quem avisar se acontecer alguma coisa na estrada, e onde a pessoa mora."
              icon={<MapPinIcon size={16} aria-hidden="true" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassInput
                  label="Contato de emergência"
                  autoComplete="off"
                  placeholder="Maria Ferreira da Silva"
                  error={errors.emergencyContactName?.message}
                  {...register('emergencyContactName')}
                />

                <Controller
                  control={control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <GlassInput
                      label="Telefone de emergência"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="(00) 00000-0000"
                      error={errors.emergencyContactPhone?.message}
                      value={formatPhone(field.value)}
                      onChange={(event) => field.onChange(formatPhone(event.target.value))}
                      onBlur={field.onBlur}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="addressZip"
                  render={({ field }) => (
                    <GlassInput
                      label="CEP"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="26200-000"
                      error={errors.addressZip?.message}
                      value={formatCep(field.value)}
                      onChange={(event) => field.onChange(formatCep(event.target.value))}
                      onBlur={field.onBlur}
                    />
                  )}
                />

                <GlassInput
                  label="Logradouro"
                  autoComplete="off"
                  placeholder="Rua das Acácias"
                  error={errors.addressStreet?.message}
                  {...register('addressStreet')}
                />

                <GlassInput
                  label="Número"
                  autoComplete="off"
                  placeholder="120"
                  error={errors.addressNumber?.message}
                  {...register('addressNumber')}
                />

                <GlassInput
                  label="Complemento"
                  autoComplete="off"
                  placeholder="Apto 302, fundos"
                  error={errors.addressComplement?.message}
                  {...register('addressComplement')}
                />

                <GlassInput
                  label="Bairro"
                  autoComplete="off"
                  placeholder="Centro"
                  error={errors.addressDistrict?.message}
                  {...register('addressDistrict')}
                />

                <GlassInput
                  label="Cidade"
                  autoComplete="off"
                  placeholder="Queimados"
                  error={errors.addressCity?.message}
                  {...register('addressCity')}
                />

                <Controller
                  control={control}
                  name="addressState"
                  render={({ field }) => (
                    <GlassSelect
                      label="Estado"
                      options={[
                        { value: '', label: 'Não informado' },
                        ...UF_LIST.map((uf) => ({ value: uf, label: uf })),
                      ]}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </div>
            </Section>
          ) : null}

          {etapa === 'vinculo' ? (
            <Section
              step={5}
              title="Vínculo com a operação"
              description="Em que empresa a pessoa trabalha e desde quando. Tudo opcional."
              icon={<TruckIcon size={16} aria-hidden="true" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {companyOptions.length > 1 ? (
                  <Controller
                    control={control}
                    name="companyId"
                    render={({ field }) => (
                      <GlassSelect
                        label="Empresa"
                        options={companyOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    )}
                  />
                ) : null}

                {/* ⚠️ Espelha o vínculo do veículo, e pelo mesmo motivo: CLT tem
                    custo fixo mensal, agregado e terceiro são pagamento por
                    viagem. Sem o campo, custo por km soma o que não se soma. */}
                <Controller
                  control={control}
                  name="employmentType"
                  render={({ field }) => (
                    <GlassSelect
                      label="Vínculo"
                      options={[...EMPLOYMENT_TYPES]}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />

                <GlassInput
                  label="Matrícula"
                  autoComplete="off"
                  placeholder="9042"
                  hint="Código interno do RH"
                  error={errors.employeeNumber?.message}
                  {...register('employeeNumber')}
                />

                <GlassInput
                  label="PIS/PASEP"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12345678901"
                  hint="11 dígitos"
                  error={errors.pis?.message}
                  {...register('pis')}
                />

                {/* Preenchida junto da inativação: é o que responde "desde
                    quando" sem depender da data em que alguém mexeu na ficha. */}
                <Controller
                  control={control}
                  name="dismissedAt"
                  render={({ field }) => (
                    <GlassDateField
                      label="Data de saída"
                      hint="Vazio enquanto a pessoa está na empresa"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.dismissedAt?.message}
                    />
                  )}
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
          ) : null}

          {save.isError ? (
            <Alert severity="error">
              {save.error instanceof Error
                ? save.error.message
                : 'Não foi possível gravar. Tente de novo.'}
            </Alert>
          ) : null}
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Barra de ações                                                  */}
        {/* -------------------------------------------------------------- */}
        {/*
         * Fixa no rodapé, e não no fim do formulário.
         *
         * São doze campos em três blocos: com a ação rolando junto, quem
         * termina de preencher precisa procurar o botão, e quem sobe para
         * conferir um campo perde o botão de vista. Colada embaixo, a ação de
         * confirmar está sempre a um clique, que é o que uma tela de trabalho
         * repetitivo pede.
         *
         * ⚠️ Sem sombra para cima (decisão do usuário em 30/08/2026). A barra
         * já se separa do formulário pela borda e pela superfície mais clara, e
         * a sombra somava um terceiro sinal para a mesma coisa.
         */}
        <div className="border-outline-variant bg-surface-low flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t px-5 py-4 sm:px-6">
          {/* Escondido no estreito: em 390px de largura o texto ocupa três
              linhas e rouba a altura que o formulário não tem de sobra. */}
          <p className="text-on-surface-muted text-label-md hidden min-w-0 items-start gap-1.5 normal-case sm:flex">
            <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {avancando
              ? `Etapa ${indiceDaEtapa + 1} de ${ETAPAS.length}`
              : editing
                ? 'Salvar congela este cadastro para a sincronização'
                : 'Ao gravar, o formulário limpa e o diálogo continua aberto para a próxima pessoa'}
          </p>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/*
             * ⚠️ O rodapé é a barra de decisão do diálogo, e só isso: sair sem
             * gravar, ou gravar. Antes o cadastro trazia "Limpar" nesta posição,
             * e a edição trazia "Cancelar": o mesmo lugar fazia coisas
             * diferentes conforme o modo, e quem cadastrava em lote não tinha
             * como fechar o diálogo pelo rodapé. Limpar foi para o corpo, junto
             * do que ela apaga (decisão do usuário em 30/08/2026).
             */}
            <SpectrumButton
              type="button"
              variant="ghost"
              onClick={indiceDaEtapa > 0 ? anterior : () => onOpenChange(false)}
              disabled={isSubmitting || save.isPending}
            >
              {indiceDaEtapa > 0 ? 'Voltar' : 'Fechar'}
            </SpectrumButton>

            {/*
             * ⚠️ `type="button"` quando avança, e não submit. Com submit, o
             * Enter num campo da etapa 1 tentaria gravar o cadastro inteiro em
             * vez de ir para a etapa 2, que é o que a pessoa espera de um
             * formulário em passos.
             */}
            {avancando ? (
              <SpectrumButton type="button" onClick={() => void proxima()} disabled={loading}>
                Próximo
              </SpectrumButton>
            ) : (
              <SpectrumButton type="submit" disabled={isSubmitting || save.isPending || loading}>
                {save.isPending
                  ? editing
                    ? 'Salvando…'
                    : 'Cadastrando…'
                  : loading
                    ? 'Carregando…'
                    : editing
                      ? 'Salvar alterações'
                      : 'Cadastrar motorista'}
              </SpectrumButton>
            )}
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
      <legend className="sr-only">{`Etapa ${step}: ${title}`}</legend>

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-primary-strong/10 text-primary-strong ring-primary-strong/20 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1"
        >
          {icon}
        </span>

        {/*
         * ⚠️ Só a descrição, sem repetir o título.
         *
         * O nome da etapa está na barra logo acima, e dizer "Aptidão" duas
         * vezes em quatro centímetros gasta a altura que este redesenho existe
         * para poupar. A descrição fica porque ela não está em lugar nenhum:
         * é ela que explica por que a etapa importa.
         *
         * O `step` continua no componente para o `legend`, que é o que dá nome
         * ao grupo para leitor de tela.
         */}
        <p className="text-on-surface-variant text-body-md min-w-0">{description}</p>
      </div>

      {children}
    </fieldset>
  );
}
