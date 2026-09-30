"use client";

import { ImagePlus, type LucideIcon } from "lucide-react";
import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/api";
import { Button, ErrorText } from "../ui";

/**
 * Card with a title and a form with a busy state. `onSubmit` returns the success message (shown as a toast),
 * or throws with the error to show under the form.
 */
export function AdminForm({
  id,
  icon: Icon,
  title,
  description,
  submitLabel,
  onSubmit,
  children,
  aside,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  submitLabel: string;
  onSubmit: (form: HTMLFormElement) => Promise<string>;
  children: ReactNode;
  // Shown under the form, e.g. what already exists
  aside?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a successful submit so file previews clear along with the form
  const [resetKey, setResetKey] = useState(0);

  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError(null);
    try {
      toast.success(await onSubmit(form));
      form.reset();
      setResetKey((k) => k + 1);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id={id} className="card scroll-mt-24 p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-copy-lighter">{description}</p>
        </div>
      </div>
      <form key={resetKey} onSubmit={handle} className="flex flex-col gap-4">
        {children}
        <ErrorText>{error}</ErrorText>
        <div>
          <Button type="submit" busy={busy}>
            {busy ? "Uploading…" : submitLabel}
          </Button>
        </div>
      </form>
      {aside && <div className="mt-6 border-t border-border pt-5">{aside}</div>}
    </section>
  );
}

/** PNG file input that previews the chosen image next to it. */
export function ImageInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange">) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-raised text-copy-lighter">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
          <img src={preview} alt="" className="pixelated h-full w-full object-contain" />
        ) : (
          <ImagePlus className="size-5" />
        )}
      </div>
      <input
        {...props}
        type="file"
        accept="image/png"
        className="field"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
      />
    </div>
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
