import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tipos mínimos da Web Speech API.
 *
 * O TypeScript não traz os tipos de `SpeechRecognition` porque a API nunca saiu
 * de rascunho no W3C. Declaramos só o que usamos: melhor que espalhar `any`
 * pelo hook e perder a checagem no resto dele.
 */
interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}

interface SpeechResultEvent extends Event {
  resultIndex: number;
  results: SpeechResultList;
}

interface SpeechErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor | undefined;
  webkitSpeechRecognition?: SpeechRecognitionConstructor | undefined;
}

function getConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Mensagens de erro da API traduzidas para o que o usuário pode fazer. */
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada. Libere o acesso no navegador para falar.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz nesta página.',
  'audio-capture': 'Nenhum microfone encontrado neste dispositivo.',
  network: 'Sem conexão para transcrever o áudio. Você pode digitar a pergunta.',
};

export interface UseSpeechRecognitionOptions {
  /** Chamado a cada trecho final. Em conversa longa vem mais de uma vez. */
  onResult: (transcript: string) => void;
  /**
   * Chamado sempre que o reconhecimento produz alguma coisa, parcial ou final.
   *
   * É o sinal de "ainda está falando" que a tela usa para adiar o fim da fala.
   * Sem ele, a decisão dependeria só do volume do microfone, e voz baixa no fim
   * da frase seria confundida com silêncio.
   */
  onSpeech?: (() => void) | undefined;
}

/**
 * Ditado por voz sobre a Web Speech API.
 *
 * ⚠️ `supported` é falso em boa parte dos navegadores: a API é de rascunho e o
 * Firefox não a implementa. Quem consome **precisa** oferecer o caminho por
 * texto, porque um microfone que não faz nada é pior que microfone nenhum.
 *
 * <h2>Quem decide que a fala acabou é a tela, e não o navegador</h2>
 *
 * ⚠️ `continuous = true` desde 30/08/2026, a pedido do usuário. Com `false`, a
 * Web Speech encerra sozinha na primeira pausa, e o resultado é o defeito que
 * ele descreveu: a pessoa respira no meio da frase, o reconhecimento fecha, e a
 * pergunta chega pela metade. Agora a sessão fica aberta e quem decide o fim é a
 * tela, que também mede o volume do microfone.
 *
 * ⚠️ **O `onend` do navegador não significa que acabou.** O Chrome encerra a
 * sessão por conta própria depois de um tempo de silêncio, mesmo com
 * `continuous`. Por isso ele é religado enquanto a escuta estiver ativa: sem
 * isso a transcrição morre no meio da conversa sem erro nenhum aparecer.
 *
 * O reconhecimento roda no navegador; para o backend chega texto, exatamente
 * como uma pergunta digitada.
 */
export function useSpeechRecognition({ onResult, onSpeech }: UseSpeechRecognitionOptions) {
  const [supported] = useState(() => Boolean(getConstructor()));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /** A escuta ainda é desejada? É o que separa o fim nosso do fim do navegador. */
  const wantedRef = useRef(false);

  /* Refs para os callbacks: trocá-los não pode reiniciar a escuta. */
  const onResultRef = useRef(onResult);
  const onSpeechRef = useRef(onSpeech);
  useEffect(() => {
    onResultRef.current = onResult;
    onSpeechRef.current = onSpeech;
  }, [onResult, onSpeech]);

  useEffect(() => {
    const Constructor = getConstructor();
    if (!Constructor) return;

    const recognition = new Constructor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let partial = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += text;
        else partial += text;
      }

      setInterim(partial);
      if (partial.trim() || finalText.trim()) onSpeechRef.current?.();

      if (finalText.trim()) {
        setInterim('');
        onResultRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      /* `aborted` é o nosso próprio stop(), e `no-speech` acontece o tempo todo
         numa sessão contínua: nenhum dos dois é erro para mostrar. */
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      setError(ERROR_MESSAGES[event.error] ?? 'Não consegui captar o áudio. Tente novamente.');
      wantedRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      setInterim('');
      if (!wantedRef.current) {
        setListening(false);
        return;
      }
      // O navegador encerrou por conta própria e a conversa continua: religa.
      try {
        recognition.start();
      } catch {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      wantedRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    setError(null);
    wantedRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      /* `start()` numa sessão já ativa lança: o estado já é o desejado. */
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    wantedRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, interim, error, start, stop };
}
