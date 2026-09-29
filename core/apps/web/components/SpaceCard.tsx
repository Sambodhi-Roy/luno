import Link from "next/link";
import type { ReactNode } from "react";
import type { SpaceSummary } from "@/lib/types";

/** Dashboard card for a space: thumbnail, name, a detail line, and an optional ⋯ menu next to Enter. */
export function SpaceCard({
  space,
  detail,
  menu,
}: {
  space: SpaceSummary;
  detail: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <div className="card">
      <Link href={`/space/${space.id}`} className="block aspect-video overflow-hidden rounded-t-2xl bg-background">
        {space.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- pixel-art thumbnail served from /public
          <img src={space.thumbnail} alt="" className="pixelated h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-copy-lighter">Empty space</div>
        )}
      </Link>
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{space.name}</p>
            <span className="shrink-0 rounded-md border border-border px-1.5 text-xs text-copy-lighter">
              {space.visibility}
            </span>
          </div>
          <p className="truncate text-xs text-copy-lighter">{detail}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {menu}
          <Link href={`/space/${space.id}`} className="btn-primary px-3">
            Enter
          </Link>
        </div>
      </div>
    </div>
  );
}
