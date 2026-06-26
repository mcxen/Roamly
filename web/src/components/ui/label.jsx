import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Kumo-style Label with semantic tokens.
 *
 * @param {{
 *   className?: string
 *   size?: 'sm' | 'base'
 *   required?: boolean
 *   children?: React.ReactNode
 *   [key: string]: any
 * }} props
 */
const Label = forwardRef(({ className, size = 'base', required, children, ...props }, ref) => {
  const sizes = {
    sm: 'tw-text-xs',
    base: 'tw-text-sm',
  };

  return (
    <label
      ref={ref}
      data-kumo-component="Label"
      className={cn(
        'tw-font-medium tw-leading-tight tw-text-[var(--kumo-subtle)]',
        'peer-disabled:tw-cursor-not-allowed peer-disabled:tw-opacity-70',
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="tw-ml-0.5 tw-text-[var(--kumo-danger)]">*</span>}
    </label>
  );
});
Label.displayName = 'Label';

export { Label };
