import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Kumo-style compound Card component.
 *
 * @example
 * ```jsx
 * <Card>
 *   <Card.Header>
 *     <Card.Title>Title</Card.Title>
 *     <Card.Description>Description text</Card.Description>
 *   </Card.Header>
 *   <Card.Content>Body content</Card.Content>
 *   <Card.Footer>Footer actions</Card.Footer>
 * </Card>
 * ```
 */

/**
 * @param {{
 *   className?: string
 *   variant?: 'default' | 'elevated' | 'recessed' | 'interactive'
 *   children: React.ReactNode
 *   [key: string]: any
 * }} props
 */
const Card = forwardRef(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default:
      'tw-rounded-xl tw-border tw-border-[var(--kumo-line)] tw-bg-[var(--kumo-panel-bg)] tw-shadow-[var(--kumo-shadow-md)]',
    elevated:
      'tw-rounded-xl tw-border tw-border-[var(--kumo-line)] tw-bg-[var(--kumo-elevated)] tw-shadow-[var(--kumo-shadow-lg)]',
    recessed:
      'tw-rounded-xl tw-border tw-border-[var(--kumo-line)] tw-bg-[var(--kumo-recessed)]',
    interactive:
      'tw-rounded-xl tw-border tw-border-[var(--kumo-hairline)] tw-bg-[var(--kumo-panel-bg)] tw-shadow-[var(--kumo-shadow-md)] hover:tw-shadow-[var(--kumo-shadow-lg)] hover:tw--translate-y-0.5 tw-transition-all tw-cursor-pointer',
  };

  return (
    <div
      ref={ref}
      data-kumo-component="Card"
      className={cn(variants[variant], 'tw-overflow-hidden', className)}
      {...props}
    />
  );
});
Card.displayName = 'Card';

const CardHeader = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-kumo-part="header"
    className={cn('tw-flex tw-flex-col tw-space-y-1.5 tw-p-5', className)}
    {...props}
  />
));
CardHeader.displayName = 'Card.Header';

const CardTitle = forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    data-kumo-part="title"
    className={cn(
      'tw-font-semibold tw-leading-none tw-tracking-wide tw-font-[var(--kumo-font-display)]',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'Card.Title';

const CardDescription = forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-kumo-part="description"
    className={cn('tw-text-sm tw-text-[var(--kumo-subtle)]', className)}
    {...props}
  />
));
CardDescription.displayName = 'Card.Description';

const CardContent = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-kumo-part="content"
    className={cn('tw-p-5 tw-pt-0', className)}
    {...props}
  />
));
CardContent.displayName = 'Card.Content';

const CardFooter = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-kumo-part="footer"
    className={cn(
      'tw-flex tw-items-center tw-p-5 tw-pt-0 tw-gap-3',
      className
    )}
    {...props}
  />
));
CardFooter.displayName = 'Card.Footer';

Object.assign(Card, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Footer: CardFooter,
});

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
