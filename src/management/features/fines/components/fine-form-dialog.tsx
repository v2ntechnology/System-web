import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { maskCurrency, onlyDigits, parseDecimal } from '@/lib/input-masks';
import {
  GlassDateField,
  GlassInput,
  GlassModal,
  GlassSelect,
  SpectrumButton,
} from '@/management/ui';

import { createFine } from '../api';
import type { NewFine } from '../types';

/**
 * Cadastro de infração à mão.
 *
 * ⚠️ **Existe para o que a integração não alcança**, e não para duplicar o que
 * ela já traz: órgão que a Smartec não mapeia, autuação que chega em papel
 * antes de aparecer no SNE, multa de pátio ou de balança privada.
 *
 * ⚠️ **Os campos que o órgão emite ficam de fora de propósito.** Não há onde
 * digitar PDF da penalidade, boleto nem linha digitável: esses vêm do DETRAN, e
 * pedi-los aqui sugeriria que o RookHub emite documento, que ele não faz.
 *
 * <h2>⚠️ O corpo rola e a barra de ações fica colada embaixo</h2>
 *
 * Mesmo desenho do cadastro de caminhão e do de motorista, e aqui ele conserta
 * um defeito, não só um descompasso: o `GlassModal` é `overflow-hidden` com
 * teto de `85dvh`, então a versão anterior, que empilhava tudo num `div` solto,
 * **cortava o formulário em "Vencimento" num monitor de 950px** e deixava os
 * botões inalcançáveis. Não havia como cadastrar nada.
 *
 * ⚠️ O padding lateral também é deste componente, e não do `GlassModal`: ele só
 * aplica padding no próprio cabeçalho. Sem isto os campos encostam na borda
 * enquanto o título fica recuado, que foi o que apareceu na tela.
 */
const VAZIO = {
  stage: 'MULTA' as NewFine['stage'],
  plate: '',
  ait: '',
  infractionAt: '',
  location: '',
  city: '',
  uf: '',
  description: '',
  infractionCode: '',
  points: '',
  amount: '',
  agency: '',
  dueDate: '',
  indicationDeadline: '',
  notes: '',
};

