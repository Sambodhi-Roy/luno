"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpaceElement } from "@repo/protocol";
import { BuildPalette } from "@/components/BuildPalette";
import { GameCanvas } from "@/components/GameCanvas";
import type { GameController, GameOptions } from "@/game";
import { api, ApiError } from "@/lib/api";
import type { Element, SpaceDetail } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// How long an error stays on screen
const NOTICE_MS = 3000;

/**
 * The owner's furniture editor. It shows the map with no avatar and no connection, so editing doesn't make the
 * owner appear online. Changes are saved through the API, which pushes them live to anyone in the space.
 */
export default function EditSpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const router = useRouter();
  const { me } = useMe();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameController | null>(null);
  const [catalogue, setCatalogue] = useState<Element[] | null>(null);
  const [tool, setTool] = useState<Element | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<SpaceDetail>(`/space/${spaceId}`)
      .then((loaded) => {
        // Only the owner edits; anyone else just goes into the space
        if (loaded.creatorId !== me.id) router.replace(`/space/${spaceId}`);
        else setSpace(loaded);
      })
      .catch((e) =>
        setError(e instanceof ApiError && e.status === 404 ? "This space doesn't exist." : e.message)
      );
  }, [me, spaceId, router]);

  useEffect(() => {
    if (!space) return;
    api<{ elements: Element[] }>("/space/elements")
      .then((res) => setCatalogue(res.elements))
      .catch((e) => setNotice(e.message));
  }, [space]);

  useEffect(() => {
    game?.setBuildTool(tool);
  }, [game, tool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTool(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const onPlace = useCallback(
    async (elementId: string, x: number, y: number) => {
      try {
        const res = await api<{ element: SpaceElement }>("/space/element", {
          method: "POST",
          body: { spaceId, elementId, x, y },
        });
        return res.element;
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Could not place that here");
        return null;
      }
    },
    [spaceId]
  );

  const onRemove = useCallback(async (id: string) => {
    try {
      await api("/space/element", { method: "DELETE", body: { id } });
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not remove that");
      return false;
    }
  }, []);

  const options = useMemo<GameOptions | null>(
    () => (space && me ? { mode: "edit", space, me, onPlace, onRemove } : null),
    [space, me, onPlace, onRemove]
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      {options && <GameCanvas options={options} onReady={setGame} />}

      {!space && (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-copy-lighter">
          {error ?? "Loading editor…"}
          {error && (
            <Link href="/dashboard" className="text-primary hover:underline">
              Back to dashboard
            </Link>
          )}
        </div>
      )}

      <div className="absolute top-4 left-4 flex items-center gap-3">
        <Link href="/dashboard" className="btn-ghost bg-foreground px-3">
          ← Dashboard
        </Link>
        {space && (
          <>
            <span className="chip">Editing {space.name}</span>
            <Link href={`/space/${spaceId}`} className="btn-primary px-3">
              Open space
            </Link>
          </>
        )}
      </div>

      {space && (
        <>
          <div className="absolute top-4 right-4 bottom-4 flex">
            <BuildPalette elements={catalogue} selectedId={tool?.id ?? null} onSelect={setTool} />
          </div>
          <div className="absolute bottom-4 left-4">
            <span className="chip text-copy-lighter">Scroll to zoom · WASD, arrows or middle-drag to pan</span>
          </div>
        </>
      )}

      {notice && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <span className="chip text-error">
            <span className="status-dot bg-error" />
            {notice}
          </span>
        </div>
      )}
    </main>
  );
}
