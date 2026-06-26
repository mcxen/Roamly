import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Kumo-style Input with semantic tokens.
 *
 * @example
 * ```jsx
 * <Input size="sm" placeholder="搜索" error="必填" />
 * ```
 *
 * @param {{
 *   className?: string
 *   size?: 'sm' | 'base' | 'lg'
 *   error?: string
 *   [key: string]: any
 * } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
const Input = forwardRef(({ className, type, size = 'base', error, ...props }, ref) => {
  const sizes = {
    sm: 'tw-h-8 tw-px-2.5 tw-text-xs',
    base: 'tw-h-9 tw-px-3 tw-text-sm',
    lg: 'tw-h-10 tw-px-4 tw-text-base',
  };

  return (
    <div className="tw-relative tw-w-full">
      <input
        ref={ref}
        type={type}
        data-kumo-component="Input"
        className={cn(
          'tw-flex tw-w-full tw-rounded-[var(--kumo-control-radius)] tw-border',
          'tw-bg-[var(--kumo-control-bg)] tw-text-[var(--kumo-control-text)]',
          'tw-shadow-sm tw-transition-colors',
          'placeholder:tw-text-[var(--kumo-muted)]',
          error
            ? 'tw-border-[var(--kumo-danger)] focus-visible:tw-ring-[var(--kumo-danger)]/30'
            : 'tw-border-[var(--kumo-control-border)] focus-visible:tw-ring-[var(--kumo-focus)]',
          'focus-visible:tw-outline-none focus-visible:tw-ring-2',
          'disabled:tw-cursor-not-allowed disabled:tw-opacity-50',
          sizes[size],
          className
        )}
        {...props}
      />
      {error && (
        <span className="tw-absolute tw--bottom-4 tw-left-0 tw-text-xs tw-text-[var(--kumo-danger)]">
          {error}
        </span>
      )}
    </div>
  );
});
Input.displayName = 'Input';

export { Input };
