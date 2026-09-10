import { ArrowRightIcon, SparklesIcon } from '@/components/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPercent } from '@/lib/format';
import { useAssistantStore } from '@/management/features/assistant/store';
import type { AiInsight } from '@/types';

export function AIInsightCard({ insight }: { insight: AiInsight }) {
  /* O mesmo drawer dos quatro perfis: o card levava para a tela que fabricava
     resposta, e ela saiu em 09/09/2026. */
  const openAssistant = useAssistantStore((state) => state.openAssistant);

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-semibold">Insight da IA RookHub</span>
              <Badge variant="info">Confiança {formatPercent(insight.confidence)}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{insight.message}</p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground">Fontes analisadas:</span>
              {insight.sources.map((source) => (
                <Badge key={source} variant="muted" className="text-[11px]">
                  {source}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="brand" onClick={openAssistant}>
            Perguntar à assistente
            <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
