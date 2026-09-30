"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Armchair, ArrowLeft, Paintbrush, Play, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { SpaceElement } from "@repo/protocol";
import type { CustomMap } from "@repo/protocol/rules";
import { BuildPalette } from "@/components/BuildPalette";
import { GameCanvas } from "@/components/GameCanvas";
import { MapBrushPalette } from "@/components/MapBrushPalette";
import { DashboardLink, MeFallback } from "@/components/PageStates";
import { JoinOverlay } from "@/components/space/Hud";
import { FullPageState, Spinner } from "@/components/ui";
import type { GameController, GameOptions } from "@/game";
import { api, ApiError, friendlyError, upload } from "@/lib/api";
import { fetchBuilder, type Builder, type PaintTool } from "@/lib/builder";
import type { Element, SpaceDetail } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// A custom map's cover image is re-rendered this long after the last change
const THUMBNAIL_DELAY_MS = 3000;

/**
 * The owner's editor. It shows the map with no avatar and no connection, so editing doesn't make the owner
 * appear online. Furniture can be placed in any space; a custom map also has floors and walls to paint, and its
 * cover image is rendered from the map. Changes are saved through the API, which pushes them live to anyone in
 * the space.
 */
export default function EditSpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const router = useRouter();
  const { me, status, error: meError, retry } = useMe();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameController | null>(null);
  const [catalogue, setCatalogue] = useState<Element[] | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueVersion, setCatalogueVersion] = useState(0);
  const [tool, setTool] = useState<Element | null>(null);
  // Custom maps: the floor/wall palette, the chosen brush, and which panel is showing
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [builderVersion, setBuilderVersion] = useState(0);
  const [paintTool, setPaintTool] = useState<PaintTool | null>(null);
  const [panel, setPanel] = useState<"build" | "furniture">("build");
  // Bumped by every saved change; a custom map's cover is re-rendered once they stop
  const [changes, setChanges] = useState(0);
  const custom = !!space?.customMap;
  const [progress, setProgress] = useState(0);
  // Saves in flight, for the "Saving…" indicator
  const [saving, setSaving] = useState(0);

  useEffect(() => {
    if (!me) return;
    api<SpaceDetail>(`/space/${spaceId}`)
      .then((loaded) => {
        // Only the owner edits; anyone else just goes into the space
        if (loaded.creatorId !== me.id) {
          toast("Only the owner can edit this space, so you've been taken inside instead.");
          router.replace(`/space/${spaceId}`);
        } else {
          setSpace(loaded);
          document.title = `Editing ${loaded.name} · Luno`;
        }
      })
      .catch((e) =>
        setError(e instanceof ApiError && e.status === 404 ? "It may have been deleted, or the link is wrong." : friendlyError(e))
      );
  }, [me, spaceId, router]);

  useEffect(() => {
    if (!space) return;
    api<{ elements: Element[] }>("/space/elements").then(
      (res) => {
        setCatalogue(res.elements);
        setCatalogueError(null);
      },
      (e) => setCatalogueError(friendlyError(e, "Couldn't load the furniture"))
    );
  }, [space, catalogueVersion]);

  useEffect(() => {
    if (!custom) return;
    fetchBuilder().then(
      (loaded) => {
        setBuilder(loaded);
        setBuilderError(null);
      },
      (e) => setBuilderError(friendlyError(e, "Couldn't load the floors and walls"))
    );
  }, [custom, builderVersion]);

  useEffect(() => {
    game?.setBuildTool(tool);
  }, [game, tool]);

  useEffect(() => {
    game?.setPaintTool(paintTool);
  }, [game, paintTool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTool(null);
        setPaintTool(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A custom map's cover is rendered from the map itself, a little after the last change (and once on opening,
  // so a new map gets one). Best effort: the changes themselves are already saved.
  useEffect(() => {
    if (!custom || !game) return;
    const timer = window.setTimeout(async () => {
      const blob = await game.captureThumbnail();
      if (!blob) return;
      const form = new FormData();
      form.append("file", blob, "cover.png");
      await upload(`/space/${spaceId}/thumbnail`, form, "PUT").catch(() => {});
    }, THUMBNAIL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [custom, game, changes, spaceId]);

  // The game hands over the map once the brush has rested, so each save is a whole stroke
  const onMapChange = useCallback(
    async (map: CustomMap) => {
      setSaving((n) => n + 1);
      try {
        await api(`/space/${spaceId}/custom-map`, { method: "PUT", body: map });
        setChanges((n) => n + 1);
      } catch (e) {
        toast.error(friendlyError(e, "Couldn't save the map"));
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [spaceId]
  );

  const place = useCallback(
    async (elementId: string, x: number, y: number) => {
      setSaving((n) => n + 1);
      try {
        const res = await api<{ element: SpaceElement }>("/space/element", {
          method: "POST",
          body: { spaceId, elementId, x, y },
        });
        setChanges((n) => n + 1);
        return res.element;
      } catch (e) {
        toast.error(friendlyError(e, "Couldn't place that there"));
        return null;
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [spaceId]
  );

  const onRemove = useCallback(async (placement: SpaceElement, undo: () => void) => {
    setSaving((n) => n + 1);
    try {
      await api("/space/element", { method: "DELETE", body: { id: placement.id } });
      toast("Furniture removed", { action: { label: "Undo", onClick: undo } });
      setChanges((n) => n + 1);
      return true;
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't remove that"));
      return false;
    } finally {
      setSaving((n) => n - 1);
    }
  }, []);

  // Furniture and brushes are one tool at a time
  const selectFurniture = useCallback((element: Element | null) => {
    setTool(element);
    if (element) setPaintTool(null);
  }, []);
  const selectBrush = useCallback((brush: PaintTool | null) => {
    setPaintTool(brush);
    if (brush) setTool(null);
  }, []);
  const switchPanel = (next: "build" | "furniture") => {
    setPanel(next);
    setTool(null);
    setPaintTool(null);
  };

  const options = useMemo<GameOptions | null>(
    () =>
      space && me
        ? { mode: "edit", space, me, onPlace: place, onRemove, onMapChange, onLoadProgress: setProgress }
        : null,
    // Only the user's id matters here; a new `me` object (e.g. after a refresh) shouldn't recreate the editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [space, me?.id, place, onRemove, onMapChange]
  );

  if (!me) return <MeFallback status={status} error={meError} retry={retry} />;

  if (error) {
    return (
      <FullPageState icon={SearchX} title="Couldn't open the editor" actions={<DashboardLink />}>
        {error}
      </FullPageState>
    );
  }

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-background">
      {options && <GameCanvas options={options} onReady={setGame} />}

      {(!space || progress < 1) && (
        <JoinOverlay title={space ? `Editing ${space.name}` : "Opening the editor"} progress={progress} />
      )}

      {space && progress >= 1 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:justify-between">
          <div className="flex flex-col justify-between gap-3">
            <div className="pointer-events-auto flex items-center gap-2">
              <Link href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard" className="hud-button">
                <ArrowLeft className="size-4.5" />
              </Link>
              <div className="float-panel flex min-w-0 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4">
                <span className="truncate text-sm">
                  <span className="text-copy-lighter">Editing </span>
                  <span className="font-semibold">{space.name}</span>
                </span>
                {saving > 0 && (
                  <span className="badge shrink-0">
                    <Spinner className="size-3" />
                    Saving
                  </span>
                )}
                <Link href={`/space/${spaceId}`} className="btn-primary btn-sm shrink-0">
                  <Play className="size-3.5" />
                  Open space
                </Link>
              </div>
            </div>

            <div className="float-panel pointer-events-auto hidden flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-2.5 text-xs text-copy-lighter md:flex">
              {paintTool ? (
                <>
                  <Hint keys={["Drag"]}>paint</Hint>
                  <Hint keys={["Right-drag"]}>erase</Hint>
                </>
              ) : (
                <>
                  <Hint keys={["Click"]}>place</Hint>
                  <Hint keys={["Right-click"]}>remove</Hint>
                </>
              )}
              <Hint keys={["Esc"]}>deselect</Hint>
              <Hint keys={["Scroll"]}>zoom</Hint>
              <Hint keys={["W", "A", "S", "D"]}>pan</Hint>
            </div>
          </div>

          <div className="pointer-events-auto mt-auto flex max-h-1/2 flex-col gap-2 md:mt-0 md:max-h-full md:w-72">
            {custom && (
              <div role="tablist" aria-label="Editor tools" className="float-panel flex gap-5 px-4 pt-2">
                <button role="tab" aria-selected={panel === "build"} onClick={() => switchPanel("build")} className="tab">
                  <Paintbrush className="size-4" />
                  Build
                </button>
                <button
                  role="tab"
                  aria-selected={panel === "furniture"}
                  onClick={() => switchPanel("furniture")}
                  className="tab"
                >
                  <Armchair className="size-4" />
                  Furniture
                </button>
              </div>
            )}
            {custom && panel === "build" ? (
              <MapBrushPalette
                builder={builder}
                error={builderError}
                onRetry={() => {
                  setBuilderError(null);
                  setBuilderVersion((v) => v + 1);
                }}
                tool={paintTool}
                onSelect={selectBrush}
                onFillFloor={(style) => game?.fillFloor(style)}
              />
            ) : (
              <BuildPalette
                elements={catalogue}
                error={catalogueError}
                onRetry={() => {
                  setCatalogueError(null);
                  setCatalogueVersion((v) => v + 1);
                }}
                selectedId={tool?.id ?? null}
                onSelect={selectFurniture}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Hint({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {keys.map((k) => (
          <kbd key={k} className="kbd">
            {k}
          </kbd>
        ))}
      </span>
      {children}
    </span>
  );
}
