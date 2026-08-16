import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as LabelPrimitive from '@radix-ui/react-label';
import { useId, type ComponentPropsWithoutRef } from 'react';
import { cn } from './lib/cn';

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label: string;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  return (
    <div className="flex items-center gap-2">
      <CheckboxPrimitive.Root
        id={checkboxId}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]',
          'border-outline bg-surface-lowest border transition-colors',
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
          'focus-visible:ring-secondary focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="text-on-primary">
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
            <path
              d="M1.5 6.5L4.5 9.5L10.5 2.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      <LabelPrimitive.Root
        htmlFor={checkboxId}
        className="text-body-md text-on-surface-variant cursor-pointer select-none"
      >
        {label}
      </LabelPrimitive.Root>
    </div>
  );
}
