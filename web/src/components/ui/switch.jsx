import { forwardRef, useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Kumo-style Switch/Toggle component.
 *
 * @example
 * ```jsx
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 * <Switch label="启用 AI 推荐" checked={showCard} onCheckedChange={setShowCard} />
 * ```
 *
 * @param {{
 *   className?: string
 *   checked?: boolean
 *   defaultChecked?: boolean
 *   onCheckedChange?: (checked: boolean) => void
 *   label?: string
 *   disabled?: boolean
 *   size?: 'sm' | 'base'
 *   [key: string]: any
 * }} props
 */
const Switch = forwardRef(({
  className,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  label,
  disabled = false,
  size = 'base',
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

  const sizes = {
    sm: { track: 'tw-h-4 tw-w-8', thumb: 'tw-h-3 tw-w-3', translate: 'tw-translate-x-4' },
    base: { track: 'tw-h-5 tw-w-9', thumb: 'tw-h-4 tw-w-4', translate: 'tw-translate-x-4' },
  };

  const s = sizes[size];

  const switchElement = (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-kumo-component="Switch"
      data-state={isChecked ? 'checked' : 'unchecked'}
      disabled={disabled}
      className={cn(
        'tw-relative tw-inline-flex tw-shrink-0 tw-cursor-pointer tw-items-center tw-rounded-full',
        'tw-border-2 tw-border-transparent tw-transition-colors',
        'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[var(--kumo-focus)] focus-visible:tw-ring-offset-2',
        'disabled:tw-cursor-not-allowed disabled:tw-opacity-50',
        isChecked ? 'tw-bg-[var(--kumo-brand)]' : 'tw-bg-[var(--kumo-line)]',
        s.track,
        className
      )}
      onClick={() => {
        if (!disabled) {
          const next = !isChecked;
          if (!isControlled) setUncontrolledChecked(next);
          onCheckedChange?.(next);
        }
      }}
      {...props}
    >
      <span
        data-kumo-part="thumb"
        className={cn(
          'tw-pointer-events-none tw-block tw-rounded-full tw-bg-white tw-shadow-md tw-transition-transform',
          isChecked ? s.translate : 'tw-translate-x-0.5',
          s.thumb
        )}
      />
    </button>
  );

  if (label) {
    return (
      <label
        data-kumo-component="Switch"
        data-kumo-part="label"
        className="tw-inline-flex tw-items-center tw-gap-3 tw-cursor-pointer tw-select-none"
      >
        {switchElement}
        <span className={cn(
          'tw-text-sm tw-font-medium tw-text-[var(--kumo-default)]',
          disabled && 'tw-opacity-50'
        )}>
          {label}
        </span>
      </label>
    );
  }

  return switchElement;
});
Switch.displayName = 'Switch';

export { Switch };
