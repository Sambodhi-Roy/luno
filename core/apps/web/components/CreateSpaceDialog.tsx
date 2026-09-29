"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { MapSummary, Visibility } from "@/lib/types";
import { Button, ErrorText, Input, Label, Modal } from "./ui";
import { VisibilityPicker } from "./VisibilityPicker";

export function CreateSpaceDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (spaceId: string) => void;
}) {
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
      .catch((e) => setError(e.message));
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
      setError(e instanceof Error ? e.message : "Could not create space");
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Create a space" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
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
        </label>

        <div>
          <Label>Map</Label>
          {maps === null && !error && <p className="text-sm text-copy-lighter">Loading maps…</p>}
          {maps?.length === 0 && <p className="text-sm text-copy-lighter">No maps yet. Run the seed script.</p>}
          <div className="grid grid-cols-2 gap-3">
            {maps?.map((map) => (
              <button
                type="button"
                key={map.id}
                onClick={() => setMapId(map.id)}
                aria-pressed={mapId === map.id}
                className="option-tile overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pixel-art thumbnail served from /public */}
                <img src={map.thumbnail} alt="" className="pixelated aspect-video w-full object-cover" />
                <div className="p-2">
                  <p className="text-sm font-medium">{map.name}</p>
                  <p className="text-xs text-copy-lighter">{map.dimensions} tiles</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <ErrorText>{error}</ErrorText>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!mapId || submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
