import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-whitespace-nowrap tw-rounded-md tw-text-sm tw-font-medium tw-transition-colors focus-visible:tw-outline-none focus-visible:tw-ring-1 focus-visible:tw-ring-slate-950 disabled:tw-pointer-events-none disabled:tw-opacity-50',
  {
    variants: {
      variant: {
        default: 'tw-bg-slate-900 tw-text-slate-50 tw-shadow hover:tw-bg-slate-800',
        destructive: 'tw-bg-red-500 tw-text-slate-50 tw-shadow-sm hover:tw-bg-red-600',
        outline: 'tw-border tw-border-slate-200 tw-bg-white tw-shadow-sm hover:tw-bg-slate-100 hover:tw-text-slate-900',
        secondary: 'tw-bg-slate-100 tw-text-slate-900 tw-shadow-sm hover:tw-bg-slate-200',
        ghost: 'hover:tw-bg-slate-100 hover:tw-text-slate-900',
        link: 'tw-text-slate-900 tw-underline-offset-4 hover:tw-underline'
      },
      size: {
        default: 'tw-h-9 tw-px-4 tw-py-2',
        sm: 'tw-h-8 tw-rounded-md tw-px-3 tw-text-xs',
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
