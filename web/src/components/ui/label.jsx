import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Label = forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('tw-text-sm tw-font-medium tw-leading-none peer-disabled:tw-cursor-not-allowed peer-disabled:tw-opacity-70', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
