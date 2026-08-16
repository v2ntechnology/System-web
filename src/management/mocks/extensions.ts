import type { Extension, ExtensionsSummary, Integration } from '@/management/types';

import { extensionMonthlyCost } from '@/management/features/extensions/pricing';

import { ApiError, delay } from './latency';

/**
 * Marketplace de extensões do tenant.
 *
 * ⚠️ **Esta é a fonte única de fornecedores.** A aba Integrações de Configurações
 * deriva daqui (`activeIntegrations`) e a cobrança soma daqui
 * (`extensionsMonthlyTotal`). Antes havia duas listas de fornecedor escritas à
 * mão, e elas já divergiam — "Eagletrack" num lugar e "EagleTruck" no outro é o
 * tipo de coisa que o usuário lê como erro de digitação do produto.
 *
 * Mutável de propósito: ativar, configurar e desativar precisam refletir na tela
 * e na fatura, senão o fluxo não fecha.
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/*
 * ⚠️ A `tagline` **não repete a categoria**: na lista ela aparece como
 * "Telemetria · <tagline>", e "Telemetria · Telemetria e rastreamento…" é ruído
 * em toda linha. Ela também vira o `kind` da integração derivada, então precisa
 * se sustentar sozinha.
 */

/** Veículos ativos do tenant — base do preço por veículo. Bate com a cobrança. */
export const BILLABLE_VEHICLES = 48;

const NEXT_CHARGE_AT = '2026-09-01T00:00:00-03:00';

