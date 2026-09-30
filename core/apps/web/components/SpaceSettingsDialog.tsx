"use client";

import { RotateCcw } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, friendlyError } from "@/lib/api";
import { inviteUrl } from "@/lib/navigation";
import type { OwnedSpaceSummary, Visibility } from "@/lib/types";
import { useConfirm } from "./ConfirmDialog";
import { CopyField } from "./CopyField";
import { Button, ErrorText, Hint, Input, Label, Modal } from "./ui";
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
  const formId = useId();
  const [name, setName] = useState(space.name);
  const [visibility, setVisibility] = useState<Visibility>(space.visibility);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirm();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/space/${space.id}`, { method: "PATCH", body: { name, visibility } });
      onChanged({ name, visibility });
      toast.success("Settings saved");
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Could not save your changes"));
      setSaving(false);
    }
  }

  function resetLink() {
    void confirm({
      title: "Reset the invite link?",
      body: "The current link stops working straight away. People who already joined keep their access.",
      confirmLabel: "Reset link",
      danger: true,
      onConfirm: async () => {
        const res = await api<{ inviteCode: string }>(`/space/${space.id}/invite/reset`, { method: "POST" });
        onChanged({ inviteCode: res.inviteCode });
        toast.success("New invite link created");
      },
    });
  }

  if (dialog) return dialog;

  return (
    <Modal
      title="Space settings"
      description={space.name}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button type="button" variant="subtle" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} busy={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={30} required />
        </label>

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <div className="border-t border-border pt-5">
          <Label>Invite link</Label>
          <CopyField value={inviteUrl(space.inviteCode)} />
          <div className="mt-2 flex items-center justify-between gap-3">
            <Hint>Anyone with this link can join, even when the space is private.</Hint>
            <Button type="button" variant="ghost" onClick={resetLink} className="btn-sm shrink-0">
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}
