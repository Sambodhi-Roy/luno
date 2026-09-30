import type { CSSProperties } from "react";
import { DEFAULT_AVATAR_URL } from "@/lib/avatars";

const SIZES = { sm: "avatar-sprite-sm", md: "", lg: "avatar-sprite-lg" };

// Frame size, idle frame and scaling live in the avatar-sprite utilities in app/globals.css.
// The image URL is per-avatar data, so it's the only value passed in (as a CSS variable).
export function AvatarSprite({
  imageUrl,
  size = "md",
  walking = false,
}: {
  // null shows the default character, as the game does
  imageUrl: string | null;
  size?: keyof typeof SIZES;
  // Loop the walk-down animation instead of standing still
  walking?: boolean;
}) {
  return (
    <div className={`avatar-sprite ${SIZES[size]}`}>
      <div
        className={`avatar-sprite-frame ${walking ? "avatar-sprite-walking" : ""}`}
        style={{ "--sprite-url": `url(${imageUrl ?? DEFAULT_AVATAR_URL})` } as CSSProperties}
      />
    </div>
  );
}

/** A small avatar head-and-shoulders in a circle, like a profile picture (header, dock). */
export function AvatarBadge({ imageUrl }: { imageUrl: string | null }) {
  return (
    <span className="avatar-badge">
      <AvatarSprite imageUrl={imageUrl} />
    </span>
  );
}
