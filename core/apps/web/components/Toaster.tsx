"use client";

import { Toaster as Sonner } from "sonner";

/**
 * App-wide toasts. Show one with `toast(...)`, `toast.success(...)` or `toast.error(...)` from "sonner",
 * rather than building a notice by hand. Unstyled so they use our tokens instead of sonner's own theme.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "float-panel flex w-full items-center gap-3 px-4 py-3 text-sm text-copy sm:w-96",
          title: "font-medium",
          description: "text-copy-lighter",
          icon: "shrink-0",
          success: "toast-success",
          error: "toast-error",
          actionButton: "btn-subtle btn-sm ml-auto",
          cancelButton: "btn-ghost btn-sm",
        },
      }}
    />
  );
}
