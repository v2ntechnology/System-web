import { IdCardIcon, UserIcon } from '@/components/icons';
import { cn, StatusChip } from '@/management/ui';

import { allowsTruck, daysUntilExpiry, formatCpf } from '../registration-schema';

/**
 * A carteira do motorista, montando enquanto o formulário é preenchido.
 *
 * <h2>Não é decoração</h2>
 *
 * O cadastro tem doze campos, e quem preenche em lote não relê o formulário
 * antes de gravar. A carteira é a releitura: mostra o que ficou de fato, com o
 * mesmo vocabulário da lista, e acende os dois avisos que importam antes de o
 * registro existir (CNH vencida, categoria que não habilita caminhão).
 *
 * <h2>Estado vazio é conteúdo</h2>
 *
 * ⚠️ Campo não preenchido aparece como travessão, e não some. Uma carteira que
 * encolhe conforme falta dado esconde o que falta: o gestor grava achando que
 * terminou. Mostrando a lacuna, ele vê que a filial ficou em branco.
 */
export interface DriverIdCardProps {
  name: string;
  document: string;
  cnhCategory: string;
  cnhExpiresAt: string;
  siteName: string | null;
  employeeNumber: string;
  phone: string;
  active: boolean;
  /** Data URL da foto escolhida, quando houver. */
  photo: string | null;
  className?: string | undefined;
}

const dataBr = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '–';
};

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-on-surface-muted text-label-sm normal-case">{label}</p>
      <p className="text-on-surface text-body-sm mt-0.5 truncate">{value || '–'}</p>
    </div>
  );
}

export function DriverIdCard({
  name,
  document,
  cnhCategory,
  cnhExpiresAt,
  siteName,
  employeeNumber,
  phone,
  active,
  photo,
  className,
}: DriverIdCardProps) {
  const days = daysUntilExpiry(cnhExpiresAt);
  const expired = days != null && days < 0;
  const expiringSoon = days != null && days >= 0 && days <= 30;
  const truck = allowsTruck(cnhCategory);
  const cleanName = name.trim();

  return (
    <div
      className={cn(
        'bg-surface-lowest border-outline-variant overflow-hidden rounded-xl border',
        className,
      )}
    >
      {/* Faixa da marca no topo, como a tarja de uma carteira de verdade. */}
      <div className="bg-brand-gradient flex h-9 items-center justify-between px-4">
        <span className="text-label-sm font-sora font-semibold tracking-wide text-white">
          RookHub
        </span>
        <IdCardIcon size={15} className="text-white/80" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3.5">
          <div className="ring-outline-variant bg-surface-low grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg ring-1">
            {photo ? (
              <img src={photo} alt="" className="size-full object-cover" />
            ) : cleanName ? (
              <span className="text-on-surface-muted font-sora text-[22px] font-bold">
                {initials(cleanName)}
              </span>
            ) : (
              <UserIcon size={26} className="text-on-surface-muted" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-on-surface-muted text-label-sm normal-case">Nome completo</p>
            <p className="text-on-surface font-sora mt-0.5 truncate text-[17px] font-semibold leading-tight">
              {cleanName || 'Nome do motorista'}
            </p>
            <p className="text-on-surface-variant text-body-sm tabular mt-1.5">
              {document ? formatCpf(document) : 'CPF não informado'}
            </p>
          </div>
        </div>

        <div className="border-outline-variant grid grid-cols-2 gap-3 border-t pt-3.5">
          <Field label="Categoria" value={cnhCategory} />
          <Field label="Vence em" value={cnhExpiresAt ? dataBr(cnhExpiresAt) : null} />
          <Field label="Filial" value={siteName} />
          <Field label="Matrícula" value={employeeNumber.trim() || null} />
          <Field label="Telefone" value={phone.trim() || null} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {cnhExpiresAt ? (
            <StatusChip tone={expired ? 'critical' : expiringSoon ? 'attention' : 'positive'}>
              {expired ? 'CNH vencida' : expiringSoon ? `vence em ${days}d` : 'CNH em dia'}
            </StatusChip>
          ) : (
            <StatusChip tone="neutral">vencimento em branco</StatusChip>
          )}

          <StatusChip tone={truck ? 'info' : 'neutral'}>
            {truck ? 'habilita caminhão' : 'não habilita caminhão'}
          </StatusChip>

          {!active ? <StatusChip tone="neutral">fora de escala</StatusChip> : null}
        </div>
      </div>
    </div>
  );
}
