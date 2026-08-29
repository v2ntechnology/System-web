import { ChevronRightIcon } from '@/components/icons';
import { Fragment } from 'react';
import { Link, useLocation } from 'react-router';

import { ROUTE_LABELS } from '@/app/navigation';
import { cn } from '@/lib/utils';

function labelFor(segment: string): string {
  if (ROUTE_LABELS[segment]) return ROUTE_LABELS[segment];
  // Segmentos dinâmicos (ids) recebem um rótulo genérico legível.
  if (/^[a-z]{3}-/.test(segment) || /\d/.test(segment)) return 'Detalhes';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    return { label: labelFor(segment), path, isLast: index === segments.length - 1 };
  });

  return (
    <nav aria-label="Trilha de navegação" className="hidden items-center gap-1 text-sm md:flex">
      {crumbs.map((crumb) => (
        <Fragment key={crumb.path}>
          {crumb.isLast ? (
            <span className="font-medium text-foreground" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <>
              <Link
                to={crumb.path}
                className={cn('text-muted-foreground transition-colors hover:text-foreground')}
              >
                {crumb.label}
              </Link>
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground/50" />
            </>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
