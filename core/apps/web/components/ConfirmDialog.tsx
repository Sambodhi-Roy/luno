"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { friendlyError } from "@/lib/api";
import { Button, ErrorText, Modal } from "./ui";

type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  // Runs while the dialog shows a busy button; if it throws, the error is shown and the dialog stays open
  onConfirm: () => Promise<void>;
};

/**
 * Confirmation dialog, used instead of the browser's confirm(). Render `dialog` somewhere in the page and call
 * `confirm({...})`; it resolves true once onConfirm has succeeded, or false if the user cancelled.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setError(null);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    setOptions(null);
    setBusy(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  async function run() {
    if (!options) return;
    setBusy(true);
    setError(null);
    try {
      await options.onConfirm();
      finish(true);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  const dialog = options && (
    <Modal
      title={options.title}
      onClose={() => finish(false)}
      busy={busy}
      footer={
        <>
          <Button variant="subtle" onClick={() => finish(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={options.danger ? "danger" : "primary"} onClick={run} busy={busy}>
            {options.confirmLabel}
          </Button>
        </>
      }
    >
      {options.body && <div className="text-sm text-copy-light">{options.body}</div>}
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  );

  return { confirm, dialog };
}
