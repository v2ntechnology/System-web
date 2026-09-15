import {
  AiIcon,
  ArrowLeftIcon,
  AudioWaveIcon,
  MicIcon,
  MicOffIcon,
  VolumeIcon,
} from '@/components/icons';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';

import { BrandLogo, RookMark } from '@/components/shared/brand-logo';
import { VoiceSphere } from '@/components/shared/voice-sphere';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VoiceTurn } from '@/management/features/assistant/api';
import { converse, loadMessages, openVoiceSession } from '@/management/features/assistant/api';
import { AnswerChart } from '@/management/features/assistant/components/answer-chart';
import type { AssistantAnswer, AssistantTable } from '@/management/types';
import { useSpeechRecognition } from '@/management/features/assistant/use-speech-recognition';
import {
  proximaEspera,
  proximaFalha,
  proximaSaudacao,
  proximoNaoOuvi,
} from '@/management/features/assistant/voice-phrases';
import { fetchAssistantVoices, synthesizeAssistantSpeech } from '@/services';
import type { AssistantVoice, VoiceGender } from '@/services';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AssistantSidebar } from './assistant-sidebar';
import { criarDetectorDeFala, nivelDaFaixaDeFala } from './speech-detection';
import {
  generosDisponiveis,
  gravarGeneroPreferido,
  lerGeneroPreferido,
  escolherVoz,
  proximoPassoDoRodizio,
} from './voice-preference';

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'consulting' | 'speaking' | 'error';

interface VoiceStatusContent {
  title: string;
  description: string;
}

const VOICE_STATUS_CONTENT: Record<VoiceStatus, VoiceStatusContent> = {
  idle: {
    title: 'Pronto para conversar',
    description: 'Ative o microfone e fale naturalmente sobre sua operação.',
  },
  listening: {
    title: 'Estou ouvindo',
    description: 'Fale agora. A esfera reage à intensidade da sua voz.',
  },
  processing: {
    title: 'Processando solicitação',
    description: 'Organizando o contexto e preparando uma resposta objetiva.',
  },
  consulting: {
    title: 'Consultando os dados',
    description: 'Buscando no sistema o que você perguntou.',
  },
  speaking: {
    title: 'Respondendo',
    description: 'A resposta está sendo reproduzida.',
  },
  error: {
    title: 'Microfone indisponível',
    description: 'Revise a permissão do navegador e tente novamente.',
  },
};

const WAVE_BARS = Array.from({ length: 32 }, (_, index) => index);
const ORBIT_BARS = Array.from({ length: 72 }, (_, index) => index);
/**
 * O que dizer quando o microfone não entendeu nada.
 *
 * Não é resposta de demonstração: é o pedido para repetir. Falar um resumo
 * plausível da operação sem ter ouvido pergunta nenhuma seria inventar, e o
 * usuário acreditaria, porque veio na voz do assistente.
 */
const SEM_PERGUNTA =
  'Não consegui entender a pergunta. Tente falar de novo, um pouco mais perto do microfone.';

/**
 * Quanto silêncio significa "terminei de falar".
 *
 * ⚠️ 2,4 segundos, e o número é o ponto da mudança de 30/08/2026 (pedido do
 * usuário). Quem fala uma frase longa respira no meio dela, e um limite curto
 * transforma a respiração em fim de pergunta: o assistente responde a meia
 * frase, com confiança, e quem perguntou tem de recomeçar. Errar para o lado da
 * espera custa dois segundos; errar para o lado da pressa custa a pergunta
 * inteira.
 */
/* O aviso da voz precisa de estado PRÓPRIO, separado do `errorMessage`.
   O `errorMessage` é passageiro de propósito: `startListening` o limpa a cada
   pergunta, porque erro de microfone da pergunta anterior não vale para a
   seguinte. Já a voz caída vale enquanto a conversa durar, e usar o mesmo
   estado fazia o aviso sumir meio segundo depois de a assistente terminar de
   falar, quando o microfone reabria. */
const AVISO_VOZ_CAIDA =
  'O serviço de voz está indisponível; usando temporariamente a voz do dispositivo.';

/*
 * ⚠️ O limiar de fala, o silêncio que encerra e o teto de espera saíram daqui
 * para `speech-detection.ts` em 05/09/2026.
 *
 * Não foi arrumação: o limiar era um número FIXO, e num pátio ou numa oficina o
 * ruído de fundo já passa dele. O relógio do silêncio nunca andava e a pergunta
 * nunca era processada, que é o que o usuário relatou. Lá o limiar acompanha o
 * ambiente, e a lógica ficou testável sem microfone.
 */

/** Depois de falar, o microfone espera o rabo do áudio sair do ambiente. */
const PAUSA_DEPOIS_DE_FALAR_MS = 500;

/**
 * A mesma pausa, no celular.
 *
 * ⚠️ Lá o alto-falante fica a centímetros do microfone e não há como afastar
 * um do outro, então a última palavra dela volta com muito mais força que no
 * computador. O `semEco` corta o que ela acabou de dizer, mas só depois de a
 * frase ter entrado: meio segundo a mais evita que ela entre.
 */
const PAUSA_DEPOIS_DE_FALAR_NO_CELULAR_MS = 1000;

/**
 * O aparelho é de toque, sem mouse?
 *
 * Não é detecção de sistema operacional, que envelhece mal: o que importa aqui
 * é a distância entre o alto-falante e o microfone, e ela acompanha o formato
 * do aparelho, não a marca.
 */
