import { CheckIcon, InfoIcon, WarningIcon } from '@/components/icons';
import {
  createVehicle,
  fetchVehicleRegistry,
  saveVehicleRegistry,
  type VehicleRegistry,
  type VehicleRegistryPatch,
} from '@/management/lib/fleet-api';
import {
  Alert,
  Checkbox,
  GlassDateField,
  GlassInput,
  GlassSelect,
  SpectrumButton,
  Spinner,
  cn,
} from '@/management/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * A ficha do caminhão, como uma transportadora precisa dela.
 *
 * <h2>Por que cresceu de cinco campos para vinte e cinco</h2>
 *
 * Decisão do usuário em 30/08/2026. A ficha anterior tinha só o que a operação
 * já anotava (código interno, revisão, motivo de parada), e isso não é cadastro
 * de caminhão: é bloco de anotação de manutenção.
 *
 * O levantamento contra a frota real mostrou o vazio. Dos 40 ativos, o chassi
 * vem em branco nos 40, o ano em 12, o número de frota em 2, e renavam, cor,
 * eixos, capacidade, documentação e proprietário não existem em lugar nenhum.
 * Quem responde por essas informações é a transportadora, e não o fornecedor de
 * rastreador.
 *
 * <h2>O mesmo formulário cadastra e edita</h2>
 *
 * São os mesmos campos, e a diferença é o que acontece depois: cadastrar fecha
 * e devolve a lista com a placa nova; editar fecha e mantém o lugar. Duas telas
 * divergiriam na primeira vez que alguém acrescentasse um campo em uma só.
 *
 * ⚠️ **A placa só aparece no cadastro.** Ela é a chave de reconciliação com o
 * fornecedor: trocá-la num veículo que já existe criaria um caminhão novo na
 * próxima sincronização em vez de corrigir o antigo.
 *
 * <h2>Salva só o que mudou</h2>
 *
 * O backend distingue três estados por campo: ausente preserva, com valor
 * grava, nulo apaga. Enviar o formulário inteiro apagaria o que o usuário nem
 * abriu, então o que vai no corpo é a diferença contra o que foi carregado.
 */

const numero = (valor: number | undefined) =>
  valor == null ? '–' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const dataLonga = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/**
 * A classificação que o pátio usa.
 *
 * ⚠️ Não substitui o tipo que vem da MiX, que é grosso (truck, van) e serve para
 * o mapa escolher a silhueta. Toco e truck são os dois "truck" para o
 * fornecedor, e a diferença entre eles é quantos eixos carregam e quanto cada um
 * leva, que é exatamente o que a operação precisa saber para escalar carga.
 */
const CLASSES = [
  { value: '', label: 'Não informado' },
  { value: 'CAVALO_MECANICO', label: 'Cavalo mecânico' },
  { value: 'TRUCK', label: 'Truck (6x2)' },
  { value: 'TOCO', label: 'Toco (4x2)' },
  { value: 'BITRUCK', label: 'Bitruck (8x2)' },
  { value: 'VUC', label: 'VUC' },
  { value: 'CARRETA', label: 'Carreta / semirreboque' },
  { value: 'BITREM', label: 'Bitrem' },
  { value: 'RODOTREM', label: 'Rodotrem' },
  { value: 'VAN', label: 'Van' },
  { value: 'UTILITARIO', label: 'Utilitário' },
  { value: 'OUTRO', label: 'Outro' },
];

/** A carroceria montada sobre o chassi. Cavalo mecânico puxa e não carrega. */
const CARROCERIAS = [
  { value: '', label: 'Não informado' },
  { value: 'NENHUMA', label: 'Nenhuma (só o cavalo)' },
  { value: 'BAU', label: 'Baú' },
  { value: 'SIDER', label: 'Sider' },
  { value: 'GRANELEIRO', label: 'Graneleiro' },
  { value: 'TANQUE', label: 'Tanque' },
  { value: 'CACAMBA', label: 'Caçamba' },
  { value: 'FRIGORIFICO', label: 'Frigorífico' },
  { value: 'PRANCHA', label: 'Prancha' },
  { value: 'CEGONHA', label: 'Cegonha' },
  { value: 'PORTA_CONTAINER', label: 'Porta-contêiner' },
  { value: 'CARROCERIA_ABERTA', label: 'Carroceria aberta' },
  { value: 'OUTRO', label: 'Outro' },
];

