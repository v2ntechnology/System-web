import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { BrandLogo } from '@/components/shared/brand-logo';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from '@/components/icons';
import { LoadingState } from '@/components/shared/states';
import { Spinner } from '@/management/ui/spinner';
import { cn } from '@/lib/utils';
import {
  fetchAssistantVoices,
  synthesizeAssistantSpeech,
  type AssistantVoice,
} from '@/services/voice';

/**
 * Vitrine das vozes, para ouvir todas e escolher a da assistente.
 *
 * ⚠️ **Tela temporária** (12/09/2026), criada a pedido do usuário para comparar
 * as 30 vozes do Chirp 3 HD depois da troca da ElevenLabs pelo Google. Ela não
 * está no menu: só responde em `/assistente/vozes`. Quando o timbre estiver
 * escolhido, isto sai.
 *
 * O catálogo vem do servidor, nunca de lista fixa daqui: as vozes mudam com o
 * provedor ativo, e uma lista no cliente ofereceria timbre que não vai sair.
 */

/* Uma frase do domínio, e não "teste 1 2 3": o que se quer julgar é como cada
   voz lê placa, número e nome de empresa, que é o que a assistente fala o dia
   inteiro. */
const FRASE_PADRAO =
  'A frota da Servioeste tem quarenta caminhões em operação. ' +
  'O consumo médio ficou em três vírgula cinco quilômetros por litro.';

type Estado = 'parada' | 'carregando' | 'tocando';

/**
 * O tier sai do id, e a tela precisa dele.
 *
 * ⚠️ **Escolher voz aqui é escolher preço**, e a diferença é de oito vezes entre
 * a mais barata e a mais cara. Mostrar só o nome deixaria alguém adotar uma
 * Chirp 3 HD achando que custa o mesmo que uma Standard. O backend não informa
 * o tier, mas ele está no próprio id, que é estável.
 */
const TIERS = [
  { marca: 'Chirp3-HD', nome: 'Chirp 3 HD', preco: 'US$ 30 / 1M' },
  { marca: 'Chirp-HD', nome: 'Chirp HD', preco: 'US$ 30 / 1M' },
  { marca: 'Studio', nome: 'Studio', preco: 'US$ 160 / 1M' },
  { marca: 'Neural2', nome: 'Neural2', preco: 'US$ 16 / 1M' },
  { marca: 'Wavenet', nome: 'WaveNet', preco: 'US$ 4 / 1M' },
  { marca: 'Standard', nome: 'Standard', preco: 'US$ 4 / 1M' },
] as const;

function tierDaVoz(id: string) {
  return TIERS.find((t) => id.includes(t.marca)) ?? { nome: 'Outro', preco: '-' };
}

interface GrupoProps {
  titulo: string;
  /** O preço do tier, ao lado do título: escolher voz é escolher custo. */
  preco: string;
  lista: AssistantVoice[];
  estados: Record<string, Estado>;
  favoritas: Set<string>;
  onOuvir: (voz: AssistantVoice) => void;
  onMarcar: (id: string) => void;
}

/**
 * ⚠️ Fora do componente de propósito.
 *
 * Declarado dentro do render, o React o trata como um tipo NOVO a cada
 * renderização, desmontando e remontando a lista inteira. Na prática, o áudio
 * que estivesse tocando pararia a cada clique numa estrela.
 */
