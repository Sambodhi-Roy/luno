import { DEFAULT_AVATAR_URL } from "@/lib/avatars";
import { AvatarSprite } from "./AvatarSprite";

const MAP_ART = "/assets/maps/office/thumbnail.png";

// People standing around the office, placed with Tailwind's fraction insets
const PEOPLE = [
  { name: "maya", position: "top-1/3 left-1/4", walking: false },
  { name: "sam", position: "top-1/2 left-1/2", walking: true },
  { name: "jo", position: "top-1/4 left-3/4", walking: false },
];

/**
 * Marketing artwork: the office map in a browser window with a few characters and name tags, echoing what
 * a space looks like. Used on the landing page and next to the login and signup forms.
 */
export function HeroArt({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-glow overflow-hidden rounded-2xl border border-border bg-foreground">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        <span className="size-2.5 rounded-full bg-error" />
        <span className="size-2.5 rounded-full bg-warning" />
        <span className="size-2.5 rounded-full bg-success" />
        {!compact && (
          <span className="ml-3 flex items-center gap-2 text-xs text-copy-lighter">
            <span className="badge-live">Live</span>
            Team HQ · 3 online
          </span>
        )}
      </div>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel-art map served from /public */}
        <img src={MAP_ART} alt="A Luno space: an office seen from above" className="pixelated aspect-video w-full object-cover" />
        {PEOPLE.map((p) => (
          <div key={p.name} className={`absolute flex -translate-x-1/2 flex-col items-center ${p.position}`}>
            <span className="mb-0.5 rounded-full bg-background/80 px-2 text-xs font-semibold">{p.name}</span>
            <AvatarSprite imageUrl={DEFAULT_AVATAR_URL} walking={p.walking} />
          </div>
        ))}
      </div>
    </div>
  );
}