/**
 * De quem é o caminhão.
 *
 * ⚠️ Muda a conta de custo, e não é só etiqueta: próprio tem depreciação e
 * manutenção na conta da empresa, agregado e terceiro são pagamento por viagem.
 * Sem este campo, custo por km soma duas coisas que não se somam.
 */
const VINCULOS = [
  { value: '', label: 'Não informado' },
  { value: 'PROPRIO', label: 'Próprio' },
  { value: 'AGREGADO', label: 'Agregado' },
  { value: 'TERCEIRO', label: 'Terceiro' },
  { value: 'LOCADO', label: 'Locado' },
];

const AQUISICOES = [
  { value: '', label: 'Não informado' },
  { value: 'COMPRA', label: 'Compra à vista' },
  { value: 'FINANCIAMENTO', label: 'Financiamento' },
  { value: 'CONSORCIO', label: 'Consórcio' },
  { value: 'LEASING', label: 'Leasing' },
  { value: 'LOCACAO', label: 'Locação' },
];

interface Formulario {
  plate: string;
  renavam: string;
  vin: string;
  fleetNumber: string;
  manufacturer: string;
  model: string;
  year: string;
  modelYear: string;
  color: string;
  bodyClass: string;
  bodyType: string;
  axles: string;
  fuelType: string;
  tareWeightKg: string;
  payloadKg: string;
  cargoVolumeM3: string;
  tankCapacityL: string;
  referenceKmpl: string;
  licensingDueDate: string;
  rntrc: string;
  tachographDueDate: string;
  ownership: string;
  ownerName: string;
  ownerDocument: string;
  acquiredAt: string;
  acquisitionKind: string;
  internalCode: string;
  manualNotes: string;
  nextMaintenanceKm: string;
  nextMaintenanceDate: string;
  outOfService: boolean;
  outOfServiceReason: string;
}

const VAZIO: Formulario = {
  plate: '',
  renavam: '',
  vin: '',
  fleetNumber: '',
  manufacturer: '',
  model: '',
  year: '',
  modelYear: '',
  color: '',
  bodyClass: '',
  bodyType: '',
  axles: '',
  fuelType: '',
  tareWeightKg: '',
  payloadKg: '',
  cargoVolumeM3: '',
  tankCapacityL: '',
  referenceKmpl: '',
  licensingDueDate: '',
  rntrc: '',
  tachographDueDate: '',
  ownership: '',
  ownerName: '',
  ownerDocument: '',
  acquiredAt: '',
  acquisitionKind: '',
  internalCode: '',
  manualNotes: '',
  nextMaintenanceKm: '',
  nextMaintenanceDate: '',
  outOfService: false,
  outOfServiceReason: '',
};

/**
 * O literal que a sincronização grava quando a MiX manda o campo vazio.
 *
 * ⚠️ Vem assim do banco em 16 dos 40 ativos. Se ele chegasse ao campo de texto,
 * a pessoa teria de apagar "Não informado" antes de escrever o modelo de
 * verdade, e quem não apagasse gravaria a frase como se fosse o modelo.
 */
const AUSENTE = /^n[aã]o informad[oa]$/i;

const semRuido = (valor: string | undefined): string =>
  valor == null || AUSENTE.test(valor.trim()) ? '' : valor;

