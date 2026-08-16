import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPercent } from '@/lib/format';
import type { AiInsight } from '@/types';

export function AIInsightCard({ insight }: { insight: AiInsight }) {
  const navigate = useNavigate();

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
            <Sparkles className="h-5 w-5" />
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
          <Button size="sm" variant="brand" onClick={() => navigate('/app/ia')}>
            Abrir central de IA
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
