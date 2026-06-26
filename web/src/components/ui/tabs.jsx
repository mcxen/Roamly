import { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

const TabsContext = createContext(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs compound parts must be used within <Tabs>');
  return ctx;
}

/**
 * Kumo-style Tabs component for tabbed navigation.
 *
 * @example
 * ```jsx
 * <Tabs value={tab} onValueChange={setTab}>
 *   <Tabs.List>
 *     <Tabs.Trigger value="storage">存储</Tabs.Trigger>
 *     <Tabs.Trigger value="ai">AI</Tabs.Trigger>
 *   </Tabs.List>
 *   <Tabs.Panel value="storage">Content for storage</Tabs.Panel>
 *   <Tabs.Panel value="ai">Content for AI</Tabs.Panel>
 * </Tabs>
 * ```
 */
function Tabs({ value: controlledValue, onValueChange, defaultValue, children }) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
  const isControlled = controlledValue !== undefined;
  const current = isControlled ? controlledValue : uncontrolledValue;

  const handleChange = useCallback((next) => {
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  }, [isControlled, onValueChange]);

  return (
    <TabsContext.Provider value={{ value: current, onValueChange: handleChange }}>
      <div data-kumo-component="Tabs">{children}</div>
    </TabsContext.Provider>
  );
}
Tabs.displayName = 'Tabs';

function TabsList({ className, variant = 'default', children }) {
  const variants = {
    default:
      'tw-flex tw-gap-1 tw-border-b tw-border-[var(--kumo-line)] tw-pb-0',
    pills:
      'tw-flex tw-gap-2 tw-flex-wrap',
    sidebar:
      'tw-flex tw-flex-col tw-gap-1',
  };

  return (
    <div
      data-kumo-part="list"
      role="tablist"
      className={cn(variants[variant], className)}
    >
      {children}
    </div>
  );
}
TabsList.displayName = 'Tabs.List';

function TabsTrigger({ className, variant = 'default', value, icon, disabled, children }) {
  const { value: selected, onValueChange } = useTabs();
  const isActive = selected === value;

  const variants = {
    default: cn(
      'tw-relative tw-px-4 tw-py-2.5 tw-text-sm tw-font-medium',
      'tw-text-[var(--kumo-subtle)] tw-transition-colors',
      'tw-border-b-2 tw-border-transparent tw-mb-[-1px]',
      'hover:tw-text-[var(--kumo-default)] hover:tw-bg-[var(--kumo-recessed)]/50',
      isActive && 'tw-border-[var(--kumo-brand)] tw-text-[var(--kumo-brand)]',
      disabled && 'tw-opacity-40 tw-cursor-not-allowed tw-pointer-events-none',
    ),
    pills: cn(
      'tw-px-3 tw-py-1.5 tw-text-sm tw-font-medium tw-rounded-full tw-transition-colors',
      'tw-text-[var(--kumo-subtle)]',
      'hover:tw-bg-[var(--kumo-recessed)] hover:tw-text-[var(--kumo-default)]',
      isActive && 'tw-bg-[var(--kumo-brand)] tw-text-[var(--kumo-brand-text)]',
      disabled && 'tw-opacity-40 tw-cursor-not-allowed tw-pointer-events-none',
    ),
    sidebar: cn(
      'tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-text-sm tw-font-medium tw-rounded-lg',
      'tw-text-[var(--kumo-subtle)] tw-transition-colors',
      'tw-border-l-[3px] tw-border-transparent',
      'hover:tw-text-[var(--kumo-default)] hover:tw-bg-[var(--kumo-recessed)]/50',
      isActive && 'tw-border-l-[var(--kumo-brand)] tw-text-[var(--kumo-default)] tw-bg-[var(--kumo-recessed)]/60',
      disabled && 'tw-opacity-40 tw-cursor-not-allowed tw-pointer-events-none',
    ),
  };

  return (
    <button
      data-kumo-part="trigger"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      className={cn(
        'tw-inline-flex tw-items-center tw-cursor-pointer tw-select-none tw-bg-transparent',
        'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[var(--kumo-focus)]',
        variants[variant],
        className
      )}
      onClick={() => onValueChange(value)}
    >
      {icon && <span className="tw-inline-flex tw-items-center">{icon}</span>}
      {children}
    </button>
  );
}
TabsTrigger.displayName = 'Tabs.Trigger';

function TabsPanel({ className, value, children }) {
  const { value: selected } = useTabs();
  if (selected !== value) return null;

  return (
    <div
      data-kumo-part="panel"
      role="tabpanel"
      className={cn('tw-animate-[kumo-fade-in_0.15s_ease]', className)}
    >
      {children}
    </div>
  );
}
TabsPanel.displayName = 'Tabs.Panel';

Object.assign(Tabs, {
  List: TabsList,
  Trigger: TabsTrigger,
  Panel: TabsPanel,
});

export { Tabs, TabsList, TabsTrigger, TabsPanel };