const paraFormulario = (r: VehicleRegistry): Formulario => ({
  plate: r.plate,
  renavam: r.renavam ?? '',
  vin: r.vin ?? '',
  fleetNumber: r.fleetNumber ?? '',
  manufacturer: semRuido(r.manufacturer),
  model: semRuido(r.model),
  year: r.year == null ? '' : String(r.year),
  modelYear: r.modelYear == null ? '' : String(r.modelYear),
  color: r.color ?? '',
  bodyClass: r.bodyClass ?? '',
  bodyType: r.bodyType ?? '',
  axles: r.axles == null ? '' : String(r.axles),
  fuelType: r.fuelType ?? '',
  tareWeightKg: r.tareWeightKg == null ? '' : String(r.tareWeightKg),
  payloadKg: r.payloadKg == null ? '' : String(r.payloadKg),
  cargoVolumeM3: r.cargoVolumeM3 == null ? '' : String(r.cargoVolumeM3).replace('.', ','),
  tankCapacityL: r.tankCapacityL == null ? '' : String(r.tankCapacityL),
  referenceKmpl: r.referenceKmpl == null ? '' : String(r.referenceKmpl).replace('.', ','),
  licensingDueDate: r.licensingDueDate ?? '',
  rntrc: r.rntrc ?? '',
  tachographDueDate: r.tachographDueDate ?? '',
  ownership: r.ownership ?? '',
  ownerName: r.ownerName ?? '',
  ownerDocument: r.ownerDocument ?? '',
  acquiredAt: r.acquiredAt ?? '',
  acquisitionKind: r.acquisitionKind ?? '',
  internalCode: r.internalCode ?? '',
  manualNotes: r.manualNotes ?? '',
  nextMaintenanceKm: r.nextMaintenanceKm == null ? '' : String(r.nextMaintenanceKm),
  nextMaintenanceDate: r.nextMaintenanceDate ?? '',
  outOfService: r.outOfService,
  outOfServiceReason: r.outOfServiceReason ?? '',
});

/** Campo de texto em branco vira nulo: apagar na tela precisa apagar no banco. */
const texto = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());

const inteiro = (valor: string): number | null => {
  const cru = valor.trim();
  return cru === '' ? null : Number(cru);
};

/** Vírgula é o separador decimal do teclado brasileiro, e o backend aceita as duas. */
const decimal = (valor: string): number | null => {
  const cru = valor.trim().replace(',', '.');
  return cru === '' ? null : Number(cru);
};

/**
 * A diferença contra o que foi carregado.
 *
 * ⚠️ Percorre uma lista, e não trinta comparações escritas à mão. Com este
 * número de campos, o `if` repetido produz o erro mais difícil de achar: um
 * campo comparado com o vizinho grava o valor errado sem nada falhar.
 */
const CONVERSAO: Record<string, (valor: string) => string | number | null> = {
  renavam: texto,
  vin: texto,
  fleetNumber: texto,
  manufacturer: texto,
  model: texto,
  year: inteiro,
  modelYear: inteiro,
  color: texto,
  bodyClass: texto,
  bodyType: texto,
  axles: inteiro,
  fuelType: texto,
  tareWeightKg: inteiro,
  payloadKg: inteiro,
  cargoVolumeM3: decimal,
  tankCapacityL: inteiro,
  referenceKmpl: decimal,
  licensingDueDate: texto,
  rntrc: texto,
  tachographDueDate: texto,
  ownership: texto,
  ownerName: texto,
  ownerDocument: texto,
  acquiredAt: texto,
  acquisitionKind: texto,
  internalCode: texto,
  manualNotes: texto,
  nextMaintenanceKm: inteiro,
  nextMaintenanceDate: texto,
  outOfServiceReason: texto,
};

function diferenca(atual: Formulario, original: Formulario): VehicleRegistryPatch {
  const patch: Record<string, unknown> = {};

  for (const [campo, converter] of Object.entries(CONVERSAO)) {
    const chave = campo as keyof Formulario;
    if (atual[chave] === original[chave]) continue;
    patch[campo] = converter(String(atual[chave]));
  }

  if (atual.outOfService !== original.outOfService) {
    patch['outOfService'] = atual.outOfService;
  }

  return patch as VehicleRegistryPatch;
}

/** Tudo preenchido de uma vez, para o cadastro que ainda não tem original. */
const tudo = (form: Formulario): VehicleRegistryPatch => diferenca(form, VAZIO);

/* -------------------------------------------------------------------------- */
/* Casca                                                                       */
/* -------------------------------------------------------------------------- */

export interface VehicleRegistryFormProps {
  /** Nulo abre em branco para cadastrar uma placa nova. */
  vehicleId: string | null;
  onSaved: () => void;
  /**
   * Fecha o diálogo. Presente só quando o formulário está dentro de um.
   *
   * ⚠️ É ele que decide a forma do rodapé, e não uma prop de estilo: dentro do
   * diálogo a barra de ações fica **colada embaixo**, como no cadastro de
   * motorista; no painel de detalhe do caminhão, que rola junto com a página,
   * uma barra colada ficaria flutuando no meio da tela sem nada a que se
   * prender.
   */
  onClose?: (() => void) | undefined;
  className?: string | undefined;
}

