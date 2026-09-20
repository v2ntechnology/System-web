import {
  AlertCircleIcon,
  ClockCountdownIcon,
  ExternalLinkIcon,
  MoneyIcon,
  PlusIcon,
  WarningIcon,
} from '@/components/icons';
import { useSession } from '@/management/features/auth/store';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { HeroBand, HeroPill, HERO_PILL } from '@/management/components/layout/hero-band';
import { HeroStats } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';
import { SegmentedFilter } from '@/management/components/layout/segmented-filter';
import { Pagination } from '@/management/ui';

import { fetchFines } from '../api';
import { FineDetailDialog } from '../components/fine-detail-dialog';
import { FineFormDialog } from '../components/fine-form-dialog';
import { FineRow } from '../components/fine-row';

/**
 * ⚠️ **Dez por página, e não trinta.** Isto é fila: lê-se de cima para baixo e
 * trata-se item a item. Com trinta, uma lista de 26 nunca mostraria paginação,
 * que foi o que aconteceu em Alertas, Impedimentos e Gamificação.
 */
const POR_PAGINA = 10;

type Recorte = 'todas' | 'MULTA' | 'NOTIFICACAO' | 'pagas' | 'sem-cadastro';

export function FinesPage() {
  const [recorte, setRecorte] = useState<Recorte>('todas');
  /* Nulo fecha o diálogo: o id aberto É o estado, e não um booleano ao lado. */
  const [aberta, setAberta] = useState<string | null>(null);
  const [cadastrando, setCadastrando] = useState(false);

  /* Mesma guarda do Pátio: cadastrar infração é escrita de frota. */
  const role = useSession()?.user.role;
  const podeCadastrar = role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN';
  const [pagina, setPagina] = useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ['fines'],
    queryFn: () => fetchFines(),
  });

  const todas = useMemo(() => data?.items ?? [], [data]);

  const filtradas = useMemo(() => {
    if (recorte === 'todas') return todas;
    if (recorte === 'sem-cadastro') return todas.filter((f) => !f.registered);
    /* ⚠️ Segue `paymentConfirmed`, e não a presença de `paidAt`: o órgão
       confirma o pagamento em respostas que nem sempre trazem a data, e filtrar
       pela data esconderia parte do que já foi quitado. */
    if (recorte === 'pagas') return todas.filter((f) => f.paymentConfirmed);
    return todas.filter((f) => f.stage === recorte);
  }, [todas, recorte]);

  /*
   * ⚠️ A página é fixada dentro do total, senão filtrar estando na página 5
   * deixa a tela vazia sem dizer por quê.
   */
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const visiveis = filtradas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  const resumo = data?.summary;

  function trocarRecorte(novo: Recorte) {
    setRecorte(novo);
    setPagina(1);
  }

  return (
    <>
      <HeroBand
        title="Multas"
        description="O que o DETRAN e o SNE registraram para a frota, do aviso que ainda aceita indicar condutor à penalidade que já tem boleto."
      >
        {resumo ? <HeroPill icon={WarningIcon}>{resumo.total} no período</HeroPill> : null}

        {/*
         * ⚠️ Guarda de TELA, e não de segurança: quem autoriza é a API, que
         * exige `vehicles.manage` no POST. Isto só evita mostrar um botão que
         * responderia 403 na cara de quem não pode cadastrar.
         */}
        {podeCadastrar ? (
          <button
            type="button"
            className={`${HERO_PILL} text-on-primary hover:bg-on-primary hover:text-primary focus-visible:ring-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2`}
            onClick={() => setCadastrando(true)}
          >
            <PlusIcon size={15} aria-hidden="true" />
            Cadastrar infração
          </button>
        ) : null}
      </HeroBand>

      {/*
       * O molde de duas camadas: a folha branca morde a faixa e os indicadores
       * moram dentro dela, como em Impedimentos, Liberações e Viagens.
       */}
      <PageContent className="rounded-t-4xl bg-light -mt-16 pt-8 sm:-mt-20 sm:rounded-t-[40px]">
        <QueryState isPending={isPending} isError={isError} label="as multas da frota">
          {data && resumo ? (
            <>
              <h2 className="sr-only">Resumo das infrações</h2>

              {/*
               * ⚠️ **"Em aberto" conta SÓ a frota cadastrada**, e o cartão de
               * "sem cadastro" existe para dizer quanto ficou de fora. O token
               * da Smartec alcança a frota do grupo inteiro, então somar tudo
               * faria o custo da transportadora incluir multa de SERVIREST, do
               * HOTEL e da MATRIZ. Um número que ninguém confere depois.
               */}
              <HeroStats
                items={[
                  {
                    key: 'aberto',
                    label: 'Em aberto',
                    value: moeda(resumo.openAmount),
                    hint: 'Só da frota cadastrada',
                    icon: MoneyIcon,
                    tone: resumo.openAmount > 0 ? 'warn' : 'neutral',
                  },
                  {
                    key: 'vencidas',
                    label: 'Vencidas',
                    value: resumo.overdue,
                    hint: 'Passaram da data e não constam pagas',
                    icon: AlertCircleIcon,
                    tone: resumo.overdue > 0 ? 'alert' : 'neutral',
                    onSelect: () => trocarRecorte('MULTA'),
                    selected: recorte === 'MULTA',
                  },
                  {
                    key: 'indicar',
                    label: 'Prazo de indicação',
                    value: resumo.indicationExpiring,
                    hint: 'Vencem em até 15 dias',
                    icon: ClockCountdownIcon,
                    tone: resumo.indicationExpiring > 0 ? 'warn' : 'neutral',
                    onSelect: () => trocarRecorte('NOTIFICACAO'),
                    selected: recorte === 'NOTIFICACAO',
                  },
                  {
                    key: 'sem-cadastro',
                    label: 'Sem cadastro',
                    value: resumo.withoutRegistration,
                    hint: 'Placas que a Smartec tem e o sistema não',
                    icon: ExternalLinkIcon,
                    onSelect: () => trocarRecorte('sem-cadastro'),
                    selected: recorte === 'sem-cadastro',
                  },
                ]}
              />

              <div className="mt-8">
                <SegmentedFilter<Recorte>
                  label="Recorte das infrações"
                  options={[
                    { id: 'todas', label: 'Todas', count: todas.length },
                    { id: 'MULTA', label: 'Multas', count: resumo.fines },
                    { id: 'NOTIFICACAO', label: 'Notificações', count: resumo.notices },
                    { id: 'pagas', label: 'Pagas', count: resumo.paid },
                    {
                      id: 'sem-cadastro',
                      label: 'Sem cadastro',
                      count: resumo.withoutRegistration,
                    },
                  ]}
                  value={recorte}
                  onValueChange={trocarRecorte}
                />
              </div>

              <p className="text-on-light-variant text-body-sm mt-6">
                {frase(filtradas.length, todas.length, data.collectedAt)}
              </p>

              <ul className="mt-4 flex flex-col gap-3">
                {visiveis.map((fine) => (
                  <li key={fine.id}>
                    <FineRow fine={fine} onOpen={() => setAberta(fine.id)} />
                  </li>
                ))}
              </ul>

              {filtradas.length === 0 ? (
                <p className="text-on-light-variant text-body-md py-10 text-center">
                  Nenhuma infração neste recorte.
                </p>
              ) : null}

              {paginas > 1 ? (
                <div className="mt-6">
                  <Pagination
                    page={atual}
                    pageCount={paginas}
                    pageSize={POR_PAGINA}
                    total={filtradas.length}
                    onPageChange={setPagina}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </QueryState>
      </PageContent>

      <FineDetailDialog fineId={aberta} onOpenChange={(open) => setAberta(open ? aberta : null)} />
      <FineFormDialog open={cadastrando} onOpenChange={setCadastrando} />
    </>
  );
}

function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/**
 * ⚠️ **Sem coleta, a tela DIZ que nunca coletou.** Inventar "atualizado agora"
 * quando a tabela está vazia é o tipo de frase que faz alguém concluir que a
 * frota não tem multa nenhuma.
 */
function frase(visiveis: number, total: number, collectedAt: string): string {
  const recorte = visiveis === total ? `${total} infrações` : `${visiveis} de ${total} infrações`;
  if (!collectedAt) return `${recorte}. A coleta na Smartec ainda não rodou.`;
  const quando = new Date(collectedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${recorte}, coletadas da Smartec em ${quando}.`;
}