function Grupo({ titulo, preco, lista, estados, favoritas, onOuvir, onMarcar }: GrupoProps) {
  const femininas = lista.filter((v) => v.gender === 'FEMININA').length;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-sora text-on-surface text-lg font-bold">{titulo}</h2>
        <span className="text-on-surface-variant text-sm">
          {lista.length} vozes · {femininas}F / {lista.length - femininas}M
        </span>
        <span className="border-outline-variant text-on-surface-variant rounded-full border px-2 py-0.5 text-xs font-semibold">
          {preco}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {lista.map((voz) => {
          const estado = estados[voz.id] ?? 'parada';
          const marcada = favoritas.has(voz.id);
          return (
            <div
              key={voz.id}
              className={cn(
                'border-outline-variant bg-surface flex items-center gap-3 rounded-lg border p-3 transition-colors',
                marcada && 'border-primary bg-primary/5',
              )}
            >
              <Button
                type="button"
                size="sm"
                variant={estado === 'tocando' ? 'default' : 'outline'}
                className="shrink-0"
                onClick={() => onOuvir(voz)}
                disabled={estado === 'carregando'}
              >
                {estado === 'carregando' ? <Spinner label="" /> : estado === 'tocando' ? '❚❚' : '▶'}
              </Button>

              <div className="min-w-0 flex-1">
                <p className="text-on-surface truncate text-sm font-semibold">
                  {voz.label}{' '}
                  <span className="text-on-surface-variant text-xs font-normal">
                    {voz.gender === 'FEMININA' ? 'F' : 'M'}
                  </span>
                </p>
                <p className="text-on-surface-variant truncate text-xs">{voz.id}</p>
              </div>

              <button
                type="button"
                onClick={() => onMarcar(voz.id)}
                aria-label={marcada ? `Desmarcar ${voz.label}` : `Marcar ${voz.label}`}
                className={cn(
                  'shrink-0 rounded-md px-2 py-1 text-lg transition-colors',
                  marcada ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {marcada ? '★' : '☆'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function VoiceCatalogPage() {
  const [vozes, setVozes] = useState<AssistantVoice[]>([]);
  const [provedor, setProvedor] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [frase, setFrase] = useState(FRASE_PADRAO);

  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [favoritas, setFavoritas] = useState<Set<string>>(new Set());

  /* Um só objeto de áudio: tocar a segunda voz interrompe a primeira, que é o
     comportamento que se quer ao comparar timbres em sequência. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const controlador = new AbortController();
    fetchAssistantVoices(controlador.signal)
      .then((r) => {
        setVozes(r.voices);
        setProvedor(r.provider);
        setCarregandoLista(false);
      })
      .catch((e: unknown) => {
        /* ⚠️ Cancelamento não é erro, e mostrar como erro engana. O StrictMode
           monta o componente duas vezes em desenvolvimento: o primeiro pedido é
           abortado de propósito, e sem esta guarda a tela abria com
           "signal is aborted without reason" mesmo tendo carregado tudo. */
        if (controlador.signal.aborted) return;
        setErro(e instanceof Error ? e.message : 'Falha ao listar as vozes.');
        setCarregandoLista(false);
      });
    return () => controlador.abort();
  }, []);

  /* Libera o blob da fala anterior. Sem isto, ouvir as trinta vozes deixa trinta
     objetos presos na memória da aba. */
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  /**
   * Agrupado por TIER, e não por gênero.
   *
   * ⚠️ Comparar timbre entre tiers é o que interessa aqui: a diferença entre uma
   * Standard e uma Chirp 3 HD é muito maior que entre duas vozes do mesmo tier,
   * e custa oito vezes mais. Dentro do grupo, femininas primeiro, porque a voz
   * atual da assistente é feminina.
   */
  const grupos = useMemo(() => {
    const porTier = new Map<string, AssistantVoice[]>();
    for (const voz of vozes) {
      const { nome } = tierDaVoz(voz.id);
      const lista = porTier.get(nome) ?? [];
      lista.push(voz);
      porTier.set(nome, lista);
    }
    return TIERS.map((t) => t.nome)
      .filter((nome) => porTier.has(nome))
      .map((nome) => ({
        nome,
        preco: TIERS.find((t) => t.nome === nome)?.preco ?? '-',
        lista: (porTier.get(nome) ?? []).slice().sort((a, b) => {
          if (a.gender !== b.gender) return a.gender === 'FEMININA' ? -1 : 1;
          return a.label.localeCompare(b.label, 'pt-BR');
        }),
      }));
  }, [vozes]);

  async function ouvir(voz: AssistantVoice) {
    audioRef.current?.pause();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setEstados((e) => ({ ...e, [voz.id]: 'carregando' }));

    try {
      const blob = await synthesizeAssistantSpeech(frase, { voice: voz.id });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setEstados((e) => ({ ...e, [voz.id]: 'parada' }));
      await audio.play();
      setEstados((e) => ({ ...e, [voz.id]: 'tocando' }));
    } catch (e: unknown) {
      setEstados((prev) => ({ ...prev, [voz.id]: 'parada' }));
      setErro(e instanceof Error ? e.message : 'Falha ao gerar a fala.');
    }
  }

  function marcar(id: string) {
    setFavoritas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const escolhidas = vozes.filter((v) => favoritas.has(v.id));

  return (
    <main className="bg-background min-h-svh px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full" title="Voltar">
            <Link to="/assistente" aria-label="Voltar para o assistente">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <BrandLogo className="h-8" />
          <div className="min-w-0">
            <h1 className="font-sora text-on-surface text-xl font-bold">Vozes disponíveis</h1>
            <p className="text-on-surface-variant text-sm">
              {carregandoLista
                ? 'Carregando o catálogo…'
                : `${vozes.length} vozes pelo provedor ${provedor ?? 'nenhum'}`}
            </p>
          </div>
        </header>

        {/* A tela é para comparar, e comparar exige ouvir a MESMA frase. Editável
            porque julgar prosódia com um texto só engana: número e nome próprio
            revelam diferenças que uma saudação esconde. */}
        <label className="mt-6 block">
          <span className="text-on-surface-variant text-xs font-semibold uppercase">
            Frase de teste
          </span>
          <textarea
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            rows={2}
            className="border-outline-variant bg-surface text-on-surface mt-2 w-full rounded-lg border p-3 text-sm"
          />
        </label>

        {erro ? (
          <p className="text-error-on-light mt-4 text-sm" role="alert">
            {erro}
          </p>
        ) : null}

        {carregandoLista ? (
          <div className="mt-12 grid place-items-center">
            <LoadingState label="Carregando vozes" />
          </div>
        ) : vozes.length === 0 ? (
          <p className="text-on-surface-variant mt-12 text-center text-sm">
            Nenhuma voz disponível. O provedor de voz não está configurado no servidor.
          </p>
        ) : (
          <>
            {grupos.map((g) => (
              <Grupo
                key={g.nome}
                titulo={g.nome}
                preco={g.preco}
                lista={g.lista}
                estados={estados}
                favoritas={favoritas}
                onOuvir={(v) => void ouvir(v)}
                onMarcar={marcar}
              />
            ))}
          </>
        )}

        {escolhidas.length > 0 ? (
          <section className="border-outline-variant bg-surface mt-10 rounded-lg border p-4">
            <h2 className="font-sora text-on-surface text-base font-bold">
              Suas favoritas ({escolhidas.length})
            </h2>
            <ul className="mt-3 space-y-1">
              {escolhidas.map((v) => (
                <li key={v.id} className="text-on-surface-variant font-mono text-xs">
                  {v.gender === 'FEMININA' ? 'F' : 'M'} · {v.label} · {v.id}
                </li>
              ))}
            </ul>
            <p className="text-on-surface-variant mt-3 text-xs">
              A marcação vale só nesta aba, para você anotar as preferidas enquanto compara.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