const EXTENSIONS: Extension[] = [
  {
    id: 'ext-eagletruck',
    name: 'EagleTruck',
    vendor: 'EagleTruck Telemetria',
    tagline: 'Posição, odômetro e jornada em tempo real.',
    description:
      'Conecta a conta EagleTruck da sua transportadora ao RookHub. A partir da ativação, posição, odômetro, jornada e eventos de condução passam a ser lidos direto do fornecedor e entram na gestão como dado nativo — sem exportar planilha nem abrir o portal deles.',
    category: 'TELEMETRIA',
    billing: { model: 'POR_VEICULO', pricePerVehicle: 12 },
    status: 'DISPONIVEL',
    capabilities: [
      'Posição e velocidade a cada 30 segundos',
      'Odômetro do veículo, sem digitação manual',
      'Eventos de condução: frenagem, curva e excesso',
      'Controle de jornada do motorista',
    ],
    surfacesIn: ['Mapa ao vivo', 'Viagens', 'Segurança', 'Custos por km'],
    credentialFields: [
      {
        name: 'accountId',
        label: 'ID da conta EagleTruck',
        kind: 'text',
        placeholder: 'ET-000000',
        hint: 'Aparece no topo do portal EagleTruck, em Minha conta.',
      },
      {
        name: 'apiKey',
        label: 'Chave de API',
        kind: 'secret',
        placeholder: 'Cole a chave gerada no portal',
        hint: 'Gere em Integrações › Chaves de API. Precisa de permissão de leitura.',
      },
      {
        name: 'apiSecret',
        label: 'Segredo da API',
        kind: 'secret',
        placeholder: 'Cole o segredo correspondente',
      },
    ],
    requiredModule: 'FLEET',
  },
  {
    id: 'ext-powerfleet',
    name: 'Powerfleet',
    vendor: 'Powerfleet do Brasil',
    tagline: 'Rastreamento redundante para a frota crítica.',
    description:
      'Segunda fonte de posição para os veículos que não podem ficar sem rastreio. Quando o rastreador principal falha, o RookHub passa a usar a posição da Powerfleet sem intervenção.',
    category: 'TELEMETRIA',
    billing: { model: 'POR_VEICULO', pricePerVehicle: 9 },
    status: 'ATIVA',
    capabilities: ['Posição redundante', 'Alerta de perda de sinal', 'Cerca eletrônica'],
    surfacesIn: ['Mapa ao vivo', 'Viagens'],
    credentialFields: [
      { name: 'accountId', label: 'Código do cliente', kind: 'text' },
      { name: 'apiKey', label: 'Token de integração', kind: 'secret' },
    ],
    configuredHint: 'Token ····9F2C',
    activatedAt: '2025-06-02T00:00:00-03:00',
    health: 'ATRASADA',
    lastSuccessfulSyncAt: hoursAgo(8),
    vehiclesCovered: 8,
    healthNote: 'Sem posição do RKH8H31 desde as 10:41. As demais placas seguem atualizando.',
    requiredModule: 'FLEET',
  },
  {
    id: 'ext-hikconnect',
    name: 'Hik-Connect',
    vendor: 'Hikvision',
    tagline: 'Eventos de cabine por visão computacional.',
    description:
      'Traz os eventos das câmeras internas e externas para a tela de Segurança. O RookHub **não armazena vídeo** (RN-092): guarda os metadados e pede ao fornecedor uma URL assinada, válida por no máximo 15 minutos, na hora de assistir.',
    category: 'CAMERAS',
    billing: { model: 'POR_VEICULO', pricePerVehicle: 18 },
    status: 'ATIVA',
    capabilities: [
      'Detecção de fadiga e distração',
      'Ausência de cinto de segurança',
      'Clipe do evento sob demanda, por URL assinada',
    ],
    surfacesIn: ['Segurança', 'Motoristas', 'Notificações'],
    credentialFields: [
      { name: 'accountId', label: 'Conta Hik-Connect', kind: 'text' },
      { name: 'apiKey', label: 'Chave de acesso', kind: 'secret' },
    ],
    configuredHint: 'Chave ····4A18',
    activatedAt: '2025-04-18T00:00:00-03:00',
    health: 'OK',
    lastSuccessfulSyncAt: minutesAgo(3),
    vehiclesCovered: 6,
    requiredModule: 'SAFETY',
  },
  {
    id: 'ext-truckpag',
    name: 'TruckPag',
    vendor: 'TruckPag',
    tagline: 'Cartão de abastecimento com lançamento automático.',
    description:
      'Cada transação do cartão entra como abastecimento no RookHub, com posto, litros e preço por litro. Elimina a digitação da nota e a detecção de anomalia passa a rodar sobre dado do emissor (RF-022).',
    category: 'COMBUSTIVEL',
    billing: { model: 'MENSAL_FIXO', monthlyPrice: 240 },
    status: 'ATIVA',
    capabilities: [
      'Abastecimento lançado sem digitação',
      'Conciliação com o odômetro do rastreador',
      'Anomalia de consumo sobre dado do emissor',
    ],
    surfacesIn: ['Custos', 'Lançamentos', 'Caminhões'],
    credentialFields: [
      { name: 'accountId', label: 'CNPJ da conta', kind: 'text' },
      { name: 'apiKey', label: 'Chave de integração', kind: 'secret' },
    ],
    configuredHint: 'Chave ····7B03',
    activatedAt: '2025-09-11T00:00:00-03:00',
    health: 'OK',
    lastSuccessfulSyncAt: minutesAgo(22),
    vehiclesCovered: 8,
    requiredModule: 'COSTS',
  },
  {
    id: 'ext-semparar',
    name: 'Sem Parar Empresas',
    vendor: 'Sem Parar',
    tagline: 'Passagens na conta da frota, por placa.',
    description:
      'Importa as passagens de pedágio por placa e data, e elas entram no custo do veículo sem passar pela mesa do operador.',
    category: 'PEDAGIO',
    billing: { model: 'MENSAL_FIXO', monthlyPrice: 180 },
    status: 'DISPONIVEL',
    capabilities: ['Passagens por placa', 'Rateio por viagem', 'Conciliação com a rota planejada'],
    surfacesIn: ['Custos', 'Viagens'],
    credentialFields: [
      { name: 'accountId', label: 'Código da empresa', kind: 'text' },
      { name: 'apiKey', label: 'Chave de API', kind: 'secret' },
    ],
    requiredModule: 'COSTS',
  },
  {
    id: 'ext-whatsapp',
    name: 'WhatsApp Business',
    vendor: 'Meta',
    tagline: 'Checklist e avisos pelo WhatsApp do motorista.',
    description:
      'Permite que o motorista responda o checklist e receba avisos pelo WhatsApp, sem instalar aplicativo. Útil para quem roda em região de sinal ruim, onde o app web não abre.',
    category: 'COMUNICACAO',
    billing: { model: 'MENSAL_FIXO', monthlyPrice: 320 },
    status: 'AGUARDANDO_CONFIGURACAO',
    capabilities: [
      'Checklist respondido por conversa',
      'Foto do item reprovado direto do celular',
      'Aviso de bloqueio antes da saída',
    ],
    surfacesIn: ['Checklists', 'Triagem', 'Notificações'],
    credentialFields: [
      { name: 'phoneNumberId', label: 'ID do número', kind: 'text', placeholder: '1234567890' },
      { name: 'wabaId', label: 'ID da conta comercial', kind: 'text' },
      { name: 'accessToken', label: 'Token permanente', kind: 'secret' },
    ],
    activatedAt: hoursAgo(30),
    requiredModule: 'CHECKLIST',
  },
  {
    id: 'ext-cte',
    name: 'CT-e e MDF-e',
    vendor: 'RookHub Fiscal',
    tagline: 'CT-e e MDF-e emitidos a partir da viagem.',
    description:
      'Emite CT-e e MDF-e a partir da viagem já cadastrada, sem redigitar remetente, destinatário e carga.',
    category: 'FISCAL',
    billing: { model: 'INCLUSA' },
    status: 'DISPONIVEL',
    capabilities: ['CT-e a partir da viagem', 'MDF-e por rota', 'Guarda do XML por 5 anos'],
    surfacesIn: ['Viagens', 'Relatórios'],
    credentialFields: [
      {
        name: 'certificate',
        label: 'Certificado A1 (senha)',
        kind: 'secret',
        hint: 'O arquivo .pfx é enviado no passo seguinte, pelo canal seguro.',
      },
    ],
    requiredModule: 'TRIPS',
  },
];

