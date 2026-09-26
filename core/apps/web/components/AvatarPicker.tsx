"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Avatar } from "@/lib/types";
import { AvatarSprite } from "./AvatarSprite";
import { Button, ErrorText, Modal } from "./ui";

export function AvatarPicker({
  currentId,
  onClose,
  onSaved,
}: {
  currentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [avatars, setAvatars] = useState<Avatar[] | null>(null);
  const [selected, setSelected] = useState(currentId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ avatars: Avatar[] }>("/user/avatars")
      .then((res) => setAvatars(res.avatars))
      .catch((e) => setError(e.message));
  }, []);

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api("/user/metadata", { method: "POST", body: { avatarId: selected } });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save avatar");
      setSaving(false);
    }
  }

  return (
    <Modal title="Choose your avatar" onClose={onClose}>
      {avatars === null && !error && <p className="text-sm text-copy-lighter">Loading…</p>}
      {avatars?.length === 0 && <p className="text-sm text-copy-lighter">No avatars yet. Run the seed script.</p>}

      <div className="grid grid-cols-4 gap-3">
        {avatars?.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => setSelected(avatar.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 ${
              selected === avatar.id ? "border-primary bg-primary/10" : "hover-tint border-border"
            }`}
          >
            <AvatarSprite imageUrl={avatar.imageUrl} />
            <span className="text-xs">{avatar.name ?? "Unnamed"}</span>
          </button>
        ))}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!selected || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
