"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, friendlyError } from "@/lib/api";
import type { Avatar } from "@/lib/types";
import { AvatarSprite } from "./AvatarSprite";
import { Button, ErrorText, Modal, Skeleton } from "./ui";

export function AvatarPicker({
  currentId,
  onClose,
  onSaved,
}: {
  currentId: string | null;
  onClose: () => void;
  onSaved: (avatar: Avatar) => void;
}) {
  const [avatars, setAvatars] = useState<Avatar[] | null>(null);
  const [selected, setSelected] = useState(currentId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ avatars: Avatar[] }>("/user/avatars")
      .then((res) => setAvatars(res.avatars))
      .catch((e) => setError(friendlyError(e)));
  }, []);

  async function save() {
    const avatar = avatars?.find((a) => a.id === selected);
    if (!avatar) return;
    if (avatar.id === currentId) return onClose();
    setSaving(true);
    try {
      await api("/user/metadata", { method: "POST", body: { avatarId: avatar.id } });
      toast.success(`You're now ${avatar.name ?? "a new character"}`);
      onSaved(avatar);
    } catch (e) {
      setError(friendlyError(e, "Could not save your avatar"));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Choose your avatar"
      description="This is how other people see you in every space."
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!selected} busy={saving}>
            Save
          </Button>
        </>
      }
    >
      {avatars?.length === 0 && (
        <p className="text-sm text-copy-lighter">There are no avatars to choose from yet. Ask an admin to add some.</p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {avatars === null && !error && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        {avatars?.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => setSelected(avatar.id)}
            aria-pressed={selected === avatar.id}
            className="option-tile flex flex-col items-center gap-2 p-3"
          >
            {/* The chosen one walks, like a preview of it in the space */}
            <AvatarSprite imageUrl={avatar.imageUrl} walking={selected === avatar.id} />
            <span className="w-full truncate text-center text-xs font-semibold">{avatar.name ?? "Unnamed"}</span>
          </button>
        ))}
      </div>

      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  );
}