/**
 * Soma das extensões que já geram cobrança.
 *
 * `AGUARDANDO_CONFIGURACAO` entra na conta: o cliente contratou no momento em que
 * ativou, e não quando terminou de colar a credencial. Cobrar só depois da
 * configuração deixaria a fatura discordar do que a tela promete.
 */
export function extensionsMonthlyTotal(): number {
  return EXTENSIONS.filter((item) => item.status !== 'DISPONIVEL').reduce(
    (total, item) => total + extensionMonthlyCost(item, BILLABLE_VEHICLES),
    0,
  );
}

/**
 * As extensões conectadas, no formato da aba Integrações (RN-140).
 *
 * Só entram as que já sincronizam: uma extensão contratada e ainda sem
 * credencial não tem saúde para relatar, e apareceria como "falha" sem ter
 * falhado.
 */
export function activeIntegrations(): Integration[] {
  return EXTENSIONS.filter((item) => item.status === 'ATIVA' && item.health).map((item) => ({
    id: `int-${item.id.replace('ext-', '')}`,
    provider: item.name,
    kind: item.tagline.replace(/\.$/, ''),
    health: item.health!,
    lastSuccessfulSyncAt: item.lastSuccessfulSyncAt ?? hoursAgo(1),
    vehiclesCovered: item.vehiclesCovered ?? 0,
    note: item.healthNote,
  }));
}

/** Substituto do `GET /v1/extensions`. */
export async function mockExtensions(): Promise<ExtensionsSummary> {
  await delay(650);

  return {
    extensions: EXTENSIONS.map((item) => ({ ...item })),
    monthlyTotal: extensionsMonthlyTotal(),
    billableVehicles: BILLABLE_VEHICLES,
    nextChargeAt: NEXT_CHARGE_AT,
  };
}

