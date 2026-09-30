const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago", "yesterday", "just now". */
export function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** A size people understand ("Small", "Medium", "Large") from "WxH" tile dimensions. */
export function spaceSize(dimensions: string) {
  const [w = 0, h = 0] = dimensions.split("x").map(Number);
  const area = w * h;
  if (area <= 600) return "Small";
  if (area <= 1600) return "Medium";
  return "Large";
}
