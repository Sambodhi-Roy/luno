"use client";

import { Ellipsis, LoaderCircle, X, type LucideIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Logo } from "./Logo";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "subtle" | "ghost" | "danger";
  // Shows a spinner and disables the button
  busy?: boolean;
};

// Button styles are the btn-* utilities in app/globals.css (also used by links styled as buttons)
const variants = {
  primary: "btn-primary",
  subtle: "btn-subtle",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export function Button({ variant = "primary", busy = false, className = "", disabled, children, ...props }: ButtonProps) {
  return (
    <button className={`${variants[variant]} ${className}`} disabled={disabled || busy} {...props}>
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button aria-label={label} title={label} className={`btn-icon ${className}`} {...props}>
      <Icon className="size-4.5" />
    </button>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <LoaderCircle aria-hidden className={`animate-spin ${className}`} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`} {...props} />;
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold text-copy-light">{children}</span>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <span className="mt-1.5 block text-xs text-copy-lighter">{children}</span>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-error">
      {children}
    </p>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Friendly placeholder for a list with nothing in it, with an optional call to action. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary-light">
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-copy-lighter">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Whole-screen message for loading, errors and "you can't be here". With no title it's a loading screen.
 */
export function FullPageState({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="bg-dots flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      {title ? (
        <div className="card flex max-w-md flex-col items-center p-8">
          {Icon && (
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary-light">
              <Icon className="size-6" />
            </div>
          )}
          <h1 className="text-xl font-semibold">{title}</h1>
          {children && <div className="mt-2 text-sm text-copy-lighter">{children}</div>}
          {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-copy-lighter">
          <Spinner />
          {children ?? "Loading…"}
        </div>
      )}
    </main>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Dialog with a title, a close button and an optional footer for its actions. Escape or a click outside
 * closes it unless `busy` (e.g. while saving). Focus moves into it and back to where it was on close.
 */
export function Modal({
  title,
  description,
  onClose,
  busy = false,
  footer,
  size = "md",
  children,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  footer?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Kept in a ref so the effect below runs once, not on every parent render
  const close = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    close.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    // Focus the first field (or button) unless something inside already asked for it with autoFocus
    if (node && !node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>("input, textarea, select") ?? node.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) {
        e.stopPropagation();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  // Keep Tab inside the dialog
  function trapFocus(e: KeyboardEvent) {
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        className={`dialog-frame ${size === "lg" ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-copy-lighter">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} disabled={busy} className="-mt-1 -mr-2" />
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-foreground px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** A ⋯ button that opens a dropdown of actions. Closes on an outside click, Escape, or picking an item. */
export function Menu({ label, children, trigger }: { label: string; children: ReactNode; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Up / down arrows move between items
  function onListKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          // Menus sit on clickable cards; don't let opening one also activate the card
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={trigger ? "rounded-full" : "btn-icon"}
        aria-label={label}
        title={trigger ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger ?? <Ellipsis className="size-4.5" />}
      </button>
      {open && (
        <div
          ref={list}
          role="menu"
          className="menu"
          onKeyDown={onListKey}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  danger = false,
  icon: Icon,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; icon?: LucideIcon }) {
  return (
    <button role="menuitem" className={`menu-item ${danger ? "text-error" : ""} ${className}`} {...props}>
      {Icon && <Icon className={`size-4 ${danger ? "" : "text-copy-lighter"}`} />}
      {children}
    </button>
  );
}

/**
 * A panel that opens under (or, with `placement="top"`, above) its trigger. Closes on an outside click or
 * Escape. `trigger` receives the open state and a toggle so it can render any button.
 */
export function Popover({
  trigger,
  children,
  placement = "bottom",
  align = "right",
  className = "",
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: ReactNode;
  placement?: "top" | "bottom";
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const position = `${placement === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${align === "right" ? "right-0" : "left-0"}`;

  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      {open && <div className={`float-panel absolute z-30 w-80 max-w-screen p-4 ${position} ${className}`}>{children}</div>}
    </div>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
