import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader as LoaderIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { resolveVariant } from '../../lib/variants';

/** @type {const} */
export const KUMO_BUTTON_VARIANTS = {
  shape: {
    base: { classes: '', description: 'Rectangular button' },
    square: { classes: 'tw-items-center tw-justify-center tw-p-0', description: 'Square icon-only button' },
    circle: { classes: 'tw-items-center tw-justify-center tw-p-0 tw-rounded-full', description: 'Circular icon-only button' },
  },
  size: {
    xs: { classes: 'tw-h-6 tw-gap-1 tw-rounded-sm tw-px-1.5 tw-text-xs', description: 'Extra small' },
    sm: { classes: 'tw-h-8 tw-gap-1 tw-rounded-md tw-px-2 tw-text-xs tw-tracking-[0.08em]', description: 'Small' },
    base: { classes: 'tw-h-9 tw-gap-1.5 tw-rounded-lg tw-px-4 tw-text-sm', description: 'Default size' },
    lg: { classes: 'tw-h-10 tw-gap-2 tw-rounded-lg tw-px-6 tw-text-base', description: 'Large' },
  },
  compactSize: {
    xs: { classes: 'tw-size-5' },
    sm: { classes: 'tw-size-8' },
    base: { classes: 'tw-size-9' },
    lg: { classes: 'tw-size-10' },
  },
  variant: {
    primary: {
      classes:
        'tw-border-[#7d3421] tw-bg-[var(--kumo-brand)] tw-text-[var(--kumo-brand-text)] tw-shadow-[var(--kumo-shadow-sm)] hover:tw-bg-[var(--kumo-brand-hover)] disabled:tw-bg-[var(--kumo-brand)]/50',
      description: 'High-emphasis primary action',
    },
    secondary: {
      classes:
        'tw-border-[var(--kumo-control-border)] tw-bg-[var(--kumo-control-bg)] tw-text-[var(--kumo-control-text)] tw-shadow-[var(--kumo-shadow-sm)] hover:tw-bg-[var(--kumo-control-bg-hover)]',
      description: 'Default secondary action',
    },
    ghost: {
      classes:
        'tw-border-transparent tw-bg-transparent tw-text-[var(--kumo-subtle)] tw-shadow-none hover:tw-bg-[var(--kumo-recessed)] hover:tw-text-[var(--kumo-default)]',
      description: 'Minimal ghost button',
    },
    destructive: {
      classes:
        'tw-border-[#8e1b16] tw-bg-[var(--kumo-danger)] tw-text-white tw-shadow-[0_2px_0_rgba(108,24,18,0.28)] hover:tw-bg-[#a1271c]',
      description: 'Destructive action',
    },
    "secondary-destructive": {
      classes:
        'tw-border-[var(--kumo-danger)] tw-bg-[var(--kumo-control-bg)] tw-text-[var(--kumo-danger)] tw-shadow-[var(--kumo-shadow-sm)] hover:tw-bg-[var(--kumo-danger)]/10',
      description: 'Secondary destructive',
    },
    outline: {
      classes:
        'tw-border-[var(--kumo-hairline)] tw-bg-transparent tw-text-[var(--kumo-default)] tw-shadow-none hover:tw-bg-[var(--kumo-control-bg-hover)]',
      description: 'Bordered outline',
    },
    tinted: {
      classes:
        'tw-border-[#b59f67] tw-bg-[var(--kumo-tint)] tw-text-[#3d3118] tw-shadow-[0_2px_0_rgba(140,118,56,0.14)] hover:tw-bg-[var(--kumo-tint-hover)]',
      description: 'Tinted accent button',
    },
  },
};

export const KUMO_BUTTON_DEFAULT_VARIANTS = {
  shape: 'base',
  size: 'base',
  variant: 'secondary',
};

/**
 * @param {{
 *   variant?: keyof typeof KUMO_BUTTON_VARIANTS.variant
 *   size?: keyof typeof KUMO_BUTTON_VARIANTS.size
 *   shape?: keyof typeof KUMO_BUTTON_VARIANTS.shape
 * }} [props]
 */
export function buttonVariants({
  variant = KUMO_BUTTON_DEFAULT_VARIANTS.variant,
  size = KUMO_BUTTON_DEFAULT_VARIANTS.size,
  shape = KUMO_BUTTON_DEFAULT_VARIANTS.shape,
} = {}) {
  const isCompact = shape === 'square' || shape === 'circle';

  return cn(
    'tw-inline-flex tw-shrink-0 tw-items-center tw-font-semibold tw-select-none',
    'tw-border tw-transition-colors focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[var(--kumo-focus)]',
    'disabled:tw-pointer-events-none disabled:tw-opacity-50',
    resolveVariant(KUMO_BUTTON_VARIANTS.variant, variant, KUMO_BUTTON_DEFAULT_VARIANTS.variant).classes,
    resolveVariant(KUMO_BUTTON_VARIANTS.size, size, KUMO_BUTTON_DEFAULT_VARIANTS.size).classes,
    resolveVariant(KUMO_BUTTON_VARIANTS.shape, shape, KUMO_BUTTON_DEFAULT_VARIANTS.shape).classes,
    isCompact && resolveVariant(KUMO_BUTTON_VARIANTS.compactSize, size, KUMO_BUTTON_DEFAULT_VARIANTS.size).classes,
  );
}

/**
 * Kumo-style Button with full variant system.
 * Supports: shape (base | square | circle), size (xs | sm | base | lg),
 * variant (primary | secondary | ghost | destructive | secondary-destructive | outline | tinted)
 *
 * @example
 * ```jsx
 * <Button variant="primary" size="lg">保存</Button>
 * <Button variant="secondary" shape="square" icon={PlusIcon} aria-label="添加" />
 * ```
 *
 * @param {{
 *   children?: React.ReactNode
 *   className?: string
 *   variant?: keyof typeof KUMO_BUTTON_VARIANTS.variant
 *   size?: keyof typeof KUMO_BUTTON_VARIANTS.size
 *   shape?: keyof typeof KUMO_BUTTON_VARIANTS.shape
 *   icon?: React.ReactNode
 *   loading?: boolean
 *   asChild?: boolean
 *   [key: string]: any
 * } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
const Button = forwardRef(({
  className,
  variant,
  size,
  shape,
  icon: IconComponent,
  loading,
  asChild = false,
  disabled,
  children,
  type,
  ...props
}, ref) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      data-kumo-component="Button"
      className={cn(
        buttonVariants({ variant, size, shape }),
        disabled && 'tw-cursor-not-allowed tw-opacity-50',
        className
      )}
      disabled={loading || disabled}
      type={type ?? 'button'}
      {...props}
    >
      {loading ? (
        <LoaderIcon className={cn(
          'tw-animate-spin',
          size === 'lg' ? 'tw-size-4' : size === 'sm' || size === 'xs' ? 'tw-size-3' : 'tw-size-3.5'
        )} />
      ) : IconComponent ? (
        <span className="tw-inline-flex tw-items-center">{IconComponent}</span>
      ) : null}
      {children != null && <span className="tw-contents">{children}</span>}
    </Comp>
  );
});
Button.displayName = 'Button';

export { Button };
