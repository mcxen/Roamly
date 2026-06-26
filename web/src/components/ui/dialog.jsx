import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  useRef,
  forwardRef,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

/**
 * Kumo-style compound Dialog component.
 * Inspired by @cloudflare/kumo Dialog — compound pattern with Root/Trigger/Content/Title/Description/Close.
 *
 * @example
 * ```jsx
 * <Dialog.Root open={open} onOpenChange={setOpen}>
 *   <Dialog.Trigger>
 *     <Button>打开</Button>
 *   </Dialog.Trigger>
 *   <Dialog.Content size="base">
 *     <Dialog.Title>确认操作</Dialog.Title>
 *     <Dialog.Description>你确定要执行此操作吗？</Dialog.Description>
 *     <div className="tw-flex tw-gap-3 tw-mt-4 tw-justify-end">
 *       <Dialog.Close>
 *         <Button variant="secondary">取消</Button>
 *       </Dialog.Close>
 *       <Button variant="primary">确认</Button>
 *     </div>
 *   </Dialog.Content>
 * </Dialog.Root>
 * ```
 */

const DialogContext = createContext(null);

function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog compound parts must be used within <Dialog.Root>');
  return ctx;
}

function DialogRoot({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback((next) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [isControlled, onOpenChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  return (
    <DialogContext.Provider value={{ isOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}
DialogRoot.displayName = 'Dialog.Root';

function DialogTrigger({ children, asChild, ...props }) {
  const { setOpen } = useDialog();

  if (asChild && children) {
    const child = Array.isArray(children) ? children[0] : children;
    if (child && child.type) {
      const ChildComponent = child.type;
      return (
        <ChildComponent
          {...child.props}
          onClick={(e) => {
            child.props.onClick?.(e);
            setOpen(true);
          }}
          {...props}
        />
      );
    }
  }

  return (
    <span
      data-kumo-component="Dialog"
      data-kumo-part="trigger"
      onClick={() => setOpen(true)}
      className="tw-inline-flex tw-cursor-pointer"
      {...props}
    >
      {children}
    </span>
  );
}
DialogTrigger.displayName = 'Dialog.Trigger';

const DIALOG_SIZES = {
  sm: 'tw-max-w-sm',
  base: 'tw-max-w-md',
  lg: 'tw-max-w-lg',
  xl: 'tw-max-w-2xl',
};

function DialogContent({ className, size = 'base', children, ...props }) {
  const { isOpen, setOpen } = useDialog();
  const overlayRef = useRef(null);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      data-kumo-component="Dialog"
      data-kumo-part="overlay"
      className={cn(
        'tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-start tw-justify-center tw-p-4 sm:tw-items-center',
        'tw-animate-[kumo-fade-in_0.15s_ease]',
      )}
      onClick={(e) => {
        if (e.target === overlayRef.current) setOpen(false);
      }}
    >
      {/* Backdrop */}
      <div
        data-kumo-part="backdrop"
        className="tw-fixed tw-inset-0 tw-bg-[var(--kumo-backdrop)] tw-animate-[kumo-fade-in_0.15s_ease]"
      />

      {/* Panel */}
      <div
        data-kumo-part="content"
        className={cn(
          'tw-relative tw-z-10 tw-w-full tw-overflow-hidden tw-rounded-xl',
          'tw-bg-[var(--kumo-panel-bg)] tw-text-[var(--kumo-default)]',
          'tw-border tw-border-[var(--kumo-line)]',
          'tw-shadow-[var(--kumo-shadow-dialog)]',
          'tw-animate-[kumo-scale-in_0.18s_ease]',
          DIALOG_SIZES[size],
          className
        )}
        {...props}
      >
        {/* Close button */}
        <button
          data-kumo-part="close-icon"
          onClick={() => setOpen(false)}
          className={cn(
            'tw-absolute tw-right-3 tw-top-3 tw-inline-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center',
            'tw-rounded-md tw-border-none tw-bg-transparent tw-text-[var(--kumo-muted)]',
            'tw-shadow-none tw-transition-colors hover:tw-bg-[var(--kumo-recessed)] hover:tw-text-[var(--kumo-default)]',
          )}
          aria-label="关闭"
        >
          <X className="tw-size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
DialogContent.displayName = 'Dialog.Content';

function DialogTitle({ className, ...props }) {
  return (
    <div data-kumo-part="title-wrapper" className="tw-px-6 tw-pt-6 tw-pb-2">
      <h2
        data-kumo-part="title"
        className={cn(
          'tw-text-lg tw-font-semibold tw-leading-tight tw-text-[var(--kumo-default)]',
          'tw-font-[var(--kumo-font-display)] tw-tracking-wide',
          className
        )}
        {...props}
      />
    </div>
  );
}
DialogTitle.displayName = 'Dialog.Title';

function DialogDescription({ className, ...props }) {
  return (
    <div data-kumo-part="description-wrapper" className="tw-px-6 tw-pb-2">
      <p
        data-kumo-part="description"
        className={cn('tw-text-sm tw-text-[var(--kumo-subtle)]', className)}
        {...props}
      />
    </div>
  );
}
DialogDescription.displayName = 'Dialog.Description';

function DialogBody({ className, ...props }) {
  return (
    <div
      data-kumo-part="body"
      className={cn('tw-px-6 tw-py-2', className)}
      {...props}
    />
  );
}
DialogBody.displayName = 'Dialog.Body';

function DialogFooter({ className, ...props }) {
  return (
    <div
      data-kumo-part="footer"
      className={cn(
        'tw-flex tw-items-center tw-justify-end tw-gap-3 tw-px-6 tw-pb-6 tw-pt-2',
        className
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = 'Dialog.Footer';

function DialogClose({ children, asChild, ...props }) {
  const { setOpen } = useDialog();

  if (asChild && children) {
    const child = Array.isArray(children) ? children[0] : children;
    if (child && child.type) {
      const ChildComponent = child.type;
      return (
        <ChildComponent
          {...child.props}
          onClick={(e) => {
            child.props.onClick?.(e);
            setOpen(false);
          }}
          {...props}
        />
      );
    }
  }

  return (
    <span
      data-kumo-part="close"
      onClick={() => setOpen(false)}
      className="tw-inline-flex tw-cursor-pointer"
      {...props}
    >
      {children}
    </span>
  );
}
DialogClose.displayName = 'Dialog.Close';

const Dialog = Object.assign(DialogContent, {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Body: DialogBody,
  Footer: DialogFooter,
  Close: DialogClose,
});

export {
  Dialog,
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
};
