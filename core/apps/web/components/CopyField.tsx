"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "./ui";

// How long the button says "Copied" before going back to "Copy"
const COPIED_MS = 2000;

/** Copies text to the clipboard, falling back to a hint to copy it by hand when the browser refuses. */
export async function copyText(text: string, successMessage = "Link copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error("Couldn't copy automatically. Select the link and copy it by hand.");
    return false;
  }
}

/** Read-only field with a Copy button, for invite links. */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex gap-2">
      <Input value={value} readOnly onFocus={(e) => e.target.select()} className="font-mono text-xs" aria-label="Invite link" />
      <button
        type="button"
        className="btn-subtle shrink-0"
        onClick={() => copyText(value).then((ok) => ok && setCopied(true))}
      >
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
