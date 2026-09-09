import {
  EntryIcon,
  FuelIcon,
  MaintenanceIcon,
  ShieldAlertIcon,
  SpinnerIcon,
} from '@/components/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';

import {
  HeroPill,
  HeroStats,
  LightCard,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import { RecentEntries } from '@/components/shared/operator-cards';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateEntry, useEntries } from '@/hooks/use-queries';
import { useFinancialVisibility } from '@/management/features/drivers/use-financial-visibility';
import { cn } from '@/lib/utils';
import type { EntryKind } from '@/services/operator';

import {
  ENTRY_FIELDS,
  ENTRY_META,
  entrySchemaFor,
  toEntryDraft,
  type EntryFormValues,
  type FieldSpec,
} from './entry-spec';

const KINDS: EntryKind[] = ['ABASTECIMENTO', 'MULTA', 'ORDEM_MANUTENCAO', 'DESPESA'];

const EMPTY_FORM: EntryFormValues = {
  plate: '',
  at: '',
  driverName: '',
  documentNumber: '',
  station: '',
  liters: '',
  pricePerLiter: '',
  odometer: '',
  infraction: '',
  amount: '',
  dueDate: '',
  serviceType: 'PREVENTIVA',
  service: '',
  workshop: '',
  estimatedCost: '',
  category: 'PEDAGIO',
  description: '',
};

/**
 * Um formulário só, desenhado a partir da especificação do tipo escolhido
 * (`entry-spec.ts`). Quatro componentes quase idênticos é o caminho para os
 * quatro divergirem na primeira correção.
 */
function EntryForm({ kind }: { kind: EntryKind }) {
  const meta = ENTRY_META[kind];
  const fields = ENTRY_FIELDS[kind];
  const createEntry = useCreateEntry();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchemaFor(kind)) as Resolver<EntryFormValues>,
    defaultValues: EMPTY_FORM,
  });

  /* Trocar de aba troca de documento: o rascunho anterior não vale mais. */
  useEffect(() => {
    reset(EMPTY_FORM);
  }, [kind, reset]);

  async function onSubmit(values: EntryFormValues) {
    await createEntry.mutateAsync({ kind, ...toEntryDraft(kind, values) });
    reset(EMPTY_FORM);
  }

  function renderField(field: FieldSpec) {
    const error = errors[field.name as keyof EntryFormValues]?.message;
    const id = `entry-${field.name}`;

    return (
      <div key={field.name} className={cn('space-y-2', field.wide && 'sm:col-span-2')}>
        <Label htmlFor={id} className="text-on-light">
          {field.label}
        </Label>

        {field.type === 'date' ? (
          <DatePicker
            id={id}
            value={watch(field.name as keyof EntryFormValues)}
            onChange={(date) =>
              setValue(field.name as keyof EntryFormValues, date, { shouldValidate: true })
            }
            invalid={Boolean(error)}
          />
        ) : field.type === 'select' ? (
          <Select
            value={watch(field.name as keyof EntryFormValues)}
            onValueChange={(value) =>
              setValue(field.name as keyof EntryFormValues, value, { shouldValidate: true })
            }
          >
            <SelectTrigger id={id} aria-invalid={Boolean(error)}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={id}
            type="text"
            inputMode={field.type === 'number' || field.type === 'money' ? 'decimal' : undefined}
            placeholder={field.placeholder}
            aria-invalid={Boolean(error)}
            {...register(field.name as keyof EntryFormValues)}
          />
        )}

        {field.hint && !error && <p className="text-on-light-muted text-xs">{field.hint}</p>}
        {error && <p className="text-error-on-light text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <LightCard title={meta.title} description={meta.hint}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Mais colunas conforme a janela cresce: em monitor grande, duas
              colunas deixavam campos de 700px para digitar "480,5". */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {fields.map(renderField)}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="brand" disabled={createEntry.isPending}>
            {createEntry.isPending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            Lançar {meta.label.toLowerCase()}
          </Button>
          {/* `outline`, e não `ghost`: ação de apoio ao lado da principal é
              contorno marinho, o mesmo objeto do `ghost` do `SpectrumButton` no
              painel de gestão. O `ghost` do `/app` não tem traço e, ao lado de um
              botão preenchido, some. */}
          <Button type="button" variant="outline" onClick={() => reset(EMPTY_FORM)}>
            Limpar
          </Button>
        </div>
      </form>
    </LightCard>
  );
}

/**
 * Lançamentos — os quatro documentos que alimentam o custo de cada veículo.
 *
 * É a tela de trabalho do operador: ele passa o dia aqui, e o número do
 * documento é o que torna cada lançamento auditável — e o que impede a mesma
 * nota de entrar duas vezes.
 */
export default function EntriesPage() {
  const canSeeFinancials = useFinancialVisibility();
  const { data, isLoading, isError, refetch } = useEntries();

  const today = new Date().toDateString();
  const todayCount =
    data?.filter((entry) => new Date(entry.createdAt).toDateString() === today).length ?? 0;

  const entries = data ?? [];
  const countOf = (kind: EntryKind) => entries.filter((entry) => entry.kind === kind).length;

  const stats: HeroStat[] = [
    {
      key: 'hoje',
      label: 'Lançados hoje',
      value: todayCount,
      hint: 'documentos registrados',
      icon: EntryIcon,
    },
    {
      key: 'abastecimentos',
      label: 'Abastecimentos',
      value: countOf('ABASTECIMENTO'),
      hint: 'no período carregado',
      icon: FuelIcon,
    },
    {
      key: 'manutencoes',
      label: 'Ordens de manutenção',
      value: countOf('ORDEM_MANUTENCAO'),
      hint: 'abertas por lançamento',
      icon: MaintenanceIcon,
    },
    {
      key: 'multas',
      label: 'Multas',
      value: countOf('MULTA'),
      hint: 'lançadas no período',
      icon: ShieldAlertIcon,
      tone: countOf('MULTA') > 0 ? 'warn' : 'neutral',
    },
  ];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Lançamentos"
        description="O número do documento é o que torna o lançamento auditável: é ele que impede a mesma nota de entrar duas vezes."
      >
        <HeroPill icon={EntryIcon}>
          {todayCount === 0 ? 'Nada lançado hoje' : `${todayCount} hoje`}
        </HeroPill>
      </PageHero>

      <HeroStats items={stats} />

      <PagePanel className="space-y-6">
        <Tabs defaultValue="ABASTECIMENTO">
          <TabsList className="bg-surface-lowest rounded-pill mb-7 flex h-auto w-fit max-w-full justify-start gap-1 overflow-x-auto p-1.5">
            {KINDS.map((kind) => (
              <TabsTrigger
                key={kind}
                value={kind}
                className="group text-body-md rounded-pill focus-visible:ring-primary text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.06] data-[state=active]:bg-surface-low data-[state=active]:text-accent shrink-0 px-5 py-2 font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 data-[state=active]:font-medium data-[state=active]:shadow-[0_1px_2px_rgba(28,26,24,0.06),0_2px_8px_-4px_rgba(28,26,24,0.18)] data-[state=active]:hover:bg-surface-low data-[state=active]:hover:text-accent"
              >
                {ENTRY_META[kind].label}
              </TabsTrigger>
            ))}
          </TabsList>

          {KINDS.map((kind) => (
            <TabsContent key={kind} value={kind} className="mt-0">
              <EntryForm kind={kind} />
            </TabsContent>
          ))}
        </Tabs>

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <RecentEntries
            entries={data}
            canSeeAmounts={canSeeFinancials}
            title="Últimos lançamentos"
          />
        )}
      </PagePanel>
    </div>
  );
}