export function VehicleRegistryForm({
  vehicleId,
  onSaved,
  onClose,
  className,
}: VehicleRegistryFormProps) {
  const registro = useQuery({
    queryKey: ['vehicle-registry', vehicleId],
    queryFn: () => fetchVehicleRegistry(vehicleId as string),
    enabled: vehicleId != null,
  });

  if (vehicleId == null) {
    /* `key` fixo no modo de cadastro: abrir, fechar e abrir de novo remonta o
       formulário limpo, sem sobra do que a pessoa digitou e desistiu. */
    return (
      <Campos
        key="novo"
        vehicleId={null}
        registro={null}
        onSaved={onSaved}
        onClose={onClose}
        className={className}
      />
    );
  }

  if (registro.isPending) {
    return (
      <div className={cn('flex justify-center px-5 py-10 sm:px-6', className)}>
        <Spinner className="text-on-surface-muted size-5" label="Carregando o cadastro" />
      </div>
    );
  }

  if (registro.isError || !registro.data) {
    return (
      <p className={cn('text-error text-body-md px-5 py-10 text-center sm:px-6', className)}>
        Não foi possível carregar o cadastro deste veículo.
      </p>
    );
  }

  /* `key` com o identificador: trocar de veículo REMONTA o formulário. Sem isso,
     o texto digitado num caminhão apareceria no próximo. */
  return (
    <Campos
      key={vehicleId}
      vehicleId={vehicleId}
      registro={registro.data}
      onSaved={onSaved}
      onClose={onClose}
      className={className}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Campos                                                                      */
/* -------------------------------------------------------------------------- */

function Secao({
  titulo,
  hint,
  children,
}: {
  titulo: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className="border-outline-variant border-t pt-5 first:border-0 first:pt-0">
      <h3 className="text-on-surface text-body-md font-semibold">{titulo}</h3>
      {hint ? <p className="text-on-surface-muted text-label-md mt-1 normal-case">{hint}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Campos({
  vehicleId,
  registro,
  onSaved,
  onClose,
  className,
}: {
  vehicleId: string | null;
  registro: VehicleRegistry | null;
  onSaved: () => void;
  onClose?: (() => void) | undefined;
  className?: string | undefined;
}) {
  const cliente = useQueryClient();
  const criando = vehicleId == null;

  const inicial = registro ? paraFormulario(registro) : VAZIO;
  const [original, setOriginal] = useState(inicial);
  const [form, setForm] = useState(inicial);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const patch = diferenca(form, original);
  const mudou = Object.keys(patch).length > 0;

  const invalidar = (id: string) => {
    void cliente.invalidateQueries({ queryKey: ['vehicles'] });
    void cliente.invalidateQueries({ queryKey: ['vehicle-registry', id] });
    /* A lista mostra "Conferido", "Fora de serviço" e o modelo na linha, e os
       três mudam ao salvar aqui. */
    void cliente.invalidateQueries({ queryKey: ['vehicle-registry-list'] });
  };

  const salvar = useMutation({
    mutationFn: () =>
      criando
        ? createVehicle(form.plate, tudo(form))
        : saveVehicleRegistry(vehicleId as string, patch),
    onSuccess: (atualizado) => {
      const novo = paraFormulario(atualizado);
      setOriginal(novo);
      setForm(novo);
      setSalvo(true);
      setErro(null);
      invalidar(atualizado.vehicleId);
      onSaved();
    },
    onError: (e) => {
      /* ⚠️ A mensagem do backend vai inteira para a tela: é ela que diz que a
         placa já existe (e que o caso pode ser reativar) ou que o formato está
         errado. "Não foi possível salvar" mandaria a pessoa tentar de novo sem
         saber o quê. */
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    },
  });

  const alterar = <C extends keyof Formulario>(campo: C, valor: Formulario[C]) => {
    setSalvo(false);
    setErro(null);
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const digitos = (valor: string, tamanho: number) => valor.replace(/\D/g, '').slice(0, tamanho);

  const vencida = registro?.kmToMaintenance != null && registro.kmToMaintenance < 0;
  const dentroDoDialogo = onClose != null;
  const podeSalvar = criando ? form.plate.trim().length >= 7 : mudou;

  return (
    <form
      className={cn(
        'flex flex-col',
        /* Dentro do diálogo o formulário ocupa a altura disponível para a
           barra de ações poder colar embaixo. Fora dele cresce com o
           conteúdo, como qualquer bloco de página. */
        dentroDoDialogo ? 'min-h-0 flex-1' : 'gap-5',
        className,
      )}
      onSubmit={(evento) => {
        evento.preventDefault();
        if (podeSalvar && !salvar.isPending) salvar.mutate();
      }}
    >
      {/*
       * ⚠️ O corpo é quem rola, e não o diálogo inteiro: é isso que mantém a
       * barra de ações colada embaixo. `min-h-0` é obrigatório, senão o filho
       * flex se recusa a encolher e a barra é empurrada para fora da área
       * visível. Mesma mecânica do cadastro de motorista.
       */}
      <div
        className={cn(
          'flex flex-col gap-5',
          dentroDoDialogo && 'min-h-0 flex-1 overflow-y-auto px-5 pb-7 sm:px-6',
        )}
      >
        {erro ? <Alert severity="error">{erro}</Alert> : null}

        {/* ------------------------------------------------------------------ */}
        <Secao
          titulo="Identificação"
          hint={
            criando
              ? 'A placa não pode ser alterada depois: é por ela que a telemetria reconhece o caminhão.'
              : undefined
          }
        >
          {criando ? (
            <GlassInput
              label="Placa"
              hint="ABC1D23 ou ABC1234"
              value={form.plate}
              onChange={(e) => alterar('plate', e.target.value.toUpperCase().slice(0, 8))}
              autoFocus
              required
            />
          ) : (
            <GlassInput label="Placa" value={form.plate} readOnly disabled hint="Não é editável" />
          )}

          <GlassInput
            label="Renavam"
            placeholder="00123456789"
            hint="11 dígitos"
            value={form.renavam}
            onChange={(e) => alterar('renavam', digitos(e.target.value, 11))}
            inputMode="numeric"
          />

          <GlassInput
            label="Chassi"
            placeholder="9BM9580748B123456"
            hint="17 caracteres, do documento"
            value={form.vin}
            onChange={(e) => alterar('vin', e.target.value.toUpperCase().slice(0, 17))}
          />

          <GlassInput
            label="Número de frota"
            placeholder="221"
            hint="O número pintado na porta"
            value={form.fleetNumber}
            onChange={(e) => alterar('fleetNumber', e.target.value)}
            maxLength={20}
          />

          <GlassInput
            label="Marca"
            placeholder="Volvo"
            value={form.manufacturer}
            onChange={(e) => alterar('manufacturer', e.target.value)}
            maxLength={60}
          />

          <GlassInput
            label="Modelo"
            placeholder="FH 460"
            value={form.model}
            onChange={(e) => alterar('model', e.target.value)}
            maxLength={60}
          />

          {/* ⚠️ Fabricação e modelo são dois anos e ambos aparecem no documento.
            Um caminhão "2023/2024" foi fabricado em 2023 e é modelo 2024, e a
            diferença muda o valor de revenda. */}
          <GlassInput
            label="Ano de fabricação"
            placeholder="2023"
            value={form.year}
            onChange={(e) => alterar('year', digitos(e.target.value, 4))}
            inputMode="numeric"
          />

          <GlassInput
            label="Ano do modelo"
            placeholder="2024"
            value={form.modelYear}
            onChange={(e) => alterar('modelYear', digitos(e.target.value, 4))}
            inputMode="numeric"
          />

          <GlassInput
            label="Cor"
            placeholder="Branco"
            value={form.color}
            onChange={(e) => alterar('color', e.target.value)}
            maxLength={30}
          />
        </Secao>

        {/* ------------------------------------------------------------------ */}
        <Secao titulo="Ficha técnica" hint="O que ele é e o que consegue levar.">
          <GlassSelect
            label="Classificação"
            options={CLASSES}
            value={form.bodyClass}
            onValueChange={(v) => alterar('bodyClass', v)}
          />

          <GlassSelect
            label="Carroceria"
            options={CARROCERIAS}
            value={form.bodyType}
            onValueChange={(v) => alterar('bodyType', v)}
          />

          <GlassInput
            label="Eixos"
            placeholder="6"
            value={form.axles}
            onChange={(e) => alterar('axles', digitos(e.target.value, 2))}
            inputMode="numeric"
          />

          <GlassInput
            label="Combustível"
            placeholder="Diesel S10"
            hint="Diesel S10, S500, GNV"
            value={form.fuelType}
            onChange={(e) => alterar('fuelType', e.target.value)}
            maxLength={40}
          />

          <GlassInput
            label="Tara (kg)"
            placeholder="8500"
            hint="Peso do veículo vazio"
            value={form.tareWeightKg}
            onChange={(e) => alterar('tareWeightKg', digitos(e.target.value, 6))}
            inputMode="numeric"
          />

          <GlassInput
            label="Capacidade de carga (kg)"
            placeholder="36000"
            value={form.payloadKg}
            onChange={(e) => alterar('payloadKg', digitos(e.target.value, 6))}
            inputMode="numeric"
          />

          {/* Baú e sider vendem por metro cúbico e não por quilo: carga leve e
            volumosa enche o baú muito antes de atingir a capacidade em peso. */}
          <GlassInput
            label="Volume de carga (m³)"
            placeholder="92,5"
            value={form.cargoVolumeM3}
            onChange={(e) => alterar('cargoVolumeM3', e.target.value.replace(/[^\d,.]/g, ''))}
            inputMode="decimal"
          />

          <GlassInput
            label="Tanque (litros)"
            placeholder="600"
            value={form.tankCapacityL}
            onChange={(e) => alterar('tankCapacityL', digitos(e.target.value, 5))}
            inputMode="numeric"
          />

          <GlassInput
            label="Consumo de referência (km/l)"
            placeholder="2,4"
            hint="Para comparar com o que a telemetria mede"
            value={form.referenceKmpl}
            onChange={(e) => alterar('referenceKmpl', e.target.value.replace(/[^\d,.]/g, ''))}
            inputMode="decimal"
          />
        </Secao>

        {/* ------------------------------------------------------------------ */}
        <Secao
          titulo="Documentação"
          hint="Caminhão com documento vencido não sai, e descobrir isso no posto fiscal custa a viagem."
        >
          <GlassDateField
            label="Licenciamento vence em"
            value={form.licensingDueDate}
            onValueChange={(v) => alterar('licensingDueDate', v)}
          />

          <GlassDateField
            label="Tacógrafo aferido até"
            value={form.tachographDueDate}
            onValueChange={(v) => alterar('tachographDueDate', v)}
          />

          <GlassInput
            label="RNTRC"
            placeholder="12345678"
            hint="Registro da ANTT"
            value={form.rntrc}
            onChange={(e) => alterar('rntrc', e.target.value)}
            maxLength={20}
          />
        </Secao>

        {/* ------------------------------------------------------------------ */}
        <Secao
          titulo="Propriedade"
          hint="Próprio deprecia e tem manutenção na conta da empresa; agregado e terceiro são pagamento por viagem."
        >
          <GlassSelect
            label="Vínculo"
            options={VINCULOS}
            value={form.ownership}
            onValueChange={(v) => alterar('ownership', v)}
          />

          <GlassInput
            label="Proprietário"
            placeholder="Servioeste Transportes Ltda"
            value={form.ownerName}
            onChange={(e) => alterar('ownerName', e.target.value)}
            maxLength={120}
          />

          <GlassInput
            label="CPF ou CNPJ do proprietário"
            placeholder="12.345.678/0001-90"
            value={form.ownerDocument}
            onChange={(e) => alterar('ownerDocument', digitos(e.target.value, 14))}
            inputMode="numeric"
          />

          <GlassSelect
            label="Forma de aquisição"
            options={AQUISICOES}
            value={form.acquisitionKind}
            onValueChange={(v) => alterar('acquisitionKind', v)}
          />

          <GlassDateField
            label="Adquirido em"
            value={form.acquiredAt}
            onValueChange={(v) => alterar('acquiredAt', v)}
          />
        </Secao>

        {/* ------------------------------------------------------------------ */}
        <Secao titulo="Operação" hint="O que a telemetria não entrega: quem preenche é quem opera.">
          <GlassInput
            label="Código interno"
            placeholder="221"
            value={form.internalCode}
            onChange={(e) => alterar('internalCode', e.target.value)}
            maxLength={40}
          />

          <GlassInput
            label="Próxima revisão (km)"
            placeholder="480000"
            hint={
              registro?.kmToMaintenance == null
                ? 'odômetro em que a revisão vence'
                : vencida
                  ? `vencida há ${numero(Math.abs(registro.kmToMaintenance))} km`
                  : `faltam ${numero(registro.kmToMaintenance)} km`
            }
            value={form.nextMaintenanceKm}
            onChange={(e) => alterar('nextMaintenanceKm', digitos(e.target.value, 7))}
            inputMode="numeric"
          />

          <GlassDateField
            label="Próxima revisão (data)"
            value={form.nextMaintenanceDate}
            onValueChange={(v) => alterar('nextMaintenanceDate', v)}
          />

          <GlassInput
            label="Observação da operação"
            placeholder="Baú com avaria na porta lateral"
            hint="Não é sobrescrita pela sincronização"
            value={form.manualNotes}
            onChange={(e) => alterar('manualNotes', e.target.value)}
            maxLength={500}
          />
        </Secao>

        {/* ------------------------------------------------------------------ */}
        <div className="border-outline-variant flex flex-col gap-3 border-t pt-5">
          {/* ⚠️ Fora de operação NÃO é o mesmo que inativar. Este marca o caminhão
            parado agora, com motivo, e ele volta. Inativar tira da frota, e fica
            no botão da lista. */}
          <Checkbox
            label="Fora de operação"
            description="Tira o caminhão da conta de frota disponível até alguém devolver. Diferente de inativar, que é sair da frota."
            checked={form.outOfService}
            onCheckedChange={(marcado) => alterar('outOfService', marcado === true)}
          />

          {form.outOfService ? (
            <GlassInput
              label="Motivo"
              placeholder="Aguardando peça do turbo"
              hint="Sem o motivo, o status vira um sinal sem explicação"
              value={form.outOfServiceReason}
              onChange={(e) => alterar('outOfServiceReason', e.target.value)}
              maxLength={200}
            />
          ) : null}

          {registro?.outOfService && registro.outOfServiceSince ? (
            <p className="text-warning text-label-md flex items-center gap-1.5 normal-case">
              <WarningIcon size={14} aria-hidden="true" />
              Parado desde {dataLonga.format(new Date(registro.outOfServiceSince))}
            </p>
          ) : null}
        </div>
      </div>

      {/*
       * A barra de decisão do diálogo: sair sem gravar, ou gravar.
       *
       * ⚠️ Sem sombra para cima (decisão do usuário em 30/08/2026), igual ao
       * cadastro de motorista. A borda e a superfície mais clara já separam a
       * barra do formulário; a sombra era um terceiro sinal para a mesma coisa.
       */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-4 gap-y-3',
          dentroDoDialogo
            ? 'border-outline-variant bg-surface-low shrink-0 border-t px-5 py-4 sm:px-6'
            : 'border-outline-variant border-t pt-5',
        )}
      >
        {/* Escondido no estreito: em 390px o texto ocupa três linhas e rouba a
            altura que o formulário não tem de sobra. */}
        <p
          className={cn(
            'text-on-surface-muted text-label-md min-w-0 items-start gap-1.5 normal-case',
            dentroDoDialogo ? 'hidden sm:flex' : 'flex',
          )}
        >
          {salvo ? (
            <span className="text-success flex items-center gap-1.5">
              <CheckIcon size={14} aria-hidden="true" />
              Salvo
            </span>
          ) : criando ? (
            <>
              <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Caminhão cadastrado aqui não tem rastreador e não reporta posição
            </>
          ) : registro?.updatedAt ? (
            <>
              <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Editado em {dataLonga.format(new Date(registro.updatedAt))}
              {registro.updatedByName ? ` por ${registro.updatedByName}` : ''}
            </>
          ) : (
            <>
              <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Salvar congela esta ficha: a telemetria não sobrescreve mais
            </>
          )}
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {dentroDoDialogo ? (
            <SpectrumButton
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={salvar.isPending}
            >
              Fechar
            </SpectrumButton>
          ) : null}

          <SpectrumButton type="submit" disabled={!podeSalvar || salvar.isPending}>
            {salvar.isPending
              ? criando
                ? 'Cadastrando…'
                : 'Salvando…'
              : criando
                ? 'Cadastrar caminhão'
                : 'Salvar cadastro'}
          </SpectrumButton>
        </div>
      </div>
    </form>
  );
}
