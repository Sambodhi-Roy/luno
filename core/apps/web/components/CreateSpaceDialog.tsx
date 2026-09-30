"use client";

import { Map as MapIcon } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { api, friendlyError } from "@/lib/api";
import { spaceSize } from "@/lib/format";
import type { MapSummary, Visibility } from "@/lib/types";
import { Button, ErrorText, Hint, Input, Label, Modal, Skeleton } from "./ui";
import { VisibilityPicker } from "./VisibilityPicker";

export function CreateSpaceDialog({
  isAdmin,
  onClose,
  onCreated,
}: {
  isAdmin: boolean;
  onClose: () => void;
  onCreated: (spaceId: string) => void;
}) {
  const formId = useId();
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("Private");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ maps: MapSummary[] }>("/maps")
      .then((res) => {
        setMaps(res.maps);
        setMapId(res.maps[0]?.id ?? null);
      })
      .catch((e) => setError(friendlyError(e)));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mapId) return;
    setSubmitting(true);
    setError(null);
    try {
      // The space takes its size and default furniture from the chosen map
      const res = await api<{ spaceId: string }>("/space", { method: "POST", body: { name, mapId, visibility } });
      onCreated(res.spaceId);
    } catch (e) {
      setError(friendlyError(e, "Could not create the space"));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Create a space"
      description="Pick a map to start from. You can move the furniture around later."
      onClose={onClose}
      busy={submitting}
      size="lg"
      footer={
        <>
          <Button type="button" variant="subtle" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!mapId} busy={submitting}>
            Create space
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={30}
            placeholder="Team HQ"
            required
            autoFocus
          />
          <Hint>3 to 30 characters. You can rename it later.</Hint>
        </label>

        <div>
          <Label>Map</Label>
          {maps?.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-copy-lighter">
              <MapIcon className="size-5 shrink-0" />
              {isAdmin
                ? "There are no maps yet. Upload one from the Admin page first."
                : "There are no maps to choose from yet. Ask an admin to add one."}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {maps === null &&
              !error &&
              [0, 1, 2].map((i) => <Skeleton key={i} className="aspect-4/3 rounded-xl" />)}
            {maps?.map((map) => (
              <button
                type="button"
                key={map.id}
                onClick={() => setMapId(map.id)}
                aria-pressed={mapId === map.id}
                className="option-tile overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pixel-art thumbnail served from /public */}
                <img src={map.thumbnail} alt="" className="pixelated thumb-fallback aspect-video w-full object-cover" />
                <div className="p-2.5">
                  <p className="truncate text-sm font-semibold">{map.name}</p>
                  <p className="text-xs text-copy-lighter">{spaceSize(map.dimensions)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}
