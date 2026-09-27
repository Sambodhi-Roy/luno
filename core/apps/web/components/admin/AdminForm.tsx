"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../ui";

type Result = { ok: boolean; text: string } | null;

/**
 * Card with a title and a form that shows a busy state and a success/error line.
 * `onSubmit` returns the success message, or throws with the error to show.
 */
export function AdminForm({
  title,
  description,
  submitLabel,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: (form: HTMLFormElement) => Promise<string>;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setResult(null);
    try {
      setResult({ ok: true, text: await onSubmit(form) });
      form.reset();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="card flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-copy-lighter">{description}</p>
      </div>
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Uploading…" : submitLabel}
        </Button>
        {result && <p className={`text-sm ${result.ok ? "text-success" : "text-error"}`}>{result.text}</p>}
      </div>
    </form>
  );
}

/** Reads a required file input by name, or throws a readable error. */
export function fileFrom(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) throw new Error(`Choose a file for "${name}"`);
  return file;
}

export function filesFrom(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  return [...(input?.files ?? [])];
}

export function valueFrom(form: HTMLFormElement, name: string) {
  return (form.elements.namedItem(name) as HTMLInputElement).value.trim();
}
