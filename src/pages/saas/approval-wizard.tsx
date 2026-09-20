import { maskCnpj } from '@/lib/input-masks';
import { CheckIcon, CompanyIcon, PaletteIcon, PlanIcon, SatelliteIcon } from '@/components/icons';
import type { IconType } from '@/components/icons';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { APPROVED_FONTS } from '@/app/fonts';
import { PLAN_DEFINITIONS, PLAN_LABELS, PLAN_ORDER } from '@/app/plans';
import { SLUG_ERROR_MESSAGE, suggestSlug, validateSlug } from '@/app/tenant-slug';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TELEMETRY_PROVIDERS, type SaasAccessRequest, type SaasTenant } from '@/mocks/saas';
import type { PlanType, TelemetryState } from '@/types';

import type { TelemetrySetup, TenantSetupInput } from './saas-api';
import { BrandPreview, Callout, DomainPreview } from './saas-ui';

/* -------------------------------------------------------------------------- */
/* Passos                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A aprovação é um formulário de quatro passos, e não um botão.
 *
 * Aprovar significa parametrizar: endereço, telemetria, marca e plano. O
 * ambiente só fica utilizável quando os quatro estão resolvidos, então separá-los
 * em passos é o que impede alguém de clicar "aprovar" e descobrir depois que
 * faltava escolher o fornecedor.
 *
 * ⚠️ **O mesmo assistente faz o cadastro direto**, sem solicitação nenhuma
 * antes, que é o caminho da venda ativa. A única diferença de contrato está no
 * passo 1: ali o nome e o documento da empresa são digitados, porque não há
 * solicitação de onde tirá-los, e o e-mail do Dono passa a ser obrigatório.
 * Duas telas separadas seriam duas cópias divergindo na primeira regra nova.
 */
const STEPS: { id: string; label: string; icon: IconType }[] = [
  { id: 'dados', label: 'Dados e endereço', icon: CompanyIcon },
  { id: 'telemetria', label: 'Telemetria', icon: SatelliteIcon },
  { id: 'marca', label: 'Marca', icon: PaletteIcon },
  { id: 'plano', label: 'Plano', icon: PlanIcon },
];

const DEFAULT_COLOR = '#d5623a';

/** Valor do seletor para "nenhum fornecedor ainda". */
const SEM_FORNECEDOR = 'none';

interface ApprovalWizardProps {
  /** Nulo abre o cadastro direto: o mesmo assistente, com o passo 1 vazio. */
  request: SaasAccessRequest | null;
  tenants: SaasTenant[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: TenantSetupInput) => void;
  salvando?: boolean;
}

