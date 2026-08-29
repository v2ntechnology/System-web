import { cn } from './lib/cn';

export interface AvatarProps {
  src?: string | undefined;
  /** Nome completo — vira o alt e, sem imagem, as iniciais. */
  name: string;
  className?: string | undefined;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ src, name, className }: AvatarProps) {
  const base = 'rounded-pill shrink-0 overflow-hidden ring-1 ring-on-surface/15';

  if (!src) {
    return (
      <span
        aria-hidden="true"
        title={name}
        className={cn(
          base,
          'bg-surface-high text-on-surface text-label-md flex items-center justify-center',
          'size-11',
          className,
        )}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      draggable={false}
      className={cn(base, 'size-11 object-cover', className)}
    />
  );
}
