import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'tw-flex tw-h-9 tw-w-full tw-items-center tw-justify-between tw-rounded-md tw-border tw-border-slate-200 tw-bg-transparent tw-px-3 tw-py-2 tw-text-sm tw-shadow-sm tw-ring-offset-white placeholder:tw-text-slate-500 focus:tw-outline-none focus:tw-ring-1 focus:tw-ring-slate-950 disabled:tw-cursor-not-allowed disabled:tw-opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export { Select };