export function ApprovalWizard({
  request,
  tenants,
  open,
  onOpenChange,
  onConfirm,
  salvando = false,
}: ApprovalWizardProps) {
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [commandRoleName, setCommandRoleName] = useState('');

  const [provider, setProvider] = useState<string>(SEM_FORNECEDOR);
  const [mixClientId, setMixClientId] = useState('');
  const [mixClientSecret, setMixClientSecret] = useState('');
  const [mixUsername, setMixUsername] = useState('');
  const [mixPassword, setMixPassword] = useState('');

  const [color, setColor] = useState(DEFAULT_COLOR);
  const [accent, setAccent] = useState('');
  const [font, setFont] = useState('default');
  const [plan, setPlan] = useState<PlanType>('business');

  /* O formulário nasce preenchido com o que a transportadora declarou no site.
     É rascunho: cada campo continua editável, porque o endereço e o fornecedor
     são decisão nossa, não dela. No cadastro direto ele nasce vazio. */
  const semeadoPara = request?.id ?? (open ? 'direto' : null);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (semeadoPara && seededFor !== semeadoPara) {
    setSeededFor(semeadoPara);
    setStep(0);
    setName(request?.company ?? '');
    setDocument(request?.document ?? '');
    setSlug(request ? suggestSlug(request.company) : '');
    setOwnerName(request?.contactName ?? '');
    setOwnerEmail(request?.contactEmail ?? '');
    setCommandRoleName('');
    const declared = TELEMETRY_PROVIDERS.find((p) => p.label === request?.declaredProvider);
    setProvider(declared?.value ?? SEM_FORNECEDOR);
    setMixClientId('');
    setMixClientSecret('');
    setMixUsername('');
    setMixPassword('');
    setColor(DEFAULT_COLOR);
    setAccent('');
    setFont('default');
    const frota = request?.fleetSize ?? 0;
    setPlan(frota > 200 ? 'enterprise' : frota > 25 ? 'business' : 'starter');
  }

  const takenSlugs = useMemo(() => tenants.map((t) => t.slug), [tenants]);
  const slugError = validateSlug(slug, takenSlugs);

  const providerEntry = TELEMETRY_PROVIDERS.find((p) => p.value === provider);
  const usaMix = provider === 'mix';
  const telemetryState: TelemetryState = !providerEntry
    ? 'PENDING_CONTRACT'
    : providerEntry.hasConnector
      ? 'CONNECTED'
      : 'PENDING_CONNECTOR';

  /*
   * ⚠️ A credencial da MiX é obrigatória, e a recusa é do backend.
   *
   * Escolher MiX sem os quatro campos responde 400, porque a validação acontece
   * ANTES de a empresa ser criada: lá dentro, um campo faltando viraria empresa
   * com provisionamento falho em vez de uma mensagem em quem preencheu. Barrar o
   * avanço aqui é dizer a mesma coisa antes de a requisição sair.
   */
  const mixCompleta =
    mixClientId.trim() !== '' &&
    mixClientSecret.trim() !== '' &&
    mixUsername.trim() !== '' &&
    mixPassword.trim() !== '';

  const colorValid = /^#[0-9a-fA-F]{6}$/.test(color);
  const accentValid = accent === '' || /^#[0-9a-fA-F]{6}$/.test(accent);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail);

  const stepValid = [
    !slugError && name.trim().length > 1 && ownerName.trim().length > 1 && emailValid,
    !usaMix || mixCompleta,
    colorValid && accentValid,
    true,
  ];

  const canAdvance = (stepValid[step] ?? false) && !salvando;
  const isLast = step === STEPS.length - 1;
  const cadastroDireto = request === null;

  function telemetria(): TelemetrySetup {
    if (usaMix) {
      return {
        provider: 'MIX',
        mix: {
          clientId: mixClientId.trim(),
          clientSecret: mixClientSecret.trim(),
          username: mixUsername.trim(),
          password: mixPassword,
        },
      };
    }
    if (providerEntry) {
      return { provider: 'OUTRO', providerName: providerEntry.label };
    }
    return { provider: 'NENHUM' };
  }

  function handleConfirm() {
    onConfirm({
      slug,
      plan,
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      ...(commandRoleName.trim() ? { commandRoleName: commandRoleName.trim() } : {}),
      telemetry: telemetria(),
      branding: {
        colorPrimary: color,
        ...(accent ? { colorAccent: accent } : {}),
        fontFamily: font,
      },
      /* Só a venda ativa manda estes dois: na aprovação eles vêm da
         solicitação, e mandá-los de volta deixaria a tela reescrever o que o
         cliente declarou. */
      ...(cadastroDireto ? { companyName: name.trim(), document: document.trim() } : {}),
    });
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cadastroDireto ? 'Cadastrar transportadora' : `Aprovar ${request.company}`}
          </DialogTitle>
          <DialogDescription>
            {cadastroDireto
              ? 'Venda ativa: o mesmo assistente da aprovação, com os dados da empresa digitados aqui. O ambiente é provisionado igual.'
              : 'A aprovação parametriza e provisiona o ambiente, e cria apenas a credencial do Dono. Ele define os cargos e cadastra o time depois.'}
          </DialogDescription>
        </DialogHeader>

        <StepRail current={step} onSelect={(i) => i < step && setStep(i)} />

        <div className="min-h-[320px] py-2">
          {step === 0 && (
            <StepIdentity
              {...{
                name,
                setName,
                document,
                setDocument,
                slug,
                setSlug,
                ownerName,
                setOwnerName,
                ownerEmail,
                setOwnerEmail,
                commandRoleName,
                setCommandRoleName,
                slugError,
                emailValid,
                cadastroDireto,
              }}
            />
          )}
          {step === 1 && (
            <StepTelemetry
              {...{
                provider,
                setProvider,
                state: telemetryState,
                usaMix,
                mixClientId,
                setMixClientId,
                mixClientSecret,
                setMixClientSecret,
                mixUsername,
                setMixUsername,
                mixPassword,
                setMixPassword,
              }}
            />
          )}
          {step === 2 && (
            <StepBranding
              {...{
                color,
                setColor,
                accent,
                setAccent,
                font,
                setFont,
                colorValid,
                accentValid,
                name,
                slug,
              }}
            />
          )}
          {step === 3 && <StepPlan plan={plan} setPlan={setPlan} fleetSize={request?.fleetSize} />}
        </div>

        {/* ⚠️ As duas ações andam JUNTAS, à direita, e a de sair é `outline`.
            É o rodapé que o convite da equipe já usa (`member-dialog.tsx`), e o
            mesmo do `ConfirmDialog`, do convite da plataforma e da recusa de
            solicitação: um padrão só para todo modal do backoffice. Aqui havia
            `sm:justify-between`, que jogava "Cancelar" para o canto oposto, e
            `ghost`, que tirava o traço e deixava a saída parecendo texto solto. */}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}
            disabled={salvando}
          >
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          <Button
            onClick={() => (isLast ? handleConfirm() : setStep(step + 1))}
            disabled={!canAdvance}
          >
            {isLast ? 'Criar e provisionar' : 'Continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Trilho de passos                                                            */
/* -------------------------------------------------------------------------- */

function StepRail({ current, onSelect }: { current: number; onSelect: (index: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {STEPS.map((s, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={s.id} className="flex-1">
            <button
              type="button"
              onClick={() => onSelect(index)}
              disabled={!done}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors',
                active && 'bg-background text-foreground shadow-sm',
                done && 'text-accent hover:bg-background/60',
                !active && !done && 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]',
                  active && 'bg-primary-strong text-on-primary',
                  done && 'bg-success/20 text-success-on-light',
                  !active && !done && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Passo 1: dados e endereço                                                   */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-error-on-light">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function StepIdentity(props: {
  name: string;
  setName: (v: string) => void;
  document: string;
  setDocument: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  ownerName: string;
  setOwnerName: (v: string) => void;
  ownerEmail: string;
  setOwnerEmail: (v: string) => void;
  commandRoleName: string;
  setCommandRoleName: (v: string) => void;
  slugError: ReturnType<typeof validateSlug>;
  emailValid: boolean;
  cadastroDireto: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Razão social"
          hint={props.cadastroDireto ? 'Não há solicitação: o nome é digitado aqui.' : undefined}
        >
          <Input value={props.name} onChange={(e) => props.setName(e.target.value)} />
        </Field>
        <Field label="CNPJ">
          <Input
            value={props.document}
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            onChange={(e) => props.setDocument(maskCnpj(e.target.value))}
          />
        </Field>
      </div>

      <Field
        label="Endereço da transportadora"
        hint="É o subdomínio e o nome do schema no banco. Não muda depois de criado."
        error={props.slugError ? SLUG_ERROR_MESSAGE[props.slugError] : undefined}
      >
        <Input
          value={props.slug}
          onChange={(e) => props.setSlug(e.target.value.toLowerCase().trim())}
          className="font-mono"
          placeholder="amazonas"
        />
      </Field>
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <DomainPreview slug={props.slug} />
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <p className="font-display text-sm font-semibold">Credencial do Dono</p>
          <p className="text-xs text-muted-foreground">
            É a única conta que a criação faz. Ele recebe um link de convite por e-mail, define a
            senha e monta o próprio time.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input value={props.ownerName} onChange={(e) => props.setOwnerName(e.target.value)} />
          </Field>
          <Field
            label="E-mail"
            error={props.ownerEmail && !props.emailValid ? 'E-mail inválido.' : undefined}
          >
            <Input
              type="email"
              value={props.ownerEmail}
              onChange={(e) => props.setOwnerEmail(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Nome do cargo de comando (opcional)"
          hint="O cargo que administra a empresa chama-se Dono por padrão. Se o cliente usa outro nome, como Diretoria, é aqui."
        >
          <Input
            value={props.commandRoleName}
            onChange={(e) => props.setCommandRoleName(e.target.value)}
            placeholder="Dono"
          />
        </Field>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Passo 2: telemetria                                                         */
/* -------------------------------------------------------------------------- */

function StepTelemetry(props: {
  provider: string;
  setProvider: (v: string) => void;
  state: TelemetryState;
  usaMix: boolean;
  mixClientId: string;
  setMixClientId: (v: string) => void;
  mixClientSecret: string;
  setMixClientSecret: (v: string) => void;
  mixUsername: string;
  setMixUsername: (v: string) => void;
  mixPassword: string;
  setMixPassword: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Field
        label="Fornecedor de rastreamento"
        hint="A conta no fornecedor é do cliente. A RookHub intermedia a integração, não revende o rastreamento."
      >
        <Select value={props.provider} onValueChange={props.setProvider}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FORNECEDOR}>Nenhum ainda</SelectItem>
            {TELEMETRY_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
                {!p.hasConnector && ' (sem conector)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {props.usaMix && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div>
            <p className="font-display text-sm font-semibold">Credencial da conta na MiX</p>
            <p className="text-xs text-muted-foreground">
              É a conta que o cliente já tem na MiX, e não uma nossa. Sem os quatro campos a API
              recusa a criação, antes de a empresa existir.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client ID">
              <Input
                value={props.mixClientId}
                onChange={(e) => props.setMixClientId(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Client secret">
              <Input
                type="password"
                value={props.mixClientSecret}
                onChange={(e) => props.setMixClientSecret(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Usuário">
              <Input
                value={props.mixUsername}
                onChange={(e) => props.setMixUsername(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={props.mixPassword}
                onChange={(e) => props.setMixPassword(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            A credencial é gravada cifrada. As URLs da MiX não mudam por cliente e ficam na
            configuração da API.
          </p>
        </div>
      )}

      {props.state === 'CONNECTED' && (
        <Callout tone="success" icon={CheckIcon} title="Conecta na aprovação">
          A credencial é gravada cifrada e a coleta começa assim que o ambiente ficar pronto.
        </Callout>
      )}
      {props.state === 'PENDING_CONNECTOR' && (
        <Callout tone="warning" title="Fornecedor sem conector implementado">
          O ambiente é liberado assim mesmo: a integração entra desativada e a tela de integrações
          do cliente mostra “aguardando conector”, em vez de frota vazia sem explicação. Hoje só a
          MiX tem conector.
        </Callout>
      )}
      {props.state === 'PENDING_CONTRACT' && (
        <Callout tone="info" title="Sem contrato de rastreamento">
          Escolha válida, e não pendência: a RookHub indica o fornecedor homologado, a contratação é
          do cliente e o ambiente fica pronto do mesmo jeito. A telemetria entra depois, sem refazer
          o onboarding.
        </Callout>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Passo 3: marca                                                              */
/* -------------------------------------------------------------------------- */

function StepBranding(props: {
  color: string;
  setColor: (v: string) => void;
  accent: string;
  setAccent: (v: string) => void;
  font: string;
  setFont: (v: string) => void;
  colorValid: boolean;
  accentValid: boolean;
  name: string;
  slug: string;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-5">
        <Field
          label="Cor principal"
          hint="Sobrescreve as variáveis de tema no boot. Nenhum componente muda de estrutura."
          error={props.colorValid ? undefined : 'Use o formato #rrggbb.'}
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={props.colorValid ? props.color : DEFAULT_COLOR}
              onChange={(e) => props.setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
              aria-label="Selecionar cor principal"
            />
            <Input
              value={props.color}
              onChange={(e) => props.setColor(e.target.value)}
              className="font-mono"
            />
          </div>
        </Field>

        <Field
          label="Cor de apoio (opcional)"
          error={props.accentValid ? undefined : 'Use o formato #rrggbb.'}
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={props.accent && props.accentValid ? props.accent : '#1f3a5f'}
              onChange={(e) => props.setAccent(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
              aria-label="Selecionar cor de apoio"
            />
            <Input
              value={props.accent}
              onChange={(e) => props.setAccent(e.target.value)}
              placeholder="#1f3a5f"
              className="font-mono"
            />
          </div>
        </Field>

        <Field
          label="Fonte"
          hint="Lista homologada. Upload livre traria licenciamento de terceiro para dentro da nossa hospedagem."
        >
          <Select value={props.font} onValueChange={props.setFont}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVED_FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* ⚠️ O logo não cabe aqui: o envio é por rota própria e exige o id da
            empresa, que só existe depois da criação. */}
        <Callout tone="info" title="O logo entra depois">
          Arquivo não viaja no corpo da criação. Abra a ficha da empresa, na aba Marca, e envie o
          PNG ou SVG por lá.
        </Callout>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Prévia do login (a marca aparece antes de haver sessão)
        </p>
        <BrandPreview
          branding={{
            colorPrimary: props.colorValid ? props.color : DEFAULT_COLOR,
            fontFamily: props.font,
          }}
          companyName={props.name}
          slug={props.slug}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Passo 4: plano                                                              */
/* -------------------------------------------------------------------------- */

function StepPlan({
  plan,
  setPlan,
  fleetSize,
}: {
  plan: PlanType;
  setPlan: (p: PlanType) => void;
  /** Ausente no cadastro direto, e em solicitação que não informou a frota. */
  fleetSize: number | undefined;
}) {
  return (
    <div className="space-y-4">
      <Callout tone="info" title="O plano é o teto da empresa">
        O plano define quais módulos existem; o cargo distribui o que sobrou. Rota de módulo não
        contratado devolve 402, e não 403: a distinção deixa a tela oferecer upgrade em vez de dizer
        “sem acesso”.
      </Callout>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_ORDER.map((key) => {
          const definition = PLAN_DEFINITIONS[key];
          const selected = plan === key;
          const tooSmall = fleetSize !== undefined && definition.vehicleLimit < fleetSize;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPlan(key)}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold">{PLAN_LABELS[key]}</span>
                {selected && <CheckIcon className="h-4 w-4 text-primary" />}
              </div>
              <p className="font-display text-xl font-bold">
                {formatCurrency(definition.monthlyPrice)}
                <span className="text-xs font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="text-xs text-muted-foreground">{definition.description}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                <Badge variant="muted">{definition.modules.length} módulos</Badge>
                {/* ⚠️ Referência comercial, e não trava: o backend não aplica
                    limite de veículo nenhum hoje. */}
                <Badge variant={tooSmall ? 'warning' : 'muted'}>
                  até {definition.vehicleLimit} veículos
                </Badge>
              </div>
              {tooSmall && (
                <p className="text-xs text-warning-on-light">
                  A frota declarada tem {fleetSize} veículos.
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Módulos liberados no {PLAN_LABELS[plan]}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PLAN_DEFINITIONS[plan].modules.map((m) => (
            <Badge key={m} variant="outline">
              {m}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
