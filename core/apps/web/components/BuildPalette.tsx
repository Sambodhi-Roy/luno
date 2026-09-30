"use client";

import { Armchair, ChevronDown, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Element } from "@/lib/types";
import { Button, Skeleton } from "./ui";

/**
 * The editor's furniture catalogue. A side panel on wide screens and a sheet along the bottom on phones;
 * either can be collapsed to see more of the map.
 */
export function BuildPalette({
  elements,
  error,
  onRetry,
  selectedId,
  onSelect,
}: {
  elements: Element[] | null;
  error: string | null;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (element: Element | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className="float-panel flex max-h-full w-full flex-col overflow-hidden md:w-72">
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-hover"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
          <Armchair className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Furniture</span>
          <span className="block truncate text-xs text-copy-lighter">
            {elements ? `${elements.length} pieces · pick one, then click the map` : "Pick one, then click the map"}
          </span>
        </span>
        <ChevronDown className={`size-4 text-copy-lighter transition-transform ${collapsed ? "" : "rotate-180"}`} />
      </button>

      {!collapsed && (
        <div className="overflow-y-auto border-t border-border p-3">
          {error ? (
            <div className="flex flex-col items-center gap-3 p-4 text-center text-sm text-copy-lighter">
              {error}
              <Button variant="subtle" onClick={onRetry} className="btn-sm">
                <RefreshCw className="size-3.5" />
                Try again
              </Button>
            </div>
          ) : elements?.length === 0 ? (
            <p className="p-4 text-center text-sm text-copy-lighter">
              There&apos;s no furniture to place yet. An admin can add some.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 md:grid-cols-3">
              {elements === null && [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
              {elements?.map((element) => (
                <button
                  key={element.id}
                  onClick={() => onSelect(selectedId === element.id ? null : element)}
                  aria-pressed={selectedId === element.id}
                  className="option-tile flex aspect-square flex-col items-center justify-center gap-1 p-1.5"
                  title={`${element.width}×${element.height} tiles${element.static ? ", solid" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- pixel-art sprite served from /public */}
                  <img src={element.imageUrl} alt="" className="pixelated size-10 object-contain" />
                  <span className="text-xs text-copy-lighter tabular-nums">
                    {element.width}×{element.height}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
