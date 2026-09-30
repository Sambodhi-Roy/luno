"use client";

import { ChevronDown, Eraser, PaintBucket, Paintbrush, RefreshCw } from "lucide-react";
import { useState } from "react";
import { stylePreviewUrl, type Builder, type PaintTool } from "@/lib/builder";
import { Button, Skeleton } from "./ui";

/**
 * The custom map editor's brushes: floor styles, wall styles and an eraser. Walls draw their tops and fronts
 * by themselves, so a room only needs its outline painted. Laid out like the furniture panel beside it.
 */
export function MapBrushPalette({
  builder,
  error,
  onRetry,
  tool,
  onSelect,
  onFillFloor,
}: {
  builder: Builder | null;
  error: string | null;
  onRetry: () => void;
  tool: PaintTool | null;
  onSelect: (tool: PaintTool | null) => void;
  onFillFloor: (style: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isSelected = (kind: PaintTool["kind"], style?: number) =>
    tool?.kind === kind && (kind === "erase" || (tool.kind !== "erase" && tool.style === style));
  const toggle = (next: PaintTool) =>
    onSelect(isSelected(next.kind, next.kind === "erase" ? undefined : next.style) ? null : next);
  // Fill uses the chosen floor, or the first one when a wall or the eraser is chosen
  const fillStyle = tool?.kind === "floor" ? tool.style : (builder?.floors[0]?.id ?? 1);

  return (
    <aside className="float-panel flex max-h-full w-full flex-col overflow-hidden md:w-72">
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-hover"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
          <Paintbrush className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Floors & walls</span>
          <span className="block truncate text-xs text-copy-lighter">Drag to paint · right-drag to erase</span>
        </span>
        <ChevronDown className={`size-4 text-copy-lighter transition-transform ${collapsed ? "" : "rotate-180"}`} />
      </button>

      {!collapsed && (
        <div className="space-y-4 overflow-y-auto border-t border-border p-3">
          {error ? (
            <div className="flex flex-col items-center gap-3 p-4 text-center text-sm text-copy-lighter">
              {error}
              <Button variant="subtle" onClick={onRetry} className="btn-sm">
                <RefreshCw className="size-3.5" />
                Try again
              </Button>
            </div>
          ) : (
            <>
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="eyebrow">Floors</h3>
                  <Button
                    variant="subtle"
                    className="btn-sm"
                    disabled={!builder}
                    onClick={() => onFillFloor(fillStyle)}
                    title="Paint the whole map with the chosen floor"
                  >
                    <PaintBucket className="size-3.5" />
                    Fill all
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {builder === null && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
                  {builder?.floors.map((floor) => (
                    <button
                      key={floor.id}
                      onClick={() => toggle({ kind: "floor", style: floor.id })}
                      aria-pressed={isSelected("floor", floor.id)}
                      aria-label={floor.name}
                      title={floor.name}
                      className="option-tile flex aspect-square items-center justify-center p-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- pixel-art swatch served from /public */}
                      <img src={stylePreviewUrl("floor", floor.id)} alt="" className="pixelated size-8" />
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="eyebrow">Walls</h3>
                <p className="mb-2 text-xs text-copy-lighter">
                  The tile you click is the wall&apos;s top; its front fills the 2 tiles below.
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {builder === null && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                  {builder?.walls.map((wall) => (
                    <button
                      key={wall.id}
                      onClick={() => toggle({ kind: "wall", style: wall.id })}
                      aria-pressed={isSelected("wall", wall.id)}
                      aria-label={`${wall.name} wall`}
                      title={`${wall.name} wall`}
                      className="option-tile flex items-center justify-center p-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- pixel-art swatch served from /public */}
                      <img src={stylePreviewUrl("wall", wall.id)} alt="" className="pixelated h-8 w-4" />
                    </button>
                  ))}
                </div>
              </section>

              <button
                onClick={() => toggle({ kind: "erase" })}
                aria-pressed={isSelected("erase")}
                className="option-tile flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold"
              >
                <Eraser className="size-4" />
                Eraser
                <span className="ml-auto text-xs font-normal text-copy-lighter">walls first, then floor</span>
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
