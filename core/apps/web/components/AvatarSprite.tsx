import type { CSSProperties } from "react";

// Frame size, idle frame and scaling live in the avatar-sprite utilities in app/globals.css.
// The image URL is per-avatar data, so it's the only value passed in (as a CSS variable).
export function AvatarSprite({ imageUrl, size = "md" }: { imageUrl: string | null; size?: "sm" | "md" }) {
  const box = `avatar-sprite ${size === "sm" ? "avatar-sprite-sm" : ""}`;

  if (!imageUrl) {
    return <div className={`${box} rounded bg-border`} />;
  }

  return (
    <div className={box}>
      <div
        className="avatar-sprite-frame"
        style={{ "--sprite-url": `url(${imageUrl})` } as CSSProperties}
      />
    </div>
  );
}
