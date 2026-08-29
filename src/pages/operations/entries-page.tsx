import { EntryIcon, SpinnerIcon } from '@/components/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';

import { PageHeader } from '@/components/layout/page-header';
import { RecentEntries } from '@/components/shared/operator-cards';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Label htmlFor={id}>{field.label}</Label>

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

        {field.hint && !error && <p className="text-xs text-muted-foreground">{field.hint}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{meta.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{meta.hint}</p>
      </CardHeader>

      <CardContent>
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
            <Button type="button" variant="ghost" onClick={() => reset(EMPTY_FORM)}>
              Limpar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lançamentos"
        description="Abastecimentos, multas, ordens de manutenção e despesas extraordinárias."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <EntryIcon className="h-7 w-7 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {todayCount === 0
                ? 'Nenhum lançamento hoje.'
                : todayCount === 1
                  ? '1 lançamento hoje.'
                  : `${todayCount} lançamentos hoje.`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              O número do documento é o que torna o lançamento auditável — e o que impede a mesma
              nota de entrar duas vezes.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ABASTECIMENTO">
        <TabsList>
          {KINDS.map((kind) => (
            <TabsTrigger key={kind} value={kind}>
              {ENTRY_META[kind].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {KINDS.map((kind) => (
          <TabsContent key={kind} value={kind} className="mt-6">
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
    </div>
  );
}
