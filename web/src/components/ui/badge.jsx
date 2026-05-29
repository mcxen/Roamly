import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'tw-inline-flex tw-items-center tw-rounded-md tw-border tw-px-2.5 tw-py-0.5 tw-text-xs tw-font-semibold tw-transition-colors focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#a54b2a]/30 focus:tw-ring-offset-2',
  {
    variants: {
      variant: {
        default: 'tw-border-[#7d3421] tw-bg-[#8f3f28] tw-text-[#fbf6ea]',
        secondary: 'tw-border-[#ccb992] tw-bg-[#f2dfad] tw-text-[#3d3118]',
        destructive: 'tw-border-[#8e1b16] tw-bg-[#b73124] tw-text-[#fff7f0]',
        outline: 'tw-border-[#c7b89b] tw-bg-[#fffaf0] tw-text-[#213449]'
      }
    },
    defaultVariants: { variant: 'default' }
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
