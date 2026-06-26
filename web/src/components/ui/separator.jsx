import { forwardRef } from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '../../lib/utils';

/**
 * Kumo-style Separator.
 *
 * @param {{
 *   className?: string
 *   orientation?: 'horizontal' | 'vertical'
 *   decorative?: boolean
 *   variant?: 'default' | 'muted' | 'strong'
 *   [key: string]: any
 * }} props
 */
const Separator = forwardRef(({
  className,
  orientation = 'horizontal',
  decorative = true,
  variant = 'default',
  ...props
}, ref) => {
  const variants = {
    default: 'tw-bg-[var(--kumo-line)]',
    muted: 'tw-bg-[var(--kumo-hairline)]',
    strong: 'tw-bg-[var(--kumo-brand)]/20',
  };

  return (
    <SeparatorPrimitive.Root
      ref={ref}
      data-kumo-component="Separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'tw-shrink-0',
        variants[variant],
        orientation === 'horizontal' ? 'tw-h-px tw-w-full' : 'tw-h-full tw-w-px',
        className
      )}
      {...props}
    />
  );
});
Separator.displayName = 'Separator';

export { Separator };
