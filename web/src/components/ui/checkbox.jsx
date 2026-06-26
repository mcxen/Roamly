import { forwardRef, useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Kumo-style Checkbox component.
 *
 * @example
 * ```jsx
 * <Checkbox checked={value} onCheckedChange={setValue} label="自动解析城市" />
 * ```
 *
 * @param {{
 *   className?: string
 *   checked?: boolean
 *   defaultChecked?: boolean
 *   onCheckedChange?: (checked: boolean) => void
 *   label?: string
 *   disabled?: boolean
 *   [key: string]: any
 * }} props
 */
const Checkbox = forwardRef(({
  className,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  label,
  disabled = false,
  children,
  ...props
}, ref) => {
  const isControlled = controlledChecked !== undefined;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const isChecked = isControlled ? controlledChecked : uncontrolledChecked;

  const handleChange = (e) => {
    const next = e.target.checked;
    if (!isControlled) setUncontrolledChecked(next);
    onCheckedChange?.(next);
  };

  const checkboxInput = (
    <input
      ref={ref}
      type="checkbox"
      data-kumo-component="Checkbox"
      checked={isChecked}
      onChange={handleChange}
      disabled={disabled}
      className={cn(
        'tw-peer tw-size-4 tw-shrink-0 tw-rounded-sm tw-border',
        'tw-border-[var(--kumo-control-border)]',
        'tw-bg-[var(--kumo-control-bg)]',
        'tw-text-[var(--kumo-brand)]',
        'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[var(--kumo-focus)]',
        'disabled:tw-cursor-not-allowed disabled:tw-opacity-50',
        'tw-cursor-pointer',
        className
      )}
      {...props}
    />
  );

  if (label) {
    return (
      <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-select-none">
        {checkboxInput}
        <span className={cn(
          'tw-text-sm tw-font-medium tw-text-[var(--kumo-default)]',
          disabled && 'tw-opacity-50'
        )}>
          {label}
        </span>
      </label>
    );
  }

  if (children) {
    return (
      <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-select-none">
        {checkboxInput}
        <span className={cn('tw-text-sm tw-text-[var(--kumo-subtle)]', disabled && 'tw-opacity-50')}>
          {children}
        </span>
      </label>
    );
  }

  return checkboxInput;
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
