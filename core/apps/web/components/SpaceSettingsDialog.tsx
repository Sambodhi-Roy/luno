"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { inviteUrl } from "@/lib/navigation";
import type { OwnedSpaceSummary, Visibility } from "@/lib/types";
import { Button, ErrorText, Input, Label, Modal } from "./ui";
import { VisibilityPicker } from "./VisibilityPicker";

type SpaceChanges = Partial<Pick<OwnedSpaceSummary, "name" | "visibility" | "inviteCode">>;

/** Owner settings for a space: rename, public/private, and the invite link. */
export function SpaceSettingsDialog({
  space,
  onClose,
  onChanged,
}: {
  space: OwnedSpaceSummary;
  onClose: () => void;
  onChanged: (changes: SpaceChanges) => void;
}) {
  const [name, setName] = useState(space.name);
  const [visibility, setVisibility] = useState<Visibility>(space.visibility);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = inviteUrl(space.inviteCode);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/space/${space.id}`, { method: "PATCH", body: { name, visibility } });
      onChanged({ name, visibility });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  async function resetLink() {
    if (!confirm("Reset the invite link? The current link stops working. People who already joined keep access.")) {
      return;
    }
    try {
      const res = await api<{ inviteCode: string }>(`/space/${space.id}/invite/reset`, { method: "POST" });
      onChanged({ inviteCode: res.inviteCode });
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset the link");
    }
  }

  return (
    <Modal title="Space settings" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={30} required />
        </label>

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <div>
          <Label>Invite link</Label>
          <div className="flex gap-2">
            <Input value={link} readOnly onFocus={(e) => e.target.select()} />
            <Button type="button" variant="ghost" onClick={copyLink} className="shrink-0">
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <button type="button" onClick={resetLink} className="mt-1 text-xs text-copy-lighter hover:text-copy">
            Reset link
          </button>
        </div>

        <ErrorText>{error}</ErrorText>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
