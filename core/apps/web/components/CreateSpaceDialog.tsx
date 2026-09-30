"use client";

import { Map as MapIcon, PencilRuler } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { CUSTOM_MAP_SIZES, type CustomMapSize } from "@repo/protocol/rules";
import { api, friendlyError } from "@/lib/api";
import { spaceSize } from "@/lib/format";
import type { MapSummary, Visibility } from "@/lib/types";
import { Button, ErrorText, Hint, Input, Label, Modal, Skeleton } from "./ui";
import { VisibilityPicker } from "./VisibilityPicker";

// The map choice for building one in the editor instead of starting from a premade map
const CUSTOM = "custom";

export function CreateSpaceDialog({
  isAdmin,
  onClose,
  onCreated,
}: {
  isAdmin: boolean;
  onClose: () => void;
  // Where to go next: the space itself, or the editor for a custom map
  onCreated: (path: string) => void;
}) {
  const formId = useId();
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  // A premade map's id, or CUSTOM to build one in the editor
  const [mapId, setMapId] = useState<string | null>(null);
  const [size, setSize] = useState<CustomMapSize>("medium");
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
      // A premade map gives the space its size and default furniture; a custom one starts as an empty room
      const custom = mapId === CUSTOM;
      const body = custom ? { name, layout: "custom", size, visibility } : { name, mapId, visibility };
      const res = await api<{ spaceId: string }>("/space", { method: "POST", body });
      onCreated(custom ? `/space/${res.spaceId}/edit` : `/space/${res.spaceId}`);
    } catch (e) {
      setError(friendlyError(e, "Could not create the space"));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Create a space"
      description="Start from a ready-made map, or build your own. You can move the furniture around later."
      onClose={onClose}
      busy={submitting}
      size="lg"
      footer={
        <>
          <Button type="button" variant="subtle" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!mapId} busy={submitting}>
            {mapId === CUSTOM ? "Create and build" : "Create space"}
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
            <button
              type="button"
              onClick={() => setMapId(CUSTOM)}
              aria-pressed={mapId === CUSTOM}
              className="option-tile overflow-hidden"
            >
              <div className="thumb-fallback flex aspect-video w-full items-center justify-center text-primary-light">
                <PencilRuler className="size-8" />
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-semibold">Custom map</p>
                <p className="text-xs text-copy-lighter">Build your own</p>
              </div>
            </button>
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

        {mapId === CUSTOM && (
          <div>
            <Label>Size</Label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(CUSTOM_MAP_SIZES) as CustomMapSize[]).map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSize(key)}
                  aria-pressed={size === key}
                  className="option-tile p-2.5"
                >
                  <p className="text-sm font-semibold capitalize">{key}</p>
                  <p className="text-xs text-copy-lighter tabular-nums">
                    {CUSTOM_MAP_SIZES[key].width}×{CUSTOM_MAP_SIZES[key].height} tiles
                  </p>
                </button>
              ))}
            </div>
            <Hint>You&apos;ll go straight to the editor to paint floors and walls and add furniture.</Hint>
          </div>
        )}

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}
