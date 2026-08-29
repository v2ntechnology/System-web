import { BotIcon, InfoIcon, MicIcon, PlusIcon, SendIcon, SparklesIcon } from '@/components/icons';
import { useRef, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PlanGuard } from '@/components/shared/guards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

const SUGGESTIONS = [
  'Quais veículos precisam de atenção esta semana?',
  'Como reduzir o consumo de combustível?',
  'Quais motoristas tiveram melhor desempenho?',
  'Resuma os alertas críticos de hoje.',
];

const HISTORY = [
  'Análise de consumo — maio',
  'Veículos parados há mais tempo',
  'Rotas com risco de atraso',
  'Desempenho de motoristas',
];

function buildAnswer(question: string, id: string): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: `Com base nos dados operacionais, analisei a sua pergunta: "${question}". Identifiquei 3 veículos da linha pesada com aumento de consumo acima de 9% e 2 rotas com risco de atraso para hoje. Recomendo priorizar a revisão de pressão de pneus e o reagendamento da rota Porto Alegre → Florianópolis.`,
    sources: ['Telemetria', 'Abastecimentos', 'Viagens', 'Alertas'],
  };
}

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageCounterRef = useRef(0);

  function send(text: string) {
    const question = text.trim();
    if (!question || thinking) return;
    messageCounterRef.current += 1;
    const turn = messageCounterRef.current;
    const userMessage: ChatMessage = { id: `u-${turn}`, role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setThinking(true);
    timerRef.current = setTimeout(() => {
      setMessages((prev) => [...prev, buildAnswer(question, `a-${turn}`)]);
      setThinking(false);
    }, 900);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA RookHub"
        description="Converse com a inteligência artificial da plataforma para apoio à decisão."
      />

      <PlanGuard module="ai">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="hidden lg:block">
            <CardContent className="space-y-3 pt-6">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setMessages([])}
              >
                <PlusIcon className="h-4 w-4" />
                Nova conversa
              </Button>
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico
              </p>
              <ul className="space-y-1">
                {HISTORY.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      className="w-full truncate rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="flex h-[70vh] flex-col">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-primary-foreground">
                    <SparklesIcon className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-display text-lg font-semibold">
                      Como posso ajudar sua operação?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Escolha uma sugestão ou faça uma pergunta.
                    </p>
                  </div>
                  <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
                          <BotIcon className="h-4 w-4" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'max-w-[80%] space-y-2 rounded-lg px-4 py-3 text-sm',
                          message.role === 'user'
                            ? 'bg-primary-strong text-on-primary'
                            : 'border border-border bg-muted/40',
                        )}
                      >
                        <p className="leading-relaxed">{message.content}</p>
                        {message.sources && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-xs text-muted-foreground">Fontes:</span>
                            {message.sources.map((source) => (
                              <Badge key={source} variant="muted" className="text-[11px]">
                                {source}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {thinking && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BotIcon className="h-4 w-4 animate-pulse text-primary" />A IA está analisando
                      os dados…
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-border p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-end gap-2"
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Pergunte sobre sua frota…"
                  className="min-h-[44px] resize-none"
                  aria-label="Mensagem para a IA"
                />
                <Button type="button" variant="outline" size="icon" aria-label="Entrada por voz">
                  <MicIcon className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  size="icon"
                  disabled={!input.trim() || thinking}
                  aria-label="Enviar"
                >
                  <SendIcon className="h-4 w-4" />
                </Button>
              </form>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <InfoIcon className="h-3.5 w-3.5" />
                As respostas são recomendações de apoio à decisão e podem conter imprecisões.
              </p>
            </div>
          </Card>
        </div>
      </PlanGuard>
    </div>
  );
}