function find(extensionId: string): Extension {
  const target = EXTENSIONS.find((item) => item.id === extensionId);
  if (!target) {
    throw new ApiError(404, 'Extensão não encontrada', 'Esta extensão saiu do catálogo.');
  }
  return target;
}

/**
 * Substituto do `POST /v1/extensions/{id}/activate`.
 *
 * Ativar **contrata**: o valor entra na próxima fatura a partir daqui. Por isso a
 * extensão vai para `AGUARDANDO_CONFIGURACAO` e não direto para `ATIVA` — falta
 * a credencial para ela trazer qualquer dado.
 */
export async function mockActivateExtension(extensionId: string): Promise<Extension> {
  await delay(800);
  const target = find(extensionId);

  if (target.status !== 'DISPONIVEL') {
    throw new ApiError(409, 'Extensão já ativa', 'Esta extensão já está contratada.');
  }

  target.status = 'AGUARDANDO_CONFIGURACAO';
  target.activatedAt = new Date().toISOString();
  return { ...target };
}

export interface ConfigurePayload {
  extensionId: string;
  /** Valores dos campos declarados em `credentialFields`. */
  values: Record<string, string>;
}

/**
 * Substituto do `POST /v1/extensions/{id}/credentials`.
 *
 * ⚠️ O que volta é a **pista mascarada**, nunca o segredo. No backend real a
 * credencial vai para um cofre e o cliente não recebe mais o valor de volta —
 * devolver a chave para a tela seria vazá-la em cada abertura da página.
 */
export async function mockConfigureExtension({
  extensionId,
  values,
}: ConfigurePayload): Promise<Extension> {
  await delay(1_100);
  const target = find(extensionId);

  if (target.status === 'DISPONIVEL') {
    throw new ApiError(
      409,
      'Extensão não contratada',
      'Ative a extensão antes de cadastrar as credenciais.',
    );
  }

  for (const field of target.credentialFields) {
    if (!values[field.name]?.trim()) {
      throw new ApiError(422, 'Credencial incompleta', `Informe ${field.label.toLowerCase()}.`);
    }
  }

  /* Simula o handshake com o fornecedor: credencial curta é recusada por ele. */
  const secretField = target.credentialFields.find((field) => field.kind === 'secret');
  const secret = secretField ? (values[secretField.name] ?? '') : '';

  if (secret.trim().length < 12) {
    throw new ApiError(
      422,
      'Credencial recusada pelo fornecedor',
      'A chave informada não foi aceita. Confira se copiou o valor inteiro do portal.',
    );
  }

  target.status = 'ATIVA';
  target.health = 'OK';
  target.lastSuccessfulSyncAt = new Date().toISOString();
  target.vehiclesCovered = target.billing.model === 'POR_VEICULO' ? BILLABLE_VEHICLES : 0;
  target.healthNote = undefined;
  target.configuredHint = `${secretField?.label ?? 'Chave'} ····${secret.trim().slice(-4).toUpperCase()}`;

  return { ...target };
}

/** Substituto do `DELETE /v1/extensions/{id}`. */
export async function mockDeactivateExtension(extensionId: string): Promise<Extension> {
  await delay(800);
  const target = find(extensionId);

  if (target.status === 'DISPONIVEL') {
    throw new ApiError(409, 'Extensão já inativa', 'Esta extensão não está contratada.');
  }

  target.status = 'DISPONIVEL';
  /* Desativar revoga a credencial: manter guardada o que não se usa é risco. */
  target.configuredHint = undefined;
  target.activatedAt = undefined;
  target.health = undefined;
  target.lastSuccessfulSyncAt = undefined;
  target.vehiclesCovered = undefined;
  target.healthNote = undefined;

  return { ...target };
}
