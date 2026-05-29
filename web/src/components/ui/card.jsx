import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Card = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'tw-rounded-[18px] tw-border tw-border-[#7b6a52]/40 tw-bg-[#f8f1df]/95 tw-shadow-[0_10px_24px_rgba(60,44,24,0.12)] before:tw-pointer-events-none before:tw-absolute before:tw-inset-[5px] before:tw-rounded-[14px] before:tw-border before:tw-border-[#d3c3a7]/70 before:tw-content-[""] tw-relative',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('tw-flex tw-flex-col tw-space-y-1.5 tw-p-5 tw-relative tw-z-[1]', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('tw-font-semibold tw-leading-none tw-tracking-[0.12em] tw-text-[#213449]', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('tw-text-sm tw-text-[#6b6353]', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('tw-p-5 tw-pt-0 tw-relative tw-z-[1]', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('tw-flex tw-items-center tw-p-5 tw-pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
