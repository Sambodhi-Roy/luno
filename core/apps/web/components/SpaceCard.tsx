import Link from "next/link";
import type { ReactNode } from "react";
import type { SpaceSummary } from "@/lib/types";
import { spaceSize } from "@/lib/format";
import { VisibilityBadge } from "./VisibilityPicker";

/**
 * Dashboard card for a space, Twitch style: the thumbnail slides up on hover over a purple block, with the name,
 * a detail line and an optional ⋯ menu underneath. The whole card enters the space.
 */
export function SpaceCard({
  space,
  detail,
  menu,
}: {
  space: SpaceSummary;
  detail?: ReactNode;
  menu?: ReactNode;
}) {
  const href = `/space/${space.id}`;

  return (
    <article className="group relative">
      <Link href={href} aria-label={`Enter ${space.name}`} className="block rounded-xl">
        <div className="thumb-lift">
          <div className="thumb-lift-inner aspect-video">
            {space.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- pixel-art thumbnail served from /public
              <img src={space.thumbnail} alt="" className="pixelated thumb-fallback h-full w-full object-cover" />
            ) : (
              <div className="thumb-fallback h-full w-full" />
            )}
            <div className="absolute top-2 left-2">
              <VisibilityBadge visibility={space.visibility} />
            </div>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate font-semibold transition-colors hover:text-primary-light">
            {space.name}
          </Link>
          <p className="truncate text-sm text-copy-lighter">{detail ?? `${spaceSize(space.dimensions)} space`}</p>
        </div>
        {menu && <div className="-mr-2 shrink-0">{menu}</div>}
      </div>
    </article>
  );
}

export function SpaceCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-video rounded-xl" />
      <div className="skeleton mt-3 h-4 w-2/3" />
      <div className="skeleton mt-2 h-3 w-1/3" />
    </div>
  );
}
