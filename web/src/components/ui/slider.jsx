import { forwardRef, useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Kumo-style Slider component.
 *
 * @example
 * ```jsx
 * <Slider value={size} onValueChange={setSize} min={10} max={24} step={1} />
 * ```
 *
 * @param {{
 *   className?: string
 *   value?: number
 *   defaultValue?: number
 *   onValueChange?: (value: number) => void
 *   min?: number
 *   max?: number
 *   step?: number
 *   label?: string
 *   showValue?: boolean
 *   suffix?: string
 *   disabled?: boolean
 *   [key: string]: any
 * }} props
 */
const Slider = forwardRef(({
  className,
  value: controlledValue,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  suffix,
  disabled = false,
  ...props
}, ref) => {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const current = isControlled ? controlledValue : uncontrolledValue;
  const percentage = ((current - min) / (max - min)) * 100;

  const handleChange = (e) => {
    const next = Number(e.target.value);
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  };

  const slider = (
    <div className={cn('tw-relative tw-flex tw-w-full tw-items-center tw-gap-3', className)}>
      <div className="tw-relative tw-flex-1">
        <input
          ref={ref}
          type="range"
          data-kumo-component="Slider"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'tw-w-full tw-h-1.5 tw-appearance-none tw-rounded-full',
            'tw-bg-[var(--kumo-line)]',
            'tw-cursor-pointer',
            'disabled:tw-cursor-not-allowed disabled:tw-opacity-50',
            '[&::-webkit-slider-thumb]:tw-appearance-none [&::-webkit-slider-thumb]:tw-size-4 [&::-webkit-slider-thumb]:tw-rounded-full [&::-webkit-slider-thumb]:tw-bg-[var(--kumo-brand)] [&::-webkit-slider-thumb]:tw-shadow-md [&::-webkit-slider-thumb]:tw-border-2 [&::-webkit-slider-thumb]:tw-border-white [&::-webkit-slider-thumb]:tw-cursor-pointer',
            '[&::-moz-range-thumb]:tw-size-4 [&::-moz-range-thumb]:tw-rounded-full [&::-moz-range-thumb]:tw-border-none [&::-moz-range-thumb]:tw-bg-[var(--kumo-brand)] [&::-moz-range-thumb]:tw-shadow-md',
            'focus-visible:tw-outline-none [&::-webkit-slider-thumb]:focus-visible:tw-ring-2 [&::-webkit-slider-thumb]:focus-visible:tw-ring-[var(--kumo-focus)]',
          )}
          style={{
            background: `linear-gradient(to right, var(--kumo-brand) 0%, var(--kumo-brand) ${percentage}%, var(--kumo-line) ${percentage}%, var(--kumo-line) 100%)`,
          }}
          {...props}
        />
      </div>
      {showValue && (
        <span className="tw-min-w-[3ch] tw-text-sm tw-font-medium tw-text-[var(--kumo-subtle)] tw-text-right">
          {current}{suffix}
        </span>
      )}
    </div>
  );

  if (label) {
    return (
      <div className="tw-space-y-1.5">
        <div className="tw-flex tw-items-center tw-justify-between">
          <span className="tw-text-sm tw-font-medium tw-text-[var(--kumo-subtle)]">
            {label}
          </span>
          {!showValue && (
            <span className="tw-text-sm tw-font-medium tw-text-[var(--kumo-subtle)]">
              {current}{suffix}
            </span>
          )}
        </div>
        {slider}
      </div>
    );
  }

  return slider;
});
Slider.displayName = 'Slider';

export { Slider };
