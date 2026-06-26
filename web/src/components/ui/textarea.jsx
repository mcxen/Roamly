import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Kumo-style Textarea with semantic tokens.
 *
 * @param {{
 *   className?: string
 *   error?: string
 *   [key: string]: any
 * } & React.TextareaHTMLAttributes<HTMLTextAreaElement>} props
 */
const Textarea = forwardRef(({ className, error, ...props }, ref) => (
  <div className="tw-relative tw-w-full">
    <textarea
      ref={ref}
      data-kumo-component="Textarea"
      className={cn(
        'tw-flex tw-min-h-[60px] tw-w-full tw-rounded-[var(--kumo-control-radius)] tw-border',
        'tw-bg-[var(--kumo-control-bg)] tw-text-[var(--kumo-control-text)]',
        'tw-px-3 tw-py-2 tw-text-sm tw-shadow-sm tw-transition-colors',
        'placeholder:tw-text-[var(--kumo-muted)]',
        error
          ? 'tw-border-[var(--kumo-danger)] focus-visible:tw-ring-[var(--kumo-danger)]/30'
          : 'tw-border-[var(--kumo-control-border)] focus-visible:tw-ring-[var(--kumo-focus)]',
        'focus-visible:tw-outline-none focus-visible:tw-ring-2',
        'disabled:tw-cursor-not-allowed disabled:tw-opacity-50',
        'tw-resize-y',
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
));
Textarea.displayName = 'Textarea';

export { Textarea };
