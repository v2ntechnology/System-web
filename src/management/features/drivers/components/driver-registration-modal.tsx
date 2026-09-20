import { CameraIcon, CloseIcon, EraserIcon, InfoIcon } from '@/components/icons';
import { onlyDigits } from '@/lib/input-masks';
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
  Spinner,
  WizardSteps,
  cn,
} from '@/management/ui';

import { DriverAvatar } from './driver-avatar';
import { ACCEPTED_TYPES, prepareDriverPhoto } from '../photo';
import {
  allowsTruck,
  CNH_CATEGORIES,
  daysUntilExpiry,
  DEFAULT_DRIVER_FORM,
  digitsOnly,
  driverRegistrationSchema,
  EMPLOYMENT_TYPES,
  GENDERS,
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
    campos: ['name', 'gender', 'document', 'phone', 'email', 'rg', 'rgIssuer', 'birthDate'],
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
  /**
   * O preparo da imagem está em curso.
   *
   * ⚠️ O corte e a redução rodam **no navegador** e demoram o suficiente para
   * uma foto de celular de 8 MB: sem este estado, a moldura fica igual entre o
   * clique e a imagem aparecer, e quem escolheu clica de novo achando que falhou.
   */
  const [photoPending, setPhotoPending] = useState(false);

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
      gender: ficha.gender ?? '',
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
    formState: { errors, isSubmitting, isDirty },
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
     * ⚠️ **Mas ele NÃO fica restrito ao reset que o `values` dispara.** O
     * react-hook-form mescla este `resetOptions` em toda chamada de `reset`,
     * então quem quiser limpar de verdade precisa passar
     * `{ keepDirtyValues: false }` na chamada. É o que `limpar` faz, e foi o
     * defeito que deixou "Limpar formulário" sem efeito nenhum até 19/09/2026.
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

  /**
   * Devolve o formulário ao estado de cadastro novo.
   *
   * ⚠️ **`keepDirtyValues: false` explícito, e não é redundância.** O
   * `resetOptions` lá do `useForm` não vale só para o reset que o `values`
   * dispara: o react-hook-form mescla essas opções em TODA chamada de `reset`
   * (`reset(v, o) => _reset(v, { ...options.resetOptions, ...o })`). Sem este
   * `false`, limpar preservava exatamente os campos que a pessoa tinha
   * digitado, porque são os dirty, e ainda por cima só os da etapa ABERTA, que
   * são os únicos montados: as outras etapas limpavam e a da frente não, o que
   * fazia o botão parecer quebrado. Valia para os três usos daqui: o botão, o
   * limpar de depois de gravar e o de fechar o diálogo.
   */
  const limpar = () => {
    irPara('identificacao');
    reset(DEFAULT_DRIVER_FORM, { keepDirtyValues: false });
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

        gender: emptyToNull(form.gender),
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
    setPhotoPending(true);
    try {
      setPhoto(await prepareDriverPhoto(file));
    } catch (erro) {
      setPhoto(null);
      setPhotoError(erro instanceof Error ? erro.message : 'Não foi possível usar esta imagem.');
    } finally {
      /* No `finally` porque o erro também encerra a espera: preso no `try`, uma
         imagem recusada deixaria a moldura girando para sempre. */
      setPhotoPending(false);
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

          {etapa === 'identificacao' ? (
            <Section step={1} title="Identificação">
              {/*
               * ⚠️ **O nome divide a linha com a moldura da foto** (pedido do
               * usuário em 18/09/2026), e o resto dos campos desce para a grade
               * de duas colunas. Antes a foto era um botão solto no pé da etapa,
               * depois da data de nascimento: o retrato é a primeira coisa que
               * identifica alguém, e ele estava no último lugar que o olho visita.
               */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
                {/*
                 * ⚠️ **Nome, sexo e nascimento na mesma coluna** (pedido do
                 * usuário em 19/09/2026). São os três traços que o retrato ao
                 * lado confirma, e juntos alcançam a altura da moldura: antes o
                 * nome ocupava uma linha só e sobrava um vão embaixo dele, com a
                 * foto flutuando ao lado de espaço vazio.
                 */}
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <GlassInput
                    label="Nome completo"
                    autoComplete="off"
                    placeholder="Antônio Ferreira da Silva"
                    error={errors.name?.message}
                    {...register('name')}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Opcional de propósito: ninguém que já está no banco tem o
                        dado, e a telemetria não envia. O vazio é "Não
                        informado", que não é o mesmo que "Outro". */}
                    <Controller
                      control={control}
                      name="gender"
                      render={({ field }) => (
                        <GlassSelect
                          label="Sexo"
                          options={[...GENDERS]}
                          placeholder="Não informado"
                          value={field.value}
                          onValueChange={field.onChange}
                          error={errors.gender?.message}
                        />
                      )}
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
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  <span className="text-label-md text-on-surface-variant uppercase">Foto</span>

                  <input
                    ref={fileInput}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    className="sr-only"
                    onChange={(event) => {
                      void escolherFoto(event.target.files?.[0]);
                      /* Zerar permite reescolher o MESMO arquivo depois de um
                         erro: sem isto o `change` não dispara na segunda vez. */
                      event.target.value = '';
                    }}
                  />

                  {/*
                   * A moldura é o botão inteiro, e não um botão ao lado dela.
                   *
                   * ⚠️ `glass-well` é o MESMO poço dos campos de texto, e é o que
                   * faz a moldura pertencer ao formulário em vez de parecer um
                   * cartão colado nele. Vazia ela fica tracejada, que é o convite
                   * a clicar; cheia, o traço vira contínuo, porque aí ela já não
                   * pede nada.
                   */}
                  <div className="relative sm:flex-1">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={photoPending}
                      aria-label={
                        photo || editing
                          ? 'Trocar a foto do motorista'
                          : 'Enviar a foto do motorista'
                      }
                      className={cn(
                        'glass-well group focus-visible:ring-primary relative grid size-32 place-items-center overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 sm:h-full sm:w-32',
                        /*
                         * ⚠️ O traço tracejado é de 2px e usa `outline`, não
                         * `outline-variant`. O `variant` é a divisória sutil da
                         * paleta, feita para separar linha de tabela: a 1px ele
                         * some, e a moldura deixa de convidar ao clique, que é a
                         * única função dela enquanto está vazia.
                         */
                        /* Tracejado só quando NÃO há o que mostrar. Na edição a
                         moldura já traz a foto gravada, ou as iniciais de quem
                         não tem: tracejar ali seria pedir o que já está lá. */
                        photo || editing
                          ? 'border-solid'
                          : 'border-outline hover:border-primary hover:bg-on-surface/[0.05] border-2 border-dashed',
                        photoPending && 'cursor-progress',
                      )}
                    >
                      {photoPending ? (
                        <Spinner label="Preparando a foto" />
                      ) : photo ? (
                        <img
                          src={photo}
                          alt=""
                          draggable={false}
                          className="size-full object-cover"
                        />
                      ) : editing && driverId ? (
                        /*
                         * ⚠️ Na edição a moldura mostra a foto GRAVADA, buscada pela
                         * rota autenticada. Sem isso ela abriria vazia para quem já
                         * tem retrato, e a leitura seria "não há foto", quando a
                         * verdade é que o formulário não carrega os bytes dela.
                         */
                        <DriverAvatar
                          driverId={driverId}
                          name={values.name || 'Motorista'}
                          hasPhoto
                          className="text-body-lg size-full rounded-none"
                        />
                      ) : (
                        <span className="text-on-surface-muted text-label-sm flex flex-col items-center gap-1.5 normal-case">
                          <CameraIcon size={20} aria-hidden="true" />
                          Enviar foto
                        </span>
                      )}

                      {/* O véu só existe onde já há imagem: na moldura vazia o
                        convite já está escrito embaixo do ícone. */}
                      {!photoPending && (photo || editing) ? (
                        <span className="bg-on-surface/55 text-on-media text-label-sm absolute inset-0 flex flex-col items-center justify-center gap-1 normal-case opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <CameraIcon size={18} aria-hidden="true" />
                          Trocar
                        </span>
                      ) : null}
                    </button>

                    {/*
                     * ⚠️ **No canto da moldura, e não numa linha embaixo dela.**
                     * Embaixo, ele só nascia depois de escolher a foto e empurrava
                     * o bloco para baixo no exato instante em que a imagem
                     * aparecia: o formulário inteiro dava um pulo. No canto, a
                     * altura do bloco é a mesma com foto e sem foto.
                     */}
                    {photo ? (
                      <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        aria-label="Remover a foto escolhida"
                        className="bg-surface-low border-outline-variant text-on-surface-muted hover:border-outline hover:text-on-surface focus-visible:ring-primary absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2"
                      >
                        <CloseIcon size={12} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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

                <div className="sm:col-span-2">
                  <GlassInput
                    label="E-mail"
                    type="email"
                    autoComplete="off"
                    placeholder="nome@empresa.com.br"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>

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
              </div>

              {/*
               * ⚠️ A frase "Cortada em quadrado e reduzida aqui no navegador"
               * saiu a pedido do usuário em 18/09/2026. O comportamento continua:
               * quem corta e reduz é o `prepareDriverPhoto`, no navegador.
               *
               * ⚠️ E a regra da edição segue valendo, agora dita pela moldura em
               * vez de por uma legenda: não escolher foto significa "não mexi", e
               * a que está gravada continua onde está. Tratar a ausência como
               * remoção apagaria a foto de quem só corrigiu um telefone.
               */}
              {photoError ? <Alert severity="error">{photoError}</Alert> : null}
            </Section>
          ) : null}

          {etapa === 'habilitacao' ? (
            <Section step={2} title="Habilitação">
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

                {/* Mesmo motivo do PIS: o `inputMode` é dica de teclado, não
                    regra. O envio já limpava com `digitsOnly`, então a letra
                    digitada sumia ao salvar sem nunca ter sido recusada. */}
                <Controller
                  control={control}
                  name="cnhNumber"
                  render={({ field }) => (
                    <GlassInput
                      label="Registro da CNH"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="12345678901"
                      hint="11 dígitos, do documento"
                      error={errors.cnhNumber?.message}
                      value={field.value}
                      onChange={(event) => field.onChange(onlyDigits(event.target.value, 11))}
                      onBlur={field.onBlur}
                    />
                  )}
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
                      hint="Exerce Atividade Remunerada. Sem a observação, dirigir profissionalmente é infração grave, mesmo com a categoria certa."
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
            <Section step={3} title="Aptidão">
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
            <Section step={4} title="Contato e endereço">
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
                      placeholder="Não informado"
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </div>
            </Section>
          ) : null}

          {etapa === 'vinculo' ? (
            <Section step={5} title="Vínculo com a operação">
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
                      placeholder="Não informado"
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

                {/* ⚠️ `Controller`, e não `register`: o `inputMode` só muda o
                    TECLADO do celular, e no computador o campo continuava
                    aceitando letra. Quem digita PIS está copiando de um
                    documento, e letra ali é sempre erro. */}
                <Controller
                  control={control}
                  name="pis"
                  render={({ field }) => (
                    <GlassInput
                      label="PIS/PASEP"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="12345678901"
                      hint="11 dígitos"
                      error={errors.pis?.message}
                      value={field.value}
                      onChange={(event) => field.onChange(onlyDigits(event.target.value, 11))}
                      onBlur={field.onBlur}
                    />
                  )}
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
                    hint="Desmarque para quem ainda não começou ou está afastado."
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
          {/*
           * ⚠️ O "Ao gravar, o formulário limpa e o diálogo continua aberto"
           * saiu em 18/09/2026, a pedido do usuário. **O comportamento
           * continua**: gravar um cadastro novo limpa os campos e mantém o
           * diálogo, para quem está cadastrando uma fila de pessoas. O que saiu
           * foi o anúncio, e por isso o rodapé pode ficar sem texto.
           */}
          {/* ⚠️ Só a etapa. O "Salvar congela este cadastro para a sincronização"
              saiu em 19/09/2026, a pedido do usuário, e não volta: o mesmo aviso
              já é a descrição do diálogo, logo abaixo do título, e repeti-lo no
              rodapé dizia duas vezes a mesma coisa na mesma tela. */}
          {avancando ? (
            <p className="text-on-surface-muted text-label-md hidden min-w-0 items-start gap-1.5 normal-case sm:flex">
              <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {`Etapa ${indiceDaEtapa + 1} de ${ETAPAS.length}`}
            </p>
          ) : null}

          {/*
           * ⚠️ **Limpar vive no rodapé, à ESQUERDA, e só depois que alguém
           * digitou** (pedido do usuário em 19/09/2026).
           *
           * Ele nasceu aqui, foi para o corpo em 30/08/2026 para não competir
           * com Fechar e Gravar, e volta agora sem o problema que o tirou: no
           * corpo ele consumia uma linha inteira acima do primeiro campo, em
           * TODA abertura do diálogo, inclusive no formulário em branco, onde
           * não há nada para limpar. Aqui ele fica do lado oposto às ações de
           * decisão, sobre espaço que já existia, e some quando não tem função.
           *
           * `isDirty` do react-hook-form compara com os valores iniciais:
           * digitar e apagar devolve o botão ao estado escondido.
           *
           * Só em cadastro: na edição não existe "estado limpo" para voltar, o
           * formulário nasce com a ficha gravada, e um botão que zerasse tudo
           * seria uma armadilha.
           */}
          {!editing && isDirty ? (
            <button
              type="button"
              onClick={limpar}
              disabled={isSubmitting || save.isPending}
              className="text-on-surface-muted hover:text-on-surface hover:bg-on-surface/[0.06] rounded-pill focus-visible:ring-primary text-label-md flex shrink-0 items-center gap-1.5 px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <EraserIcon size={14} aria-hidden="true" />
              Limpar formulário
            </button>
          ) : null}

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
              /* ⚠️ A variante acompanha o RÓTULO: vermelho só quando o botão
                 fecha e descarta o que foi digitado. Voltar uma etapa não perde
                 nada, e pintá-lo de vermelho assustaria à toa. */
              variant={indiceDaEtapa > 0 ? 'neutral' : 'danger'}
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
/**
 * Uma etapa do formulário.
 *
 * ⚠️ **Sem cabeçalho visível desde 18/09/2026**, a pedido do usuário. Cada etapa
 * abria com um ícone e uma frase explicando por que ela existe, e as cinco
 * frases juntas custavam a altura do diálogo: quem já sabe o que é "Aptidão"
 * pagava a explicação toda vez que voltava para corrigir um campo.
 *
 * O `legend` continua, e é `sr-only`: quem ouve a tela precisa saber em que
 * grupo está, e a barra de etapas acima não chega a ele como contexto do campo.
 */
function Section({
  step,
  title,
  children,
  className,
}: {
  step: number;
  title: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-4 border-0 p-0', className)}>
      <legend className="sr-only">{`Etapa ${step}: ${title}`}</legend>
      {children}
    </fieldset>
  );
}
