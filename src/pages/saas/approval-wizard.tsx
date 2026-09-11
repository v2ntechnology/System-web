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
import { PLAN_DEFINITIONS, PLAN_LABELS } from '@/app/plans';
import { SLUG_ERROR_MESSAGE, suggestSlug, validateSlug } from '@/app/tenant-slug';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  APPROVED_FONTS,
  TELEMETRY_PROVIDERS,
  type SaasAccessRequest,
  type SaasTenant,
} from '@/mocks/saas';
import type { ApprovalInput } from '@/stores/saas-store';
import type { PlanType, TelemetryState } from '@/types';

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
 */
const STEPS: { id: string; label: string; icon: IconType }[] = [
  { id: 'dados', label: 'Dados e endereço', icon: CompanyIcon },
  { id: 'telemetria', label: 'Telemetria', icon: SatelliteIcon },
  { id: 'marca', label: 'Marca', icon: PaletteIcon },
  { id: 'plano', label: 'Plano', icon: PlanIcon },
];

const PLAN_ORDER: PlanType[] = ['starter', 'business', 'enterprise'];

const DEFAULT_COLOR = '#d5623a';

interface ApprovalWizardProps {
  request: SaasAccessRequest | null;
  tenants: SaasTenant[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: ApprovalInput) => void;
}

export function ApprovalWizard({
  request,
  tenants,
  open,
  onOpenChange,
  onConfirm,
}: ApprovalWizardProps) {
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const [provider, setProvider] = useState<string>('none');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [accent, setAccent] = useState('');
  const [font, setFont] = useState('default');
  const [plan, setPlan] = useState<PlanType>('business');

  /* O formulário nasce preenchido com o que a transportadora declarou no site.
     É rascunho: cada campo continua editável, porque o endereço e o fornecedor
     são decisão nossa, não dela. */
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (request && seededFor !== request.id) {
    setSeededFor(request.id);
    setStep(0);
    setName(request.company);
    setDocument(request.document);
    setSlug(suggestSlug(request.company));
    setOwnerName(request.contactName);
    setOwnerEmail(request.contactEmail);
    const declared = TELEMETRY_PROVIDERS.find((p) => p.label === request.declaredProvider);
    setProvider(declared?.value ?? 'none');
    setColor(DEFAULT_COLOR);
    setAccent('');
    setFont('default');
    setPlan(
      request.fleetSize > 200 ? 'enterprise' : request.fleetSize > 25 ? 'business' : 'starter',
    );
  }

  const takenSlugs = useMemo(() => tenants.map((t) => t.slug), [tenants]);
  const slugError = validateSlug(slug, takenSlugs);

  const providerEntry = TELEMETRY_PROVIDERS.find((p) => p.value === provider);
  const telemetryState: TelemetryState = !providerEntry
    ? 'PENDING_CONTRACT'
    : providerEntry.hasConnector
      ? 'CONNECTED'
      : 'PENDING_CONNECTOR';

  const colorValid = /^#[0-9a-fA-F]{6}$/.test(color);
  const accentValid = accent === '' || /^#[0-9a-fA-F]{6}$/.test(accent);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail);

  const stepValid = [
    !slugError && name.trim().length > 1 && ownerName.trim().length > 1 && emailValid,
    true,
    colorValid && accentValid,
    true,
  ];

  const canAdvance = stepValid[step] ?? false;
  const isLast = step === STEPS.length - 1;

  function handleConfirm() {
    if (!request) return;
    onConfirm({
      slug,
      name: name.trim(),
      document: document.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      telemetryProvider: providerEntry?.label ?? null,
      telemetryState,
      branding: {
        colorPrimary: color,
        ...(accent ? { colorAccent: accent } : {}),
        fontFamily: font,
      },
      plan,
    });
    onOpenChange(false);
  }

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aprovar {request.company}</DialogTitle>
          <DialogDescription>
            A aprovação parametriza e provisiona o ambiente, e cria apenas a credencial do Dono. Ele
            define os cargos e cadastra o time depois.
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
                slugError,
                emailValid,
              }}
            />
          )}
          {step === 1 && (
            <StepTelemetry provider={provider} setProvider={setProvider} state={telemetryState} />
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
          {step === 3 && <StepPlan plan={plan} setPlan={setPlan} fleetSize={request.fleetSize} />}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}
          >
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          <Button
            onClick={() => (isLast ? handleConfirm() : setStep(step + 1))}
            disabled={!canAdvance}
          >
            {isLast ? 'Aprovar e provisionar' : 'Continuar'}
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
  hint?: string;
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
  slugError: ReturnType<typeof validateSlug>;
  emailValid: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Razão social">
          <Input value={props.name} onChange={(e) => props.setName(e.target.value)} />
        </Field>
        <Field label="CNPJ">
          <Input value={props.document} onChange={(e) => props.setDocument(e.target.value)} />
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
            É a única conta que a aprovação cria. Ele recebe um link de convite por e-mail, define a
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
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Passo 2: telemetria                                                         */
/* -------------------------------------------------------------------------- */

function StepTelemetry({
  provider,
  setProvider,
  state,
}: {
  provider: string;
  setProvider: (v: string) => void;
  state: TelemetryState;
}) {
  return (
    <div className="space-y-5">
      <Field
        label="Fornecedor de rastreamento"
        hint="A conta no fornecedor é do cliente. A RookHub intermedia a integração, não revende o rastreamento."
      >
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum ainda</SelectItem>
            {TELEMETRY_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
                {!p.hasConnector && ' (sem conector)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {state === 'CONNECTED' && (
        <Callout tone="success" icon={CheckIcon} title="Conecta na aprovação">
          A credencial é gravada cifrada e a coleta começa assim que o ambiente ficar pronto.
        </Callout>
      )}
      {state === 'PENDING_CONNECTOR' && (
        <Callout tone="warning" title="Fornecedor sem conector implementado">
          O ambiente é liberado assim mesmo: a integração entra desativada e a tela de integrações
          do cliente mostra “aguardando conector”, em vez de frota vazia sem explicação. Hoje só a
          MiX tem conector.
        </Callout>
      )}
      {state === 'PENDING_CONTRACT' && (
        <Callout tone="info" title="Sem contrato de rastreamento">
          A RookHub indica o fornecedor homologado; a contratação é do cliente. O ambiente é
          liberado e a telemetria entra depois, sem refazer o onboarding.
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
              value={props.colorValid ? props.color : '#d5623a'}
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

        <Field label="Logo" hint="PNG ou SVG, até 256 KB. Pode ser enviado depois pelo TI Topo.">
          <Button variant="outline" size="sm" type="button" className="w-full">
            Enviar arquivo
          </Button>
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Prévia do login (a marca aparece antes de haver sessão)
        </p>
        <BrandPreview
          branding={{
            colorPrimary: props.colorValid ? props.color : '#d5623a',
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
  fleetSize: number;
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
          const tooSmall = definition.vehicleLimit < fleetSize;
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
