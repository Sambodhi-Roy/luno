// Reads values defined in app/globals.css so code outside CSS (like the Phaser canvas) uses the same
// design tokens. Browser-only.

/** A palette colour, e.g. "background" -> --color-background. */
export function themeColor(name: string) {
  return cssVar(`--color-${name}`);
}

/** Any custom property from :root, e.g. "--game-label-font-size". */
export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The font stack the page body renders with. */
export function bodyFont() {
  return getComputedStyle(document.body).fontFamily;
}
