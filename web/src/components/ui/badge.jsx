import { cn } from '../../lib/utils';
import { resolveVariant } from '../../lib/variants';

/** @type {const} */
export const KUMO_BADGE_VARIANTS = {
  variant: {
    default: {
      classes:
        'tw-border-[#7d3421] tw-bg-[var(--kumo-brand)] tw-text-[var(--kumo-brand-text)]',
      description: 'Default brand badge',
    },
    secondary: {
      classes:
        'tw-border-[#ccb992] tw-bg-[var(--kumo-tint)] tw-text-[#3d3118]',
      description: 'Secondary tinted badge',
    },
    destructive: {
      classes:
        'tw-border-[#8e1b16] tw-bg-[var(--kumo-danger)] tw-text-white',
      description: 'Danger/destructive badge',
    },
    outline: {
      classes:
        'tw-border-[var(--kumo-line)] tw-bg-[var(--kumo-elevated)] tw-text-[var(--kumo-default)]',
      description: 'Outlined badge',
    },
    ghost: {
      classes:
        'tw-border-transparent tw-bg-[var(--kumo-recessed)] tw-text-[var(--kumo-subtle)]',
      description: 'Ghost/minimal badge',
    },
    success: {
      classes:
        'tw-border-[var(--kumo-success)] tw-bg-[var(--kumo-success)]/10 tw-text-[var(--kumo-success)]',
      description: 'Success badge',
    },
    info: {
      classes:
        'tw-border-[var(--kumo-info)] tw-bg-[var(--kumo-info)]/10 tw-text-[var(--kumo-info)]',
      description: 'Info badge',
    },
    warning: {
      classes:
        'tw-border-[var(--kumo-warning)] tw-bg-[var(--kumo-warning)]/10 tw-text-[#5c4318]',
      description: 'Warning badge',
    },
  },
  size: {
    sm: { classes: 'tw-px-1.5 tw-py-0 tw-text-[10px]', description: 'Small' },
    base: { classes: 'tw-px-2.5 tw-py-0.5 tw-text-xs', description: 'Default' },
    lg: { classes: 'tw-px-3 tw-py-1 tw-text-sm', description: 'Large' },
  },
};

export const KUMO_BADGE_DEFAULT_VARIANTS = {
  variant: 'default',
  size: 'base',
};

/**
 * @param {{
 *   variant?: keyof typeof KUMO_BADGE_VARIANTS.variant
 *   size?: keyof typeof KUMO_BADGE_VARIANTS.size
 * }} [props]
 */
export function badgeVariants({
  variant = KUMO_BADGE_DEFAULT_VARIANTS.variant,
  size = KUMO_BADGE_DEFAULT_VARIANTS.size,
} = {}) {
  return cn(
    'tw-inline-flex tw-items-center tw-rounded-md tw-border tw-font-semibold tw-transition-colors',
    resolveVariant(KUMO_BADGE_VARIANTS.variant, variant, KUMO_BADGE_DEFAULT_VARIANTS.variant).classes,
    resolveVariant(KUMO_BADGE_VARIANTS.size, size, KUMO_BADGE_DEFAULT_VARIANTS.size).classes,
  );
}

/**
 * Kumo-style Badge with extended variants.
 *
 * @param {{
 *   className?: string
 *   variant?: keyof typeof KUMO_BADGE_VARIANTS.variant
 *   size?: keyof typeof KUMO_BADGE_VARIANTS.size
 *   children?: React.ReactNode
 *   [key: string]: any
 * }} props
 */
function Badge({ className, variant, size, ...props }) {
  return (
    <div
      data-kumo-component="Badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}
Badge.displayName = 'Badge';

export { Badge };
