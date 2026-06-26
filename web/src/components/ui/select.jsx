import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Kumo-style native Select with semantic tokens.
 *
 * @example
 * ```jsx
 * <Select size="sm">
 *   <option value="">All</option>
 *   <option value="cn">China</option>
 * </Select>
 * ```
 *
 * @param {{
 *   className?: string
 *   size?: 'sm' | 'base' | 'lg'
 *   children?: React.ReactNode
 *   [key: string]: any
 * }} props
 */
const Select = forwardRef(({ className, size = 'base', children, ...props }, ref) => {
  const sizes = {
    sm: 'tw-h-8 tw-px-2.5 tw-text-xs',
    base: 'tw-h-9 tw-px-3 tw-text-sm',
    lg: 'tw-h-10 tw-px-4 tw-text-base',
  };

  return (
    <select
      ref={ref}
      data-kumo-component="Select"
      className={cn(
        'tw-flex tw-w-full tw-cursor-pointer tw-items-center tw-justify-between tw-rounded-[var(--kumo-control-radius)]',
        'tw-border tw-border-[var(--kumo-control-border)]',
        'tw-bg-[var(--kumo-control-bg)] tw-text-[var(--kumo-control-text)]',
        'tw-shadow-sm tw-transition-colors',
        'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[var(--kumo-focus)]',
        'disabled:tw-cursor-not-allowed disabled:tw-opacity-50',
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export { Select };
