"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { DEFAULT_AVATAR_URL } from "@/lib/avatars";

const SIZES = { sm: "avatar-sprite-sm", md: "", lg: "avatar-sprite-lg" };

/** The sheet to show: the avatar's own, or the default character if it's missing or fails to load (as in game). */
function useSheetUrl(imageUrl: string | null) {
  const url = imageUrl ?? DEFAULT_AVATAR_URL;
  // A CSS background gives no load error, so probe the image; remember which URL failed
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (url === DEFAULT_AVATAR_URL) return;
    const probe = new Image();
    probe.onerror = () => setFailedUrl(url);
    probe.src = url;
    return () => {
      probe.onerror = null;
    };
  }, [url]);

  return failedUrl === url ? DEFAULT_AVATAR_URL : url;
}

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
  const sheetUrl = useSheetUrl(imageUrl);
  return (
    <div className={`avatar-sprite ${SIZES[size]}`}>
      <div
        className={`avatar-sprite-frame ${walking ? "avatar-sprite-walking" : ""}`}
        style={{ "--sprite-url": `url(${sheetUrl})` } as CSSProperties}
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
