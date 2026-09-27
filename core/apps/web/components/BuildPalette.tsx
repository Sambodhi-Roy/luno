"use client";

import type { Element } from "@/lib/types";

export function BuildPalette({
  elements,
  selectedId,
  onSelect,
}: {
  elements: Element[] | null;
  selectedId: string | null;
  onSelect: (element: Element | null) => void;
}) {
  return (
    <aside className="card flex w-64 flex-col gap-3 overflow-y-auto p-4">
      <div>
        <h2 className="font-semibold">Build</h2>
        <p className="text-xs text-copy-lighter">Click to place · Right-click furniture to remove · Esc to deselect</p>
      </div>

      {elements === null && <p className="text-sm text-copy-lighter">Loading furniture…</p>}
      {elements?.length === 0 && <p className="text-sm text-copy-lighter">No furniture yet. Add some in Admin.</p>}

      <div className="grid grid-cols-2 gap-2">
        {elements?.map((element) => (
          <button
            key={element.id}
            onClick={() => onSelect(selectedId === element.id ? null : element)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 ${
              selectedId === element.id ? "border-primary bg-primary/10" : "hover-tint border-border"
            }`}
            title={`${element.width}×${element.height} tiles${element.static ? ", solid" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- pixel-art sprite served from /public */}
            <img src={element.imageUrl} alt="" className="pixelated size-12 object-contain" />
            <span className="text-xs text-copy-lighter">
              {element.width}×{element.height}
              {element.static ? " · solid" : ""}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
