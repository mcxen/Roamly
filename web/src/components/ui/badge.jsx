import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'tw-inline-flex tw-items-center tw-rounded-md tw-border tw-px-2.5 tw-py-0.5 tw-text-xs tw-font-semibold tw-transition-colors focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-slate-950 focus:tw-ring-offset-2',
  {
    variants: {
      variant: {
        default: 'tw-border-transparent tw-bg-slate-900 tw-text-slate-50',
        secondary: 'tw-border-transparent tw-bg-slate-100 tw-text-slate-900',
        destructive: 'tw-border-transparent tw-bg-red-500 tw-text-slate-50',
        outline: 'tw-text-slate-950'
      }
    },
    defaultVariants: { variant: 'default' }
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