export function FineFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const campo = (nome: keyof typeof VAZIO) => (valor: string) =>
    setForm((atual) => ({ ...atual, [nome]: valor }));

  const salvar = useMutation({
    mutationFn: () =>
      createFine({
        stage: form.stage,
        plate: form.plate.trim().toUpperCase(),
        ait: form.ait.trim() || undefined,
        infractionAt: form.infractionAt,
        location: form.location.trim() || undefined,
        city: form.city.trim() || undefined,
        uf: form.uf.trim().toUpperCase() || undefined,
        description: form.description.trim() || undefined,
        infractionCode: form.infractionCode.trim() || undefined,
        /* ⚠️ Formatar e converter andam em par: o campo mostra 1.234,56 e o que
           viaja é 1234.56. Um Number() solto aqui viraria 1,23456. */
        points: form.points ? Number(form.points) : undefined,
        amount: form.amount ? (parseDecimal(form.amount) ?? undefined) : undefined,
        agency: form.agency.trim() || undefined,
        dueDate: form.dueDate || undefined,
        indicationDeadline: form.indicationDeadline || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`Infração de ${form.plate.toUpperCase()} cadastrada.`);
      void queryClient.invalidateQueries({ queryKey: ['fines'] });
      setForm(VAZIO);
      setErros({});
      onOpenChange(false);
    },
    onError: (erro) => {
      /* A mensagem do backend vai inteira para a tela: é ela que diz o que
         fazer a seguir, e não "erro na requisição (400)". */
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível cadastrar a infração.');
    },
  });

  function enviar() {
    const novos: Record<string, string> = {};
    if (!form.plate.trim()) novos.plate = 'Informe a placa.';
    if (!form.infractionAt) novos.infractionAt = 'Informe a data da infração.';
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    salvar.mutate();
  }

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title="Cadastrar infração"
      description="Para o que não vem da Smartec: órgão não mapeado, autuação em papel ou multa de pátio."
      className="w-[calc(100vw-2rem)] max-w-[760px]"
    >
      {/*
       * ⚠️ `min-h-0 flex-1`: o `GlassModal` é uma coluna flex, e sem isto o
       * formulário se recusa a encolher. A barra de ações seria empurrada para
       * fora da área visível, que é exatamente o defeito que este desenho
       * conserta.
       */}
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!salvar.isPending) enviar();
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5 sm:px-6">
          <Secao titulo="Identificação">
            <GlassSelect
              label="Fase"
              options={[
                { value: 'MULTA', label: 'Multa, já é penalidade' },
                { value: 'NOTIFICACAO', label: 'Notificação, ainda cabe indicar condutor' },
              ]}
              value={form.stage}
              onValueChange={(v) => campo('stage')(v)}
            />

            <GlassInput
              label="Placa"
              value={form.plate}
              onChange={(e) => campo('plate')(e.target.value.toUpperCase())}
              placeholder="BAW1F62"
              error={erros.plate}
              hint="Placa sem cadastro entra marcada, como as que vêm da Smartec."
            />

            <GlassDateField
              label="Data da infração"
              value={form.infractionAt}
              onValueChange={campo('infractionAt')}
              error={erros.infractionAt}
            />

            <GlassInput
              label="Número do auto"
              value={form.ait}
              onChange={(e) => campo('ait')(e.target.value)}
              placeholder="RA11900475"
            />
          </Secao>

          <Secao titulo="A infração">
            <div className="sm:col-span-2">
              <GlassInput
                label="Descrição"
                value={form.description}
                onChange={(e) => campo('description')(e.target.value)}
                placeholder="Transitar em velocidade superior à permitida"
              />
            </div>

            <div className="sm:col-span-2">
              <GlassInput
                label="Local"
                value={form.location}
                onChange={(e) => campo('location')(e.target.value)}
                placeholder="BR-101, km 343"
              />
            </div>

            <GlassInput
              label="Município"
              value={form.city}
              onChange={(e) => campo('city')(e.target.value)}
            />

            <GlassInput
              label="UF"
              value={form.uf}
              onChange={(e) => campo('uf')(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="RJ"
            />

            <GlassInput
              label="Órgão autuador"
              value={form.agency}
              onChange={(e) => campo('agency')(e.target.value)}
              placeholder="PRF"
            />

            <GlassInput
              label="Código da infração"
              value={form.infractionCode}
              onChange={(e) => campo('infractionCode')(onlyDigits(e.target.value))}
              inputMode="numeric"
              placeholder="7587"
            />
          </Secao>

          <Secao titulo="Valores e prazos">
            <GlassInput
              label="Valor"
              value={form.amount}
              onChange={(e) => campo('amount')(maskCurrency(e.target.value))}
              inputMode="numeric"
              placeholder="195,23"
            />

            <GlassInput
              label="Pontos na CNH"
              value={form.points}
              onChange={(e) => campo('points')(onlyDigits(e.target.value).slice(0, 2))}
              inputMode="numeric"
              placeholder="5"
            />

            <GlassDateField
              label="Vencimento"
              value={form.dueDate}
              onValueChange={campo('dueDate')}
            />

            {/* Só a notificação aceita indicação, então o prazo some na multa. */}
            {form.stage === 'NOTIFICACAO' ? (
              <GlassDateField
                label="Prazo para indicar condutor"
                value={form.indicationDeadline}
                onValueChange={campo('indicationDeadline')}
                hint="Passada a data, a pontuação fica com a empresa."
              />
            ) : null}
          </Secao>

          <Secao titulo="De onde veio">
            <div className="sm:col-span-2">
              <GlassInput
                label="Observação"
                value={form.notes}
                onChange={(e) => campo('notes')(e.target.value)}
                placeholder="Balança da rodovia, autuação recebida em papel…"
              />
            </div>
          </Secao>
        </div>

        {/*
         * A barra de decisão: sair sem gravar, ou gravar.
         *
         * ⚠️ Sem sombra para cima, como o cadastro de caminhão e o de motorista.
         * A borda e o fundo já separam a barra do formulário; a sombra seria um
         * terceiro sinal para a mesma coisa.
         */}
        <div className="border-outline-variant bg-surface-low flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t px-5 py-4 sm:px-6">
          {/* Escondido no estreito: em 390px o recado ocupa três linhas e rouba
              a altura que o formulário não tem de sobra. */}
          <p className="text-on-surface-muted text-label-md hidden min-w-0 normal-case sm:block">
            O que é digitado aqui não ganha boleto nem PDF do órgão.
          </p>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* ⚠️ `danger` porque este botão FECHA e descarta o que foi
                digitado, e é a mesma leitura do cadastro de caminhão. */}
            <SpectrumButton type="button" variant="danger" onClick={() => onOpenChange(false)}>
              Cancelar
            </SpectrumButton>
            <SpectrumButton type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Cadastrando…' : 'Cadastrar infração'}
            </SpectrumButton>
          </div>
        </div>
      </form>
    </GlassModal>
  );
}

/**
 * Um grupo de campos.
 *
 * ⚠️ O título e a régua acima repetem o desenho do cadastro de caminhão: linha
 * separando, nada no primeiro grupo. Treze campos numa grade contínua viram um
 * paredão em que ninguém acha o que procura.
 */
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-outline-variant border-t pt-5 first:border-0 first:pt-0">
      <h3 className="text-on-surface-variant text-label-md mb-3 normal-case">{titulo}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/* ⚠️ O `onlyDigits` vem de `lib/input-masks`, e não é reescrito aqui: onde
   letra é sempre erro quem barra é o `onChange`, porque `inputMode` só troca o
   teclado do celular e no computador o campo continua aceitando letra. */
