import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-whitespace-nowrap tw-rounded-md tw-border tw-text-sm tw-font-medium tw-transition-colors focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[#a54b2a]/30 disabled:tw-pointer-events-none disabled:tw-opacity-50',
  {
    variants: {
      variant: {
        default: 'tw-border-[#7d3421] tw-bg-[#8f3f28] tw-text-[#f8f1df] tw-shadow-[0_3px_0_rgba(92,38,22,0.35)] hover:tw-bg-[#7d3421]',
        destructive: 'tw-border-[#8e1b16] tw-bg-[#b73124] tw-text-[#fff7f0] tw-shadow-[0_3px_0_rgba(108,24,18,0.28)] hover:tw-bg-[#a1271c]',
        outline: 'tw-border-[#8b7a60] tw-bg-[#fbf6ea] tw-text-[#213449] tw-shadow-[0_2px_0_rgba(120,103,80,0.16)] hover:tw-bg-[#f1e4c8] hover:tw-text-[#1d3042]',
        secondary: 'tw-border-[#b59f67] tw-bg-[#ead6a0] tw-text-[#3d3118] tw-shadow-[0_2px_0_rgba(140,118,56,0.14)] hover:tw-bg-[#dfc98d]',
        ghost: 'tw-border-transparent tw-bg-transparent tw-text-[#59606b] hover:tw-bg-[#efe3c7] hover:tw-text-[#213449]',
        link: 'tw-border-transparent tw-bg-transparent tw-text-[#213449] tw-underline-offset-4 hover:tw-underline'
      },
      size: {
        default: 'tw-h-9 tw-px-4 tw-py-2',
        sm: 'tw-h-8 tw-rounded-md tw-px-3 tw-text-xs tw-tracking-[0.08em]',
        lg: 'tw-h-10 tw-rounded-md tw-px-8',
        icon: 'tw-h-9 tw-w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
