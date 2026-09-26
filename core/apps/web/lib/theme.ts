// Reads a colour token defined in app/globals.css (e.g. "background" -> --color-background),
// so code outside CSS (like the Phaser canvas) uses the same palette. Browser-only.
export function themeColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}