function ehAparelhoDeToque(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

/** Minúsculas, sem acento e sem pontuação, para comparar frase com frase. */
function normalizar(texto: string): string {
  return (
    texto
      .toLowerCase()
      /* `\p{Diacritic}` em vez do intervalo de combinantes escrito à mão: o
       intervalo literal fica ilegível no editor e qualquer normalização de
       arquivo pode estragá-lo sem ninguém notar. */
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Tira do começo da transcrição o que a própria assistente acabou de falar.
 *
 * ⚠️ Sem fone de ouvido, o microfone capta o alto-falante e a fala dela volta
 * como se fosse da pessoa. O sintoma é traiçoeiro: a pergunta chega íntegra, com
 * a fala dela colada na frente, e o modelo responde ao próprio cumprimento antes
 * de responder à pergunta. Foi o que o usuário relatou em 30/08/2026.
 *
 * O corte exige três palavras seguidas, e não uma: "onde" ou "está" aparecem em
 * qualquer frase, e cortar por uma palavra roubaria o começo de perguntas
 * legítimas.
 */
function semEco(texto: string, ultimaFala: string | null): string {
  if (!ultimaFala) return texto;

  const falaDela = normalizar(ultimaFala);
  const palavras = texto.trim().split(/\s+/);
  const normalizadas = normalizar(texto).split(' ');

  for (let n = Math.min(normalizadas.length, 14); n >= 3; n -= 1) {
    if (falaDela.includes(normalizadas.slice(0, n).join(' '))) {
      return palavras.slice(n).join(' ').trim();
    }
  }
  return texto;
}

function pickNaturalVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const normalized = (lang: string) => lang.replace('_', '-').toLowerCase();
  const brazilian = voices.filter((voice) => normalized(voice.lang).startsWith('pt-br'));
  const pool =
    brazilian.length > 0
      ? brazilian
      : voices.filter((voice) => normalized(voice.lang).startsWith('pt'));

  return (
    pool.find((voice) => /natural|neural|online|multilingual/i.test(voice.name)) ??
    pool.find((voice) => /google/i.test(voice.name)) ??
    pool[0] ??
    null
  );
}

export default function VoiceAssistantPage() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  /* Espelha o ref da conversa para a tela: o ref é lido dentro de laços e
     callbacks, mas quem redesenha o botão é o estado. */
  const [conversationOpen, setConversationOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vozCaida, setVozCaida] = useState(false);

  /*
   * A escolha de timbre (decisão do usuário em 05/09/2026).
   *
   * ⚠️ O que fica gravado no navegador é o GÊNERO, e não a voz. Quem escolheu
   * feminina volta a ouvir feminina, mas não necessariamente a mesma voz: era
   * exatamente isso o pedido, não repetir sempre o mesmo timbre. O rodízio mora
   * em `voice-preference.ts`.
   */
  const [genero, setGenero] = useState<VoiceGender>(() => lerGeneroPreferido() ?? 'FEMININA');
  const [trocasFeitas, setTrocasFeitas] = useState(0);
  /* Ref além do estado: quem pede a voz são funções assíncronas, que rodam fora
     do render e não podem esperar o próximo. */
  const vozAtivaRef = useRef<AssistantVoice | null>(null);

  /**
   * A transcrição do que foi conversado, e a sessão que a guarda.
   *
   * ⚠️ Isto reverte a decisão de 30/08/2026 de a conversa falada não ser
   * gravada. O usuário pediu a troca em 05/09: quem fecha a tela e volta uma
   * semana depois quer poder perguntar "sobre o que a gente falou?", e sem
   * gravar não havia resposta possível.
   *
   * O `historyRef` continua existindo e continua sendo o fio curto que vai na
   * requisição. A transcrição é outra coisa: é o que a PESSOA lê na tela, e ela
   * não é podada em dez turnos.
   */
  const [turnosDaVisita, setTurnosDaVisita] = useState<VoiceTurn[]>([]);

  /* A conversa antiga aberta para LEITURA. `null` é a conversa desta visita, que
     é a única em que a esfera escreve. */
  const [conversaAberta, setConversaAberta] = useState<string | null>(null);

  const conversaLida = useQuery({
    queryKey: ['assistant-conversation', conversaAberta],
    queryFn: () => loadMessages(conversaAberta ?? ''),
    enabled: conversaAberta !== null,
  });
  const sessaoIdRef = useRef<string | null>(null);
  const transcricaoRef = useRef<HTMLDivElement>(null);

  /*
   * Abre a conversa da visita assim que a tela monta.
   *
   * O servidor decide entre retomar a última e abrir uma nova, pela janela de
   * tempo desde a última fala. Falhar aqui não pode impedir a conversa: sem
   * sessão, a tela funciona como antes, com o fio vivendo só no navegador.
   */
  const queryClient = useQueryClient();

  /*
   * ⚠️ A conversa nasce quando a pessoa INICIA, e não quando a tela monta
   * (decisão do usuário em 15/09/2026).
   *
   * Era um `useQuery` no mount, e o servidor retomava a conversa das últimas
   * seis horas. Com a regra nova, cada início é uma conversa própria: abrir no
   * mount criaria uma conversa vazia só por alguém ter passado pela tela, e a
   * lista encheria de conversa sem uma palavra dentro.
   *
   * Falhar aqui não pode impedir a conversa: sem sessão, a tela funciona como
   * antes de 05/09/2026, com o fio vivendo só no navegador e nada sendo gravado.
   */
  const abrirSessao = useMutation({
    mutationFn: openVoiceSession,
    onSuccess: (sessao) => {
      sessaoIdRef.current = sessao.conversationId;
      /* A lista da barra lateral é buscada quando ELA monta, e a conversa nasce
         depois. Sem invalidar, ela só apareceria no próximo carregamento da
         página, que é exatamente o "iniciei e não criou nada na lista". */
      void queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] });
    },
    onError: () => {
      /* Sem sessão a conversa continua, só não é gravada: o fio vai no corpo da
         requisição, como antes de existir gravação. */
      sessaoIdRef.current = null;
    },
  });

  /* O que a pessoa falou nesta conversa. Conversa nova nasce vazia, então não há
     mais o que juntar do servidor. */
  const transcricao = turnosDaVisita;

  /*
   * A transcrição desce sozinha a cada turno novo.
   *
   * ⚠️ Depende do TAMANHO da conversa, e não do array: com `[transcricao]` a
   * lista descia a cada render, inclusive no meio de alguém lendo o que foi dito
   * antes. Assim ela só desce quando entra turno novo, que é quando a pessoa
   * acabou de falar ou de ser respondida, e a rolagem manual fica livre no resto
   * do tempo. Comportamento pedido pelo usuário em 05/09/2026.
   */
  useEffect(() => {
    const caixa = transcricaoRef.current;
    if (!caixa) return;

    /*
     * ⚠️ Depois do quadro, e sem animação.
     *
     * Sem o `requestAnimationFrame`, o efeito roda antes de o turno novo ter
     * altura, e a caixa desce para onde ela ainda não termina: medido, ficava em
     * zero ao abrir uma conversa guardada. E `behavior: smooth` cria uma
     * animação longa que continua rodando enquanto a pessoa rola para cima,
     * brigando com a mão dela; instantâneo não tem esse problema.
     */
    const quadro = requestAnimationFrame(() => {
      caixa.scrollTop = caixa.scrollHeight;
    });
    return () => cancelAnimationFrame(quadro);
  }, [transcricao.length]);

  /*
   * O catálogo é do servidor: ele muda com o provedor ativo e com o que foi
   * baixado na imagem do sintetizador. Uma lista fixa aqui ofereceria timbre que
   * não vai sair.
   *
   * ⚠️ O passo do rodízio é avançado AQUI DENTRO, e não no render nem num
   * efeito. Ele escreve no navegador, e o `queryFn` é o único lugar desta tela
   * que roda uma vez por visita e fora do render. `staleTime: 0` é o que faz
   * cada entrada na tela buscar de novo e, com isso, girar a voz.
   */
  const vozesQuery = useQuery({
    queryKey: ['voice', 'voices'],
    queryFn: async () => {
      const catalogo = await fetchAssistantVoices();
      return { ...catalogo, passo: proximoPassoDoRodizio() };
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const catalogo = vozesQuery.data?.voices;
  const generos = generosDisponiveis(catalogo ?? []);

  /* Quem prefere feminina e cai num provedor que só tem masculina ouve a
     masculina: emudecer por causa de uma preferência guardada é pior, e o
     cabeçalho mostra qual voz está no ar. */
  const generoEfetivo = generos.includes(genero) ? genero : (generos[0] ?? genero);

  const vozAtiva = useMemo(
    () => escolherVoz(catalogo ?? [], generoEfetivo, vozesQuery.data?.passo ?? 0),
    [catalogo, generoEfetivo, vozesQuery.data?.passo],
  );

  /*
   * ⚠️ Limpar o cache das frases quando a voz muda é obrigatório. Ele guarda o
   * ÁUDIO já sintetizado, não o texto: sem limpar, "só um segundo" continuaria
   * saindo na voz anterior no meio de uma conversa que já trocou de voz.
   *
   * O ref existe porque quem pede a síntese são funções assíncronas, que leem
   * fora do render. É seguro aqui, e não é sempre: o ref só é lido bem depois do
   * clique que troca a voz, nunca dentro do mesmo `await`.
   */
  useEffect(() => {
    vozAtivaRef.current = vozAtiva;
    phraseAudioRef.current.clear();
  }, [vozAtiva]);

  /**
   * A última resposta.
   *
   * ⚠️ Não é mais mostrada em texto na tela (decisão do usuário em 15/09/2026):
   * o que ela serve hoje é a fala de emergência pelo dispositivo, quando a
   * síntese do servidor falha, pelo `lastAnswerRef` logo abaixo.
   */
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);

  /** O gráfico ou a tabela da última resposta falada. Nulo na maioria delas. */
  const [visualDaVez, setVisualDaVez] = useState<{
    chart?: AssistantAnswer['chart'];
    table?: AssistantTable | undefined;
  } | null>(null);

  /* Ref além do estado: o fallback de voz do dispositivo lê fora do render. */
  const lastAnswerRef = useRef<string | null>(null);
  useEffect(() => {
    lastAnswerRef.current = lastAnswer;
  }, [lastAnswer]);

  /* A transcrição chega por callback e é lida ao encerrar a escuta. Estado aqui
     provocaria render a cada palavra reconhecida, sem nada mudar na tela. */
  const transcriptRef = useRef('');
  /**
   * O detector da escuta em andamento, criado a cada abertura do microfone.
   *
   * Ele guarda o piso de ruído medido naquela sala, e por isso não sobrevive de
   * uma escuta para a outra: entre uma pergunta e a seguinte a pessoa pode ter
   * saído do escritório para o pátio.
   */
  const detectorRef = useRef<ReturnType<typeof criarDetectorDeFala> | null>(null);

  /**
   * Instante em que o RECONHECEDOR entregou texto pela última vez.
   *
   * ⚠️ É o sinal mais confiável que existe aqui, e o que salva a conversa em
   * lugar barulhento: o navegador sabe distinguir voz de ruído, e quando ele
   * fica calado é porque não havia voz, por mais alto que o microfone esteja
   * ouvindo.
   */
  const ultimaTranscricaoRef = useRef(0);
  /** A conversa está aberta? É o que faz a escuta voltar depois da resposta. */
  const conversationActiveRef = useRef(false);
  /** Os turnos desta sessão. Some ao sair da tela, de propósito. */
  const historyRef = useRef<VoiceTurn[]>([]);
  /** Áudio das frases da tela, para não sintetizar a mesma frase duas vezes. */
  const phraseAudioRef = useRef(new Map<string, AudioBuffer>());
  /** Enquanto uma frase de espera toca, a resposta aguarda a vez. */
  const fillerPlayingRef = useRef<Promise<void> | null>(null);
  /**
   * A última coisa que a assistente falou em voz alta.
   *
   * ⚠️ Serve para reconhecer o próprio eco. Sem fone de ouvido, o microfone
   * capta o alto-falante e a fala DELA entra na transcrição como se fosse da
   * pessoa. Foi o que aconteceu em 30/08/2026: a pergunta chegou ao backend como
   * "Oi tudo bem Eu gostaria de que você visse aonde está a placa...", com o
   * "oi tudo bem" que ela mesma tinha acabado de dizer grudado na frente.
   */
  const ultimaFalaRef = useRef<string | null>(null);

  const speech = useSpeechRecognition({
    onResult: (texto: string) => {
      /* ⚠️ ACUMULA, não substitui. Com a sessão contínua o reconhecimento
         entrega a fala em vários trechos finais, e sobrescrever deixaria só o
         último pedaço: "e o RTI9F65?" no lugar da pergunta inteira. */
      transcriptRef.current = `${transcriptRef.current} ${texto}`.trim();
      ultimaTranscricaoRef.current = Date.now();
      detectorRef.current?.marcarFala(Date.now());
    },
    /*
     * ⚠️ `onSpeech` marca fala, mas NÃO marca transcrição, e a diferença é o
     * ponto da correção. O evento do navegador dispara com atividade de áudio,
     * inclusive barulho; só `onResult` significa que houve palavra reconhecida.
     * Misturar os dois foi o que deixava a conversa presa em sala barulhenta.
     */
    onSpeech: () => {
      detectorRef.current?.marcarFala(Date.now());
    },
  });
  const waveformRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  /** Nível de áudio entregue à esfera sem passar por estado do React. */
  const voiceLevelRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speakingFrameRef = useRef<number | null>(null);
  const responseAbortRef = useRef<AbortController | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Mantida apenas como contingência quando o serviço ElevenLabs estiver fora.
  useEffect(() => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;

    const load = () => {
      voicesRef.current = synthesis.getVoices();
    };
    load();
    synthesis.addEventListener('voiceschanged', load);

    return () => synthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    return () => {
      responseAbortRef.current?.abort();

      if (speakingFrameRef.current !== null) {
        cancelAnimationFrame(speakingFrameRef.current);
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      playbackSourceRef.current?.stop();
      playbackSourceRef.current?.disconnect();
      if (inputAudioContextRef.current) {
        void inputAudioContextRef.current.close();
      }
      if (playbackAudioContextRef.current) {
        void playbackAudioContextRef.current.close();
      }

      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  function resetVoiceVisuals() {
    const bars = waveformRef.current?.children;
    if (bars) {
      Array.from(bars).forEach((bar) => {
        (bar as HTMLElement).style.removeProperty('transform');
      });
    }

    orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar').forEach((bar) => {
      bar.style.removeProperty('--voice-scale');
    });
    voiceLevelRef.current = 0;
  }

  /**
   * Garante o contexto que toca a voz da assistente.
   *
   * ⚠️ Precisa ser chamado de dentro do toque da pessoa, e ANTES de qualquer
   * espera. O iPhone só deixa tocar áudio em contexto criado ou retomado
   * durante um gesto: nascido depois do primeiro `await`, ele fica suspenso
   * para sempre e a assistente emudece sem erro nenhum aparecer, que é metade
   * do que o usuário relatou em 06/09/2026. Como efeito colateral, a saudação
   * volta a ser falada na primeira vez: antes ela era pedida com o contexto
   * ainda inexistente e saía calada.
   */
  function garantirContextoDeReproducao() {
    /* Navegador sem Web Audio sai por aqui e cai no mesmo caminho de sempre: é
       `playBuffer` quem reclama de contexto ausente, e é `startListening` quem
       avisa a pessoa. Aqui não há tela para mostrar nada. */
    if (typeof AudioContext === 'undefined') return;

    if (!playbackAudioContextRef.current) {
      playbackAudioContextRef.current = new AudioContext();
    }
    void playbackAudioContextRef.current.resume();
  }

  function stopAudioCapture() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (inputAudioContextRef.current) {
      void inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    resetVoiceVisuals();
  }

  function stopSpeakingAnimation() {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
      speakingFrameRef.current = null;
    }
    resetVoiceVisuals();
  }

  function clearPlaybackSource(stop = false) {
    const source = playbackSourceRef.current;
    if (!source) return;

    source.onended = null;
    if (stop) {
      try {
        source.stop();
      } catch {
        // A fonte pode já ter encerrado naturalmente.
      }
    }
    source.disconnect();
    playbackSourceRef.current = null;
  }

  function finishSpeaking() {
    /* ⚠️ Guarda de reentrância. Esta função está ligada ao `onend` E ao
       `onerror` da mesma fala: se os dois disparassem, `resumeConversation`
       seria chamado duas vezes e o microfone reabriria em duplicado. O ref
       serve de marca porque a linha seguinte já o zerava. */
    if (!utteranceRef.current) return;

    utteranceRef.current = null;
    clearPlaybackSource();
    stopSpeakingAnimation();
    /* NÃO limpar `errorMessage` aqui. Esta função é o fim da fala do
       DISPOSITIVO, e a única coisa que chega nela com mensagem posta é o
       aviso de que a voz da assistente falhou. Limpar aqui fazia o aviso
       piscar enquanto ela falava e sumir ao terminar: quem ouvia percebia
       a voz trocada e não tinha como saber por quê. O aviso agora sobrevive
       até a próxima resposta bem-sucedida (que limpa em `speakResponse`) ou
       até a próxima pergunta (`startListening`). */
    setStatus('idle');

    /* ⚠️ Reabrir o microfone TAMBÉM aqui, e não só no caminho feliz.

       Esta função é o fim da fala do dispositivo, que só acontece quando a
       síntese da assistente falhou. Sem esta linha, a conversa morria depois
       de UMA resposta: os outros três caminhos de `speakResponse` chamam
       `resumeConversation`, este não chamava, e quem estava conversando
       precisava encerrar e abrir de novo para fazer a segunda pergunta.

       O sintoma só aparece quando a síntese falha, então passou despercebido
       enquanto a ElevenLabs tinha crédito. `resumeConversation` já confere se
       a conversa continua aberta, então chamar aqui é seguro. */
    resumeConversation();
  }

  function applySpectrum(frequencyData: Uint8Array<ArrayBuffer>) {
    const waveformBars = waveformRef.current?.children;
    let total = 0;

    if (waveformBars) {
      Array.from(waveformBars).forEach((bar, index) => {
        const frequencyIndex = Math.min(
          frequencyData.length - 1,
          2 + Math.floor((index / waveformBars.length) * Math.min(42, frequencyData.length - 2)),
        );
        const level = (frequencyData[frequencyIndex] ?? 0) / 255;
        total += level;
        (bar as HTMLElement).style.transform = `scaleY(${0.22 + level * 1.45})`;
      });
      voiceLevelRef.current = Math.min((total / waveformBars.length) * 3.1, 1);
    }

    const orbitBars = orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar');
    if (!orbitBars) return;

    const half = orbitBars.length / 2;
    orbitBars.forEach((bar, index) => {
      const mirroredIndex = index < half ? index : orbitBars.length - index - 1;
      const frequencyIndex = Math.min(
        frequencyData.length - 1,
        2 + Math.floor((mirroredIndex / half) * Math.min(38, frequencyData.length - 2)),
      );
      const level = (frequencyData[frequencyIndex] ?? 0) / 255;
      bar.style.setProperty('--voice-scale', (0.32 + level * 1.85).toFixed(3));
    });
  }

  function startAudioAnalysis(analyser: AnalyserNode) {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
    }

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const sample = () => {
      analyser.getByteFrequencyData(frequencyData);
      applySpectrum(frequencyData);
      speakingFrameRef.current = requestAnimationFrame(sample);
    };
    sample();
  }

  function startSyntheticSpeakingAnimation() {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
    }

    let phase = 0;
    const animate = () => {
      phase += 0.12;
      voiceLevelRef.current = 0.3 + Math.abs(Math.sin(phase)) * 0.35;

      const waveformBars = waveformRef.current?.children;
      if (waveformBars) {
        Array.from(waveformBars).forEach((bar, index) => {
          const level = 0.3 + Math.abs(Math.sin(phase + index * 0.37)) * 0.85;
          (bar as HTMLElement).style.transform = `scaleY(${level})`;
        });
      }

      orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar').forEach((bar, index) => {
        const level = 0.38 + Math.abs(Math.sin(phase + index * 0.2)) * 1.25;
        bar.style.setProperty('--voice-scale', level.toFixed(3));
      });

      speakingFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
  }

  function speakWithSystemFallback() {
    setVozCaida(true);

    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      stopSpeakingAnimation();
      setStatus('error');
      return;
    }

    setStatus('speaking');
    startSyntheticSpeakingAnimation();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(lastAnswerRef.current || SEM_PERGUNTA);
    const voice = pickNaturalVoice(voicesRef.current);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? 'pt-BR';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Transcreve, pergunta e fala.
   *
   * A pergunta vai para a MESMA rota do assistente de texto, e não para um
   * caminho paralelo: voz é outra forma de entrada, não outro produto. O
   * escopo por papel, a auditoria e a recusa de inventar valem igual.
   */
  /**
   * Toca um áudio já sintetizado e resolve quando ele acaba.
   *
   * Serve tanto para a resposta quanto para as frases da tela. A promessa é o
   * que permite falar uma coisa depois da outra sem cortar no meio.
   */
  async function playBuffer(audioBuffer: AudioBuffer, animar: boolean): Promise<void> {
    const context = playbackAudioContextRef.current;
    if (!context) throw new Error('audio_context_unavailable');

    await context.resume();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.76;

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(context.destination);
    playbackSourceRef.current = source;

    if (animar) startAudioAnalysis(analyser);

    return new Promise<void>((resolve) => {
      source.onended = () => {
        source.onended = null;
        if (playbackSourceRef.current === source) playbackSourceRef.current = null;
        resolve();
      };
      source.start();
    });
  }

  /**
   * O áudio de uma frase da tela, sintetizado uma vez só.
   *
   * ⚠️ São sempre as mesmas dez frases. Sem o cache, cada "só um segundo"
   * gastaria créditos da ElevenLabs de novo e ainda somaria a latência da
   * síntese ao silêncio que a frase existe para preencher.
   */
  /**
   * A troca de timbre, venha do botão ou do comando falado.
   *
   * ⚠️ Os dois caminhos passam por aqui de propósito, e é o que faz a animação
   * do seletor valer para os dois sem existir um segundo caminho para manter em
   * pé: a pílula desliza porque segue o gênero no ar, e o contador faz o anel
   * piscar de novo a cada troca.
   */
  function trocarGenero(novo: VoiceGender) {
    setGenero(novo);
    gravarGeneroPreferido(novo);
    setTrocasFeitas((feitas) => feitas + 1);
  }

  async function phraseAudio(frase: string): Promise<AudioBuffer | null> {
    const guardado = phraseAudioRef.current.get(frase);
    if (guardado) return guardado;

    const context = playbackAudioContextRef.current;
    if (!context) return null;

    try {
      const audio = await synthesizeAssistantSpeech(frase, { voice: vozAtivaRef.current?.id });
      const buffer = await context.decodeAudioData(await audio.arrayBuffer());
      phraseAudioRef.current.set(frase, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  /** Fala uma frase da tela, sem tratá-la como resposta do assistente. */
  async function sayPhrase(frase: string, estado: VoiceStatus = 'speaking'): Promise<void> {
    const buffer = await phraseAudio(frase);
    if (!buffer) return;

    /*
     * ⚠️ As falas da tela também põem a esfera em "falando".
     *
     * Sem isto a assistente dizia "só um segundo, estou consultando" com a tela
     * parada no desenho de repouso, e a voz parecia vir de outro lugar. Quem
     * está conversando lê a esfera antes de ler o texto: se ela não reage, a
     * conversa parece ter travado justamente enquanto a assistente fala.
     */
    setStatus(estado);
    startSyntheticSpeakingAnimation();
    ultimaFalaRef.current = frase;
    try {
      await playBuffer(buffer, false);
    } finally {
      /* ⚠️ No modo de consulta a animação NÃO para quando a frase acaba: a
         busca continua depois dela, e uma esfera congelada no meio da espera é
         o que faz parecer que a conversa travou. Quem para é o fluxo da
         resposta, ao voltar a falar. */
      if (estado !== 'consulting') stopSpeakingAnimation();
    }
  }

  /**
   * Pergunta, avisa que está procurando, responde e volta a ouvir.
   *
   * ⚠️ A frase de espera é da TELA, e não do modelo: ela precisa ser dita
   * ENQUANTO a consulta corre. Vinda do modelo, só sairia junto com a resposta,
   * que é justamente quando ela não serve mais para nada.
   */
  async function speakResponse(question: string) {
    responseAbortRef.current?.abort();
    const controller = new AbortController();
    responseAbortRef.current = controller;

    const pergunta = question.trim();
    /* ⚠️ Variável local, e não `lastAnswerRef`. O ref é preenchido por efeito,
       que só roda depois do render: lido aqui dentro, ele ainda traz a resposta
       ANTERIOR, e o catch escolheria o caminho errado. */
    let respostaTexto: string | null = null;

    try {
      if (!pergunta) {
        await sayPhrase(proximoNaoOuvi());
        if (!controller.signal.aborted) resumeConversation();
        return;
      }

      /*
       * A conversa falada não é gravada (decisão do usuário em 30/08/2026): o
       * fio vive neste `historyRef` e some ao sair da tela. Cada pergunta falada
       * abrindo uma conversa gastaria as dez da pessoa em dez perguntas.
       */
      /*
       * ⚠️ O aviso de "só um segundo" sai quando o assistente REALMENTE vai
       * consultar, e não quando a resposta demora (correção pedida pelo usuário
       * em 30/08/2026).
       *
       * Antes era um relógio de 900 ms, e um "oi" que levasse pouco mais que
       * isso ganhava um "estou consultando os dados" antes de um "oi, tudo
       * bem?". Soava mentiroso, porque consulta nenhuma havia acontecido. Agora
       * quem avisa é o backend, no instante em que o modelo pede a primeira
       * função.
       */
      const {
        text: resposta,
        chart,
        table,
      } = await converse(
        pergunta,
        historyRef.current,
        sessaoIdRef.current,
        () => {
          if (controller.signal.aborted) return;
          /* ⚠️ O modo de consulta continua DEPOIS da frase acabar, e não só
           enquanto ela toca (decisão do usuário em 30/08/2026). A busca é o que
           demora; se a esfera voltasse ao normal ao fim da frase, ela ficaria
           parada justamente durante a espera que a frase anunciou. */
          setStatus('consulting');
          fillerPlayingRef.current = sayPhrase(proximaEspera(), 'consulting');
        },
        (novoGenero) => {
          /*
           * A troca de timbre pedida por voz.
           *
           * É a MESMA função do botão do cabeçalho: grava a preferência, limpa o
           * cache das frases e sorteia a voz nova. O evento chega antes da
           * resposta, então a confirmação já é falada na voz pedida.
           */
          trocarGenero(novoGenero);
        },
        /*
         * O timbre no ar, que é o nome pelo qual ela se apresenta: Lia na voz
         * feminina, Dexter na masculina. Sai do REF da voz ativa, e não do
         * gênero preferido, por dois motivos: é a voz que a pessoa ouve que
         * precisa casar com o nome, e ler estado aqui dentro faria o React
         * Compiler desistir de memoizar a tela inteira, como já acontece com
         * `vozAtivaRef` na síntese logo abaixo.
         */
        vozAtivaRef.current?.gender,
      );
      if (controller.signal.aborted) return;

      // Deixa a frase de espera terminar: cortá-la no meio de uma palavra soa
      // pior que o meio segundo a mais de espera.
      if (fillerPlayingRef.current) {
        await fillerPlayingRef.current;
        fillerPlayingRef.current = null;
      }
      if (controller.signal.aborted) return;

      respostaTexto = resposta;
      ultimaFalaRef.current = resposta;
      setLastAnswer(resposta);
      /* Dez turnos, e o corte é aqui e não no servidor: a conversa falada não
         para, e mandar meia hora de histórico a cada pergunta encareceria cada
         resposta sem melhorar nenhuma. */
      /* ⚠️ Só o VISUAL fica na tela, nunca o texto: a conversa é para ser ouvida
         (ver a decisão de 15/09/2026 mais acima), mas um número comparado só
         funciona visto. O gráfico da resposta anterior sai quando chega outra
         pergunta, senão a tela mostraria o retrato errado enquanto a próxima é
         respondida. */
      setVisualDaVez(chart || table ? { chart, table } : null);

      const novos: VoiceTurn[] = [
        { role: 'user', text: pergunta },
        { role: 'assistant', text: resposta },
      ];
      historyRef.current = [...historyRef.current, ...novos].slice(-10);
      setTurnosDaVisita((atual) => [...atual, ...novos]);

      const audio = await synthesizeAssistantSpeech(resposta, {
        voice: vozAtivaRef.current?.id,
        signal: controller.signal,
      });
      const context = playbackAudioContextRef.current;
      if (!context) throw new Error('audio_context_unavailable');

      const audioBuffer = await context.decodeAudioData(await audio.arrayBuffer());
      if (controller.signal.aborted) return;

      setStatus('speaking');
      // A voz voltou: o aviso sai.
      setVozCaida(false);
      setErrorMessage(null);
      await playBuffer(audioBuffer, true);

      stopSpeakingAnimation();
      setStatus('idle');
      resumeConversation();
    } catch {
      if (!controller.signal.aborted) {
        // Falha da síntese cai na voz do dispositivo; falha da consulta é outra
        // coisa, e quem está ouvindo precisa saber que a pergunta não foi
        // respondida em vez de ficar no silêncio.
        if (respostaTexto) {
          speakWithSystemFallback();
        } else {
          await sayPhrase(proximaFalha());
          stopSpeakingAnimation();
          setStatus('idle');
          resumeConversation();
        }
      }
    } finally {
      if (responseAbortRef.current === controller) {
        responseAbortRef.current = null;
      }
    }
  }

  /** Volta a ouvir, se a conversa ainda estiver aberta. */
  function resumeConversation() {
    if (!conversationActiveRef.current) return;
    /* A pausa deixa o fim do áudio sair do ambiente antes de o microfone
       reabrir. Sem ela, a última palavra dela costuma entrar na transcrição
       seguinte. */
    window.setTimeout(
      () => {
        if (!conversationActiveRef.current) return;
        void startListening({ saudar: false });
      },
      ehAparelhoDeToque() ? PAUSA_DEPOIS_DE_FALAR_NO_CELULAR_MS : PAUSA_DEPOIS_DE_FALAR_MS,
    );
  }

  async function finishListening() {
    stopAudioCapture();
    setStatus('processing');
    /* O texto vem do reconhecimento, que corre em paralelo à captura de áudio:
       a captura alimenta a animação da esfera, a transcrição alimenta a
       pergunta. São duas leituras do mesmo microfone, e nenhuma substitui a
       outra. */
    const pergunta = semEco(transcriptRef.current, ultimaFalaRef.current);
    transcriptRef.current = '';
    /*
     * ⚠️ A resposta só começa depois de o microfone voltar para o sistema.
     *
     * `stopAudioCapture` solta o nosso stream, mas o reconhecedor segura o
     * microfone por conta própria até encerrar de verdade, e no celular isso
     * demora. Falar por cima disso é o defeito relatado em 06/09/2026: no
     * iPhone o áudio sai pelo alto-falante da orelha e parece que ela emudeceu,
     * e nos dois aparelhos a voz dela volta para a captação e vira a próxima
     * pergunta, com o microfone reabrindo sozinho.
     */
    await speech.stop();
    void speakResponse(pergunta);
  }

  async function startListening({ saudar }: { saudar: boolean } = { saudar: true }) {
    setErrorMessage(null);
    setLastAnswer(null);
    setVisualDaVez(null);
    transcriptRef.current = '';
    window.speechSynthesis?.cancel();

    if (saudar) {
      conversationActiveRef.current = true;
      setConversationOpen(true);

      /*
       * A conversa nova nasce AQUI, antes da saudação, e o `await` é de
       * propósito: a primeira pergunta pode chegar em poucos segundos, e sem o
       * identificador em mãos ela seria respondida fora de qualquer conversa e
       * não ficaria gravada em lugar nenhum.
       *
       * ⚠️ `mutateAsync` rejeita quando a rota falha, e o `catch` é o que mantém
       * a promessa de que falhar aqui não impede de conversar: o `onError` já
       * limpou o identificador, e a conversa segue sem gravação.
       */
      historyRef.current = [];
      try {
        await abrirSessao.mutateAsync();
      } catch {
        /* Tratado no `onError`. */
      }
      if (!conversationActiveRef.current) return;
      // A saudação sai antes de abrir o microfone: falada por cima da escuta,
      // ela entraria na própria transcrição pelo alto-falante.
      await sayPhrase(proximaSaudacao());
      if (!conversationActiveRef.current) return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Este navegador não oferece captura de áudio para esta experiência.');
      setStatus('error');
      closeConversation();
      return;
    }

    try {
      garantirContextoDeReproducao();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      inputAudioContextRef.current = audioContext;

      /*
       * Duas leituras do mesmo microfone, e nenhuma substitui a outra: a captura
       * de áudio alimenta a animação da esfera, e o reconhecimento alimenta a
       * pergunta. Sem o reconhecimento a esfera reagiria lindamente a uma
       * pergunta que ninguém leu.
       */
      if (speech.supported) {
        speech.start();
      } else {
        setErrorMessage(
          'Este navegador não transcreve fala. A esfera responde à sua voz, mas a pergunta não chega ao assistente.',
        );
      }

      setStatus('listening');

      const abertaEm = Date.now();
      ultimaTranscricaoRef.current = abertaEm;
      /* Um detector por escuta: o piso de ruído é daquela sala, e entre uma
         pergunta e a seguinte a pessoa pode ter saído para o pátio. */
      detectorRef.current = criarDetectorDeFala(abertaEm);

      function sampleVoice() {
        analyser.getByteFrequencyData(frequencyData);
        const bars = waveformRef.current?.children;
        let total = 0;

        if (bars) {
          Array.from(bars).forEach((bar, index) => {
            const frequencyIndex = Math.floor((index / bars.length) * frequencyData.length);
            const level = (frequencyData[frequencyIndex] ?? 0) / 255;
            total += level;
            (bar as HTMLElement).style.transform = `scaleY(${0.2 + level * 1.55})`;
          });
          voiceLevelRef.current = Math.min((total / bars.length) * 2.4, 1);
        }

        /*
         * Quem decide que a fala acabou é este trecho, e não o navegador.
         *
         * ⚠️ As duas fontes continuam valendo, e pelo mesmo motivo de sempre: só
         * o volume confundiria ar condicionado com voz, e só a transcrição
         * perderia a pausa curta entre duas frases, porque ela chega em blocos.
         * O que mudou em 05/09/2026 é COMO o volume é lido: a medida agora é a
         * faixa da fala e não o espectro inteiro, e o limiar acompanha o ruído
         * da sala em vez de ser um número fixo. A decisão mora em
         * `speech-detection.ts`, testada sem microfone.
         */
        const agora = Date.now();
        const leitura = detectorRef.current?.amostrar({
          nivel: nivelDaFaixaDeFala(frequencyData, audioContext.sampleRate),
          agora,
          temPergunta: transcriptRef.current.trim().length > 0,
          ultimaTranscricaoEm: ultimaTranscricaoRef.current,
        });

        if (leitura?.decisao === 'encerrar') {
          void finishListening();
          return;
        }

        /*
         * ⚠️ O teto conta desde a abertura do microfone e vale mesmo quando
         * HOUVE som, e não só quando não houve.
         *
         * Medido no navegador em 30/08/2026: com ruído de sala e nenhuma palavra
         * reconhecida, a tela ficava em "Estou ouvindo" indefinidamente. Qualquer
         * estalo passava do limiar de volume e ligava o "já falou", enquanto a
         * outra condição exigia transcrição para encerrar. Nenhuma das duas
         * fechava, e o microfone ficava aberto para sempre.
         */
        if (leitura?.decisao === 'desistir') {
          void finishListening();
          return;
        }

        animationFrameRef.current = requestAnimationFrame(sampleVoice);
      }

      sampleVoice();
    } catch {
      stopAudioCapture();
      setErrorMessage('Não foi possível acessar o microfone. Autorize o uso nas configurações.');
      setStatus('error');
      closeConversation();
    }
  }

  /**
   * Marca a conversa como fechada.
   *
   * ⚠️ Sem isto, microfone negado deixava o botão em "Encerrar conversa" para
   * uma conversa que nunca começou, e a pessoa não tinha como tentar de novo
   * sem apertar duas vezes. Pego pela suíte em 30/08/2026.
   */
  function closeConversation() {
    conversationActiveRef.current = false;
    setConversationOpen(false);
  }

  function stopSpeaking() {
    responseAbortRef.current?.abort();
    responseAbortRef.current = null;

    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis?.cancel();
    clearPlaybackSource(true);
    stopSpeakingAnimation();
    setErrorMessage(null);
    setVozCaida(false);
    setStatus('idle');
  }

  /**
   * Encerra a conversa inteira: para de ouvir, para de falar e esquece o fio.
   *
   * ⚠️ `conversationActiveRef` cai ANTES de qualquer parada. É ele que o
   * `resumeConversation` consulta, e uma resposta que ainda estava a caminho
   * reabriria o microfone depois de a pessoa ter encerrado.
   */
  function endConversation() {
    closeConversation();
    historyRef.current = [];
    /* ⚠️ A conversa encerrada não recebe mais nada (decisão do usuário em
       15/09/2026). Sem soltar o identificador, o próximo "iniciar conversa"
       gravaria os turnos novos dentro da conversa que a pessoa acabou de
       fechar. */
    sessaoIdRef.current = null;
    stopAudioCapture();
    /* Aqui ninguém espera o fim: a conversa acabou, e não há resposta para
       tocar depois dele. */
    void speech.stop();
    stopSpeaking();
  }

  function handlePrimaryAction() {
    /*
     * Um botão só, e ele é o interruptor da conversa (decisão do usuário em
     * 30/08/2026). O "concluir comando" saiu porque quem decide que a fala
     * acabou passou a ser o silêncio de 2,4 segundos: um botão para encerrar o
     * que já se encerra sozinho só faz a pessoa duvidar se precisa apertar.
     */
    if (conversationActiveRef.current) {
      endConversation();
      return;
    }
    /* ⚠️ Aqui, e de forma síncrona: é o único instante da conversa em que existe
       um toque da pessoa para o iPhone aceitar. Ver `garantirContextoDeReproducao`. */
    garantirContextoDeReproducao();
    void startListening();
  }

  /*
   * ⚠️ Com a conversa aberta, o repouso NÃO é "pronto para conversar".
   *
   * Entre a resposta e a reabertura do microfone a tela passava por `idle` e
   * voltava a dizer "ative o microfone e fale", como se nada estivesse
   * acontecendo, no meio de uma conversa que estava acontecendo. Quem está
   * falando com a assistente lê isso como "ela desligou".
   */
  const content =
    conversationOpen && status === 'idle'
      ? { title: 'Conversa aberta', description: 'Pode falar quando quiser, estou aqui.' }
      : VOICE_STATUS_CONTENT[status];
  /* O rótulo segue a conversa, e não o estado do momento: entre uma pergunta e
     a resposta a conversa continua aberta, e um botão que muda de nome três
     vezes por pergunta faz a pessoa perder de vista o que ele faz. */
  const actionLabel = conversationOpen
    ? 'Encerrar conversa'
    : status === 'error'
      ? 'Tentar novamente'
      : 'Iniciar conversa';

  /*
   * "Nova conversa" esquece o FIO desta visita, e não o histórico gravado: a
   * próxima pergunta chega ao modelo sem o assunto anterior colado nela. As
   * conversas continuam na lista da barra lateral, porque ninguém espera que
   * começar de novo apague o que já perguntou.
   */
  function novaConversa() {
    endConversation();
    setTurnosDaVisita([]);
  }

  /* O turno relido carrega o GRÁFICO gravado com ele, e a hora em que o número
     foi apurado. Sem a hora, um gráfico de semana passada pareceria de agora. */
  const turnosLidos: TurnoNaTela[] =
    conversaLida.data?.map((mensagem) => ({
      role: mensagem.role === 'user' ? 'user' : 'assistant',
      text: mensagem.content,
      ...(mensagem.visual?.chart ? { chart: mensagem.visual.chart } : {}),
      ...(mensagem.visual?.table ? { table: mensagem.visual.table } : {}),
      apuradoEm: mensagem.createdAt,
    })) ?? [];

  /* Na conversa antiga a tela LÊ; na conversa da visita ela escreve. O painel é
     o mesmo, e o cabeçalho diz qual das duas está aberta. */
  const turnosNaTela: TurnoNaTela[] = conversaAberta === null ? transcricao : turnosLidos;

  /*
   * ⚠️ A referência de 820px sai de MEDIÇÃO, e não de gosto (pedido do usuário
   * em 11/09/2026, que achou a barra lateral pequena demais no notebook).
   *
   * Como a `.tela-proporcional` entrega ao layout exatamente `altura-de-referência`
   * pixels de altura e depois encolhe tudo para caber na janela, **a referência
   * é o tamanho aparente**: quanto menor, maior a tela fica. Sem declará-la, esta
   * página caía no padrão de 1080px, e num notebook de 768px a escala ia a 0,71,
   * deixando a barra de 256px valendo 182px na tela. Com 820px a escala sobe para
   * 0,94 e a barra volta a 240px.
   *
   * O piso medido é ~795px: abaixo disso a seção da esfera começa a ser cortada,
   * porque a classe usa `overflow: hidden`. Os 25px de folga são de propósito.
   *
   * ⚠️ Mexeu no conteúdo? Meça de novo antes de baixar este número.
   */
  return (
    <main className="tela-proporcional [--altura-de-referencia:820px] relative flex bg-background">
      <AssistantSidebar
        selectedId={conversaAberta}
        onSelect={setConversaAberta}
        onNewConversation={novaConversa}
      />

      {/* ⚠️ `min-w-0 flex-1`: num flex, o `w-full` do miolo media a casca INTEIRA
          e ele transbordava a largura da barra lateral para fora da tela. */}
      <div className="relative z-10 mx-auto flex h-full w-full min-w-0 max-w-[1500px] flex-1 flex-col px-4 py-4 sm:px-7 sm:py-6 lg:px-10">
        {/*
         * ⚠️ A volta e a marca só existem abaixo de 1024px, que é onde a barra
         * lateral não aparece. No monitor as duas estavam repetidas: a barra já
         * traz a marca no topo e o atalho para a escolha de acesso, e a faixa
         * ficava ocupando altura para dizer o que já estava dito ao lado.
         *
         * O cabeçalho inteiro some no monitor quando não há escolha de voz, para
         * não sobrar uma linha divisória sem nada em cima dela.
         */}
        <header
          className={cn(
            'flex items-center gap-4 border-b border-border/60 pb-4',
            generos.length === 0 && 'lg:hidden',
          )}
        >
          <div className="flex items-center gap-4 lg:hidden">
            <Button asChild variant="ghost" size="icon" className="rounded-full" title="Voltar">
              <Link to="/painel" aria-label="Voltar para a escolha de acesso">
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
            </Button>
            <Link to="/painel" aria-label="RookHub, início">
              <BrandLogo className="hidden h-8 sm:block" />
              <RookMark className="h-8 w-8 sm:hidden" />
            </Link>
          </div>

          {/*
           * A escolha de timbre fica no cabeçalho, longe da esfera: é ajuste de
           * preferência, não parte da conversa. Só aparecem os gêneros que o
           * provedor ativo tem, porque oferecer um que não existe seria prometer
           * uma voz que nunca sai.
           */}
          {generos.length > 0 ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">Voz</span>
              <div
                role="group"
                aria-label="Voz da assistente"
                className="relative rounded-full border border-outline bg-surface p-1 shadow-sm"
              >
                {/*
                 * O anel que marca a troca recém-feita.
                 *
                 * ⚠️ A `key` é o contador de trocas, e é ela que faz a animação
                 * rodar de novo: sem trocar a chave, o React reaproveita o
                 * elemento e o keyframe não recomeça. Foi assim, e não com um
                 * relógio guardado em ref, porque o ref lido no cleanup faz o
                 * compilador do React desistir de otimizar a tela inteira.
                 */}
                {trocasFeitas > 0 ? (
                  <span
                    key={trocasFeitas}
                    aria-hidden
                    className="animate-voice-switch-flash pointer-events-none absolute -inset-px rounded-full ring-2 ring-primary"
                  />
                ) : null}
                {/* Colunas iguais: "Feminina" e "Masculina" têm larguras
                    diferentes, e sem igualar a pílula mudaria de tamanho no meio
                    do caminho. */}
                <div
                  className="relative grid"
                  style={{ gridTemplateColumns: `repeat(${generos.length}, minmax(0, 1fr))` }}
                >
                  {/* A pílula que desliza. Ela segue o gênero no ar, então anda
                      igual pelo clique e pelo comando falado. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
                    style={{
                      width: `${100 / generos.length}%`,
                      transform: `translateX(${Math.max(0, generos.indexOf(vozAtiva?.gender ?? genero)) * 100}%)`,
                    }}
                  />
                  {generos.map((opcao) => {
                    const ativo = (vozAtiva?.gender ?? genero) === opcao;
                    return (
                      <button
                        key={opcao}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => trocarGenero(opcao)}
                        /* `relative` para o texto ficar acima da pílula, que é
                           irmã posicionada de forma absoluta. */
                        className={cn(
                          'relative rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                          ativo ? 'text-on-primary' : 'text-on-surface-muted hover:text-on-surface',
                        )}
                      >
                        {opcao === 'FEMININA' ? 'Feminina' : 'Masculina'}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* O nome da voz da vez: sem ele, o rodízio parece defeito. */}
              {vozAtiva ? (
                <span className="hidden text-xs text-muted-foreground lg:inline">
                  {vozAtiva.label}
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        {/* ⚠️ `min-h-0` é o que faz a transcrição rolar sozinha em vez de esticar
            a página. Um filho de flex tem altura mínima igual ao conteúdo por
            padrão: sem isto, o painel crescia com a conversa, empurrava a página
            para baixo e o começo do que foi dito sumia da tela. */}
        <section className="flex min-h-0 flex-1 items-start justify-center gap-8 py-8 lg:py-10">
          {/*
           * ⚠️ O painel SÓ aparece na conversa GRAVADA, aberta pela lista da
           * barra lateral (decisão do usuário em 15/09/2026).
           *
           * Durante o bate-papo a tela não mostra o que está sendo dito: quem
           * está falando não lê, e a transcrição crescendo ao lado disputava a
           * atenção com a esfera, que é o único retorno de que a assistente está
           * ouvindo. O registro não se perde, porque a conversa falada é gravada
           * desde 05/09/2026: ela está em `Conversas`, na barra lateral, e é de
           * lá que se volta a ela depois.
           *
           * Fica à ESQUERDA, e não embaixo, para a esfera não ser empurrada para
           * fora da tela numa conversa longa. Some abaixo de 1024px, onde o
           * painel comeria o espaço dela.
           */}
          {conversaAberta !== null ? (
            <aside className="hidden min-h-0 w-80 shrink-0 flex-col self-stretch lg:flex xl:w-96">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {conversaAberta === null ? 'Conversa' : 'Conversa gravada'}
                </h2>
                {/* ⚠️ A volta é explícita: sem ela, quem abriu uma conversa
                    antiga falaria achando que estava continuando aquela, e a
                    fala entraria na conversa da visita sem aviso. */}
                {conversaAberta !== null ? (
                  <button
                    type="button"
                    onClick={() => setConversaAberta(null)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Voltar à conversa atual
                  </button>
                ) : null}
              </div>
              {/* `max-h` além do `flex-1`: se algum ancestral perder a altura, o
                  painel continua limitado e rolando, em vez de esticar a
                  página. A barra some, como em todo o sistema, e a rolagem
                  continua funcionando. */}
              <div
                ref={transcricaoRef}
                className="mt-3 max-h-[70vh] min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-left"
              >
                {conversaAberta !== null && conversaLida.isPending ? (
                  <p className="text-xs text-muted-foreground">Carregando a conversa…</p>
                ) : null}

                {conversaAberta !== null && conversaLida.isError ? (
                  <p className="text-xs text-muted-foreground">
                    Não foi possível abrir esta conversa.
                  </p>
                ) : null}

                {turnosNaTela.map((turno, indice) => (
                  <div
                    key={`${turno.role}-${indice}`}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm leading-relaxed',
                      turno.role === 'user'
                        ? 'border-border/60 bg-card/60'
                        : 'border-transparent bg-muted/50',
                    )}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {turno.role === 'user' ? 'Você' : 'Assistente'}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{turno.text}</p>

                    {/* ⚠️ O gráfico gravado volta COM a hora da apuração. Ele é o
                        retrato do instante da pergunta, e mostrá-lo sem data
                        faria um número de semana passada passar por número de
                        agora, que é o motivo pelo qual antes ele não era
                        guardado. */}
                    {turno.chart || turno.table ? (
                      <div className="mt-2 border-t border-border/50 pt-2">
                        {turno.chart ? <AnswerChart chart={turno.chart} /> : null}
                        {turno.table ? <TabelaDaResposta tabela={turno.table} /> : null}
                        {turno.apuradoEm ? (
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            Apurado em {horaDaApuracao.format(new Date(turno.apuradoEm))}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </aside>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="voice-core" aria-hidden>
              <VoiceSphere levelRef={voiceLevelRef} status={status} className="voice-core-sphere" />
              <div ref={orbitRef} className={cn('voice-orbit', `voice-orbit--${status}`)}>
                {ORBIT_BARS.map((bar) => (
                  <span
                    key={bar}
                    className="voice-orbit-bar"
                    style={
                      {
                        '--orbit-angle': `${bar * (360 / ORBIT_BARS.length)}deg`,
                        '--orbit-delay': `${bar * -11}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
                <span className="voice-orbit-arc voice-orbit-arc--outer" />
                <span className="voice-orbit-arc voice-orbit-arc--inner" />
              </div>
            </div>

            <div className="mt-3 min-h-[92px]" aria-live="polite" aria-atomic="true">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                {content.title}
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {errorMessage ?? (vozCaida ? AVISO_VOZ_CAIDA : content.description)}
              </p>
            </div>

            {/* ⚠️ A resposta em TEXTO não aparece aqui (decisão do usuário em
                15/09/2026): a conversa por voz é para ser ouvida, e o texto ao
                lado da esfera transformava a tela num chat. Quem precisa reler
                encontra tudo em `Conversas`, na barra lateral.
                O GRÁFICO é outra coisa, e entra: "quarenta e um caminhões, todos
                ativos" se ouve, mas a comparação entre as quatro situações só se
                enxerga. */}
            {visualDaVez?.chart || visualDaVez?.table ? (
              <div className="mx-auto mt-6 w-full max-w-2xl rounded-xl border border-border/60 bg-card/60 p-4 text-left backdrop-blur">
                {visualDaVez.chart ? <AnswerChart chart={visualDaVez.chart} /> : null}
                {visualDaVez.table ? <TabelaDaResposta tabela={visualDaVez.table} /> : null}
              </div>
            ) : null}

            <div
              ref={waveformRef}
              className={cn('voice-waveform', `voice-waveform--${status}`)}
              aria-hidden
            >
              {WAVE_BARS.map((bar) => (
                <span
                  key={bar}
                  className="voice-wave-bar"
                  style={{
                    height: `${18 + ((bar * 7) % 30)}px`,
                    animationDelay: `${bar * -43}ms`,
                  }}
                />
              ))}
            </div>

            <Button
              type="button"
              variant={status === 'speaking' ? 'outline' : 'brand'}
              size="lg"
              onClick={handlePrimaryAction}
              disabled={status === 'processing'}
              className="mt-7 h-12 min-w-52 rounded-full px-7"
              aria-label={actionLabel}
            >
              {status === 'listening' ? (
                <AudioWaveIcon className="h-4 w-4" />
              ) : status === 'speaking' ? (
                <VolumeIcon className="h-4 w-4" />
              ) : status === 'error' ? (
                <MicOffIcon className="h-4 w-4" />
              ) : status === 'processing' ? (
                <AiIcon className="h-4 w-4 animate-pulse" />
              ) : (
                <MicIcon className="h-4 w-4" />
              )}
              {status === 'processing' ? 'Processando…' : actionLabel}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Dia e hora da apuração, no formato que a barra lateral já usa para a data. */
const horaDaApuracao = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Um turno do painel: o texto, e o que foi desenhado com ele. */
interface TurnoNaTela extends VoiceTurn {
  chart?: AssistantAnswer['chart'];
  table?: AssistantTable | undefined;
  /** Quando o número foi apurado. Só nos turnos relidos de uma conversa gravada. */
  apuradoEm?: string;
}

/**
 * A lista que acompanha a resposta, quando o que importa é quem e quando.
 *
 * ⚠️ Rola na horizontal em vez de encolher a fonte: seis colunas de documento
 * numa tela estreita ou quebram a página ou viram texto ilegível, e a segunda
 * opção esconde justamente a data que faz a pessoa agir.
 */
function TabelaDaResposta({ tabela }: { tabela: AssistantTable }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            {tabela.columns.map((coluna) => (
              <th key={coluna} className="whitespace-nowrap px-2 py-1 font-medium">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabela.rows.map((linha, indice) => (
            <tr key={indice} className="border-t border-border/50">
              {linha.map((celula, coluna) => (
                <td key={coluna} className="whitespace-nowrap px-2 py-1">
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
